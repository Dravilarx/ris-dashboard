import { getWorklist } from "@/lib/db/queries";
import { supabase } from "@/lib/supabase";
import type { PaginatedResult, EnrichedStudy, PatientIdSource, B2BCenterIdentityConfig } from "@/types/ris";

/**
 * Cache En Memoria de los mapeos de AMIS 3.0
 */
let mappingCache: {
  doctors: Record<string, string>;
  institutions: Record<number, { id: string, name: string }>;
  slas: Record<string, Record<string, Record<string, number>>>; // [institutionUuid][category][modality] = minutes
  /** Identidad Adaptativa: configuración por legacy_institution_id */
  centerIdentities: Record<number, B2BCenterIdentityConfig>;
  lastFetch: number;
} | null = null;

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 Minutos
// Tiempos de SLA por defecto (minutos), por categoria clinica.
// Se usan solo cuando no hay una regla especifica en ris_sla_rules.
const DEFAULT_SLA_MINUTES: Record<string, number> = {
  Urgencia: 60,
  Hospitalizado: 240,
  Ambulatorio: 1440,
};
const SUPABASE_TIMEOUT_MS = 1500; // 1.5s max para esperar Supabase, luego fallback VPN (Efecto de Carga Progresiva)

/**
 * Promise wrapper con timeout
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeout: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('Supabase Timeout')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

/**
 * Recupera el cerebro administrativo desde Supabase.
 */
async function fetchMappingsFromAmis3() {
  const now = Date.now();
  if (mappingCache && (now - mappingCache.lastFetch) < CACHE_TTL_MS) {
    return mappingCache;
  }

  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("undefined")) {
      throw new Error("Supabase URL no configurada, usando fallbacks preventivos.");
    }

    // Consultas reales a AMIS 3.0
    const fetchPromises = Promise.all([
      supabase.from("ris_doctor_mapping").select("username, nombre_completo"),
      supabase.from("ris_institution_mapping").select("legacy_id, id, nombre_comercial"),
      supabase.from("ris_sla_rules").select("institution_id, category, modality, sla_minutes"),
      supabase.from("b2b_centers").select("id, legacy_institution_id, center_name, patient_id_source, patient_id_label").eq("is_active", true),
    ]);

    const [docsRes, instRes, slaRes, centersRes] = await withTimeout(fetchPromises, SUPABASE_TIMEOUT_MS);

    const doctors: Record<string, string> = {};
    if (docsRes?.data) {
      docsRes.data.forEach((d) => { doctors[d.username] = d.nombre_completo; });
    }

    const institutions: Record<number, {id: string, name: string}> = {};
    if (instRes?.data) {
      instRes.data.forEach((i) => { institutions[i.legacy_id] = { id: i.id, name: i.nombre_comercial }; });
    }

    const slas: Record<string, Record<string, Record<string, number>>> = {};
    if (slaRes?.data) {
      slaRes.data.forEach((s) => { 
        if (!slas[s.institution_id]) slas[s.institution_id] = {};
        if (!slas[s.institution_id][s.category]) slas[s.institution_id][s.category] = {};
        slas[s.institution_id][s.category][s.modality] = s.sla_minutes;
      });
    }

    // ─── IDENTIDAD ADAPTATIVA: Centros B2B ───────────────────
    const centerIdentities: Record<number, B2BCenterIdentityConfig> = {};
    if (centersRes?.data) {
      centersRes.data.forEach((c) => {
        if (c.legacy_institution_id != null) {
          centerIdentities[c.legacy_institution_id] = {
            centerId: c.id,
            centerName: c.center_name,
            patientIdSource: c.patient_id_source as PatientIdSource,
            idLabel: c.patient_id_label,
          };
        }
      });
    }

    mappingCache = { doctors, institutions, slas, centerIdentities, lastFetch: now };
    return mappingCache;

  } catch (error) {
    console.warn("[Enrichment Service] Fallback Activado (VPN Only):", error instanceof Error ? error.message : "Error desconocido");
    // Return empty cache to trigger Fallbacks automatically
    return { doctors: {}, institutions: {}, slas: {}, centerIdentities: {}, lastFetch: 0 };
  }
}

/**
 * Normaliza la categoría a los nombres de AMIS 3.0 
 * (Urgencia, Hospitalizado, Ambulatorio)
 */
function normalizeCategory(urgencyString: string): string {
  if (!urgencyString) return "Ambulatorio";
  const u = urgencyString.toLowerCase();
  if (u.includes("urg")) return "Urgencia";
  if (u.includes("hosp")) return "Hospitalizado";
  return "Ambulatorio";
}

/**
 * Resuelve la Identidad Adaptativa para un estudio según la configuración
 * del centro B2B de origen.
 * 
 * Lógica:
 *   - Si el centro usa 'NUM_COBRE' → el ID efectivo es external_patient_id
 *   - Si el centro usa 'EXTERNAL_ID' → el ID efectivo es external_patient_id
 *   - Default ('RUT') → el ID efectivo es patientId (RUT estándar)
 */
function resolveAdaptiveIdentity(
  study: { institutionId: number; patientId: string; externalPatientId?: string },
  centerIdentities: Record<number, B2BCenterIdentityConfig>
): { patientIdSource: PatientIdSource; patientIdLabel: string; effectivePatientId: string; centerIdentityConfig?: B2BCenterIdentityConfig } {
  const centerConfig = centerIdentities[study.institutionId];
  
  if (!centerConfig) {
    // Centro no configurado en B2B → default RUT
    return {
      patientIdSource: 'RUT',
      patientIdLabel: 'RUT',
      effectivePatientId: study.patientId,
    };
  }

  const source = centerConfig.patientIdSource;
  
  if ((source === 'NUM_COBRE' || source === 'EXTERNAL_ID') && study.externalPatientId) {
    return {
      patientIdSource: source,
      patientIdLabel: centerConfig.idLabel,
      effectivePatientId: study.externalPatientId,
      centerIdentityConfig: centerConfig,
    };
  }

  // Fallback: si el centro dice NUM_COBRE pero no hay external_patient_id,
  // usará el RUT con una indicación de que el ID preferido no está disponible
  return {
    patientIdSource: source,
    patientIdLabel: centerConfig.idLabel,
    effectivePatientId: study.externalPatientId || study.patientId,
    centerIdentityConfig: centerConfig,
  };
}

/**
 * Calcula los milisegundos restantes hasta el vencimiento del SLA de un estudio.
 * Valor negativo = vencido (maxima prioridad).
 * Valor positivo = tiempo restante en ms (menor = mas urgente).
 */
function getSLARemainingMs(study: EnrichedStudy): number {
  const now = Date.now();
  const ingressMs = new Date(study.studyDate).getTime();
  const urgency = (study.urgencyType || '').toLowerCase();

  let slaMinutes: number;
  if (urgency.includes('critic')) {
    slaMinutes = study.expectedSLACriticalMinutes || 30;
  } else if (urgency.includes('urg')) {
    slaMinutes = study.expectedSLAUrgentMinutes || 60;
  } else {
    slaMinutes = study.expectedSLANormalMinutes || 240;
  }

  const deadlineMs = ingressMs + slaMinutes * 60 * 1000;
  return deadlineMs - now;
}

/**
 * Servicio Central de Alta Performance con ordenamiento por vencimiento SLA.
 *
 * Para ventanas activas (today/24h): carga TODOS los registros del periodo,
 * los enriquece, los ordena por tiempo restante de entrega (SLA multicentro)
 * y luego pagina en memoria.
 *
 * Para busqueda global (q) y historico (all): usa paginacion de la BD.
 */
export async function fetchEnrichedWorklist(
  pagination: any,
  filters: any
): Promise<PaginatedResult<EnrichedStudy>> {

  const isActiveWindow = !filters.q && (filters.timeRange === 'today' || filters.timeRange === '24h');
  const MAX_SLA_SORT_RECORDS = 1500; // limite de seguridad para la ventana activa

  const mappings = await fetchMappingsFromAmis3();

  // Funcion interna de enriquecimiento (reutilizable)
  const enrichStudy = (study: any, index: number): EnrichedStudy => {
    const instMapping = mappings.institutions[study.institutionId];
    const realInstitution = instMapping?.name || study.institutionName || 'Institucion Desconocida';

    const mappedDoctor = study.radiologistUsername ? mappings.doctors[study.radiologistUsername] : undefined;
    const realDoctor = mappedDoctor
      ? `Dr/a. ${mappedDoctor}`
      : (study.radiologistUsername ? `Staff (${study.radiologistUsername})` : 'NO ASIGNADO');

    const category = normalizeCategory(study.urgencyType || '');
    const modality = study.modality || 'RX';
    let expectedMins = DEFAULT_SLA_MINUTES[category] ?? 240;

    if (instMapping?.id && mappings.slas[instMapping.id]) {
      const instSlas = mappings.slas[instMapping.id];
      if (instSlas[category] && instSlas[category][modality]) {
        expectedMins = instSlas[category][modality];
      }
    }

    const criticalMins = expectedMins;
    const urgentMins = Math.floor(expectedMins * 0.75);
    const normalMins = expectedMins;

    return {
      ...study,
      enrichedRadiologistName: realDoctor,
      enrichedInstitutionName: realInstitution,
      expectedSLACriticalMinutes: criticalMins,
      expectedSLAUrgentMinutes: urgentMins,
      expectedSLANormalMinutes: normalMins,
      isHighPriorityReturn: false,
      ...resolveAdaptiveIdentity(study, mappings.centerIdentities),
    };
  };

  // VENTANA ACTIVA: fetch completo + sort SLA + paginacion en memoria
  if (isActiveWindow) {
    const fullResult = await getWorklist({ page: 1, pageSize: MAX_SLA_SORT_RECORDS }, filters);

    const enrichedAll = fullResult.data.map((s, i) => enrichStudy(s, i));

    // Ordenar por tiempo restante SLA (vencidos primero, luego por urgencia)
    enrichedAll.sort((a, b) => getSLARemainingMs(a) - getSLARemainingMs(b));

    // Paginar en memoria
    const { page: rawPage, pageSize: rawSize } = pagination;
    const safePage = Math.max(1, parseInt(String(rawPage)) || 1);
    const safePageSize = Math.max(1, parseInt(String(rawSize)) || 30);
    const offset = (safePage - 1) * safePageSize;
    const sliced = enrichedAll.slice(offset, offset + safePageSize);
    const total = fullResult.total;

    return {
      data: sliced,
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  // BUSQUEDA GLOBAL / HISTORICO: paginacion de la BD, sin sort SLA
  const legacyResult = await getWorklist(pagination, filters);
  const enrichedData = legacyResult.data.map((s, i) => enrichStudy(s, i));

  return {
    ...legacyResult,
    data: enrichedData,
  };
}

export async function getEnrichedStudyByUID(
  studyInstanceUID: string
): Promise<EnrichedStudy | null> {
  const { getStudyByUID } = await import("@/lib/db/queries");
  const study = await getStudyByUID(studyInstanceUID);
  if (!study) return null;

  const mappings = await fetchMappingsFromAmis3();

  const instMapping = mappings.institutions[study.institutionId];
  const realInstitution = instMapping?.name || study.institutionName || 'Institución Desconocida';
  
  const mappedDoctor = study.radiologistUsername ? mappings.doctors[study.radiologistUsername] : undefined;
  const realDoctor = mappedDoctor 
    ? `Dr/a. ${mappedDoctor}` 
    : (study.radiologistUsername ? `Staff (${study.radiologistUsername})` : 'NO ASIGNADO');

  const category = normalizeCategory(study.urgencyType || "");
  const modality = study.modality || "RX";
  let expectedMins = DEFAULT_SLA_MINUTES[category] ?? 240;

  if (instMapping?.id && mappings.slas[instMapping.id]) {
    const instSlas = mappings.slas[instMapping.id];
    if (instSlas[category] && instSlas[category][modality]) {
      expectedMins = instSlas[category][modality];
    }
  }

  return {
    ...study,
    enrichedRadiologistName: realDoctor,
    enrichedInstitutionName: realInstitution,
    expectedSLACriticalMinutes: expectedMins,
    expectedSLAUrgentMinutes: Math.floor(expectedMins * 0.75),
    expectedSLANormalMinutes: expectedMins,
    // ─── IDENTIDAD ADAPTATIVA ────────────────────────────────
    ...resolveAdaptiveIdentity(study, mappings.centerIdentities),
  };
}
