/**
 * AMIS RIS 2030 — Tipos Semánticos
 *
 * Mapeo de los nombres crípticos del schema legacy
 * a una nomenclatura moderna y limpia para el Dashboard.
 *
 * Legacy (DBMULTIRISQA)     →  Dashboard (TypeScript)
 * ─────────────────────────────────────────────────────
 * codexamen                 →  studyInstanceUID
 * idpaciente                →  patientId
 * nombre                    →  patientName
 * numeroacceso              →  accessionNumber
 * fechaexamen               →  studyDate
 * modalidad                 →  modality
 * descripcion               →  studyDescription
 * nombre_estado_examen      →  examStatus
 * usernameRadiologo         →  radiologistUsername
 * id_institucion            →  institutionId
 */

// ═══════════════════════════════════════════════════════════
// Identidad Adaptativa (Hospital del Cobre / Multi-Centro)
// ═══════════════════════════════════════════════════════════

/** Fuente de identificación del paciente según el centro B2B */
export type PatientIdSource = 'RUT' | 'NUM_COBRE' | 'EXTERNAL_ID';

/** Configuración de identidad de un centro B2B */
export interface B2BCenterIdentityConfig {
  centerId: string;
  centerName: string;
  patientIdSource: PatientIdSource;
  /** Label humano para el tipo de ID (ej: 'RUT', 'N° Cobre', 'ID Externo') */
  idLabel: string;
}

// ═══════════════════════════════════════════════════════════
// Entidades de Dominio
// ═══════════════════════════════════════════════════════════

/** Estudio radiológico — entidad central del worklist */
export interface Study {
  id: number;
  studyInstanceUID: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  patientLastName: string;
  patientMotherLastName: string;
  patientFullName: string;
  birthDate: Date | null;
  sex: string;
  age: string;
  studyDate: Date;
  modality: string;
  studyDescription: string;
  examStatus: string;
  examStatusId: number;
  institutionId: number;
  institutionName: string;
  radiologistUsername: string;
  assignmentDate: Date | null;
  validationDate: Date | null;
  urgencyType: string;
  clinicalHistory: string;
  instanceCount: number;
  isBlocked: boolean;
  blockDate: Date | null;
  blockUserId: number | null;
  reporterUsername: string;
  validatorUsername: string;
  technologist: string;
  requestingPhysician: string;
  /** ID externo del paciente (Número Cobre, código de empleado, etc.) */
  externalPatientId?: string;
}

/** Estudio radiológico enriquecido con datos de AMIS 3.0 */
export interface EnrichedStudy extends Study {
  enrichedRadiologistName: string;
  enrichedInstitutionName: string;
  expectedSLACriticalMinutes: number;
  expectedSLAUrgentMinutes: number;
  expectedSLANormalMinutes: number;
  // B2B / Pending Actions metadata
  pendingReason?: string;
  pendingMessage?: string;
  pendingStatus?: 'PENDING_CENTER_ACTION' | 'RESOLVED' | 'NONE';
  isHighPriorityReturn?: boolean;
  // ─── IDENTIDAD ADAPTATIVA ─────────────────────────────────
  /** Qué tipo de ID se usa para este paciente según su centro de origen */
  patientIdSource: PatientIdSource;
  /** Label humanizado del tipo de ID (ej: 'RUT', 'N° Cobre') */
  patientIdLabel: string;
  /** El valor del ID efectivo para búsquedas (puede ser RUT o externalPatientId) */
  effectivePatientId: string;
  /** Configuración completa del centro B2B (si aplica) */
  centerIdentityConfig?: B2BCenterIdentityConfig;
}

/** Informe radiológico */
export interface Report {
  id: number;
  studyInstanceUID: string;
  patientId: string;
  radiologistUsername: string;
  validationDate: Date | null;
  hasCriticalPathology: boolean;
  criticalPathologyDescription: string;
  description: string;
  reportStatusId: number;
  modality: string;
  reportTypeId: number;
  institutionId: number;
  secondSignatureUserId: number | null;
  signingUser: string;
}

/** Contenido del informe (texto) */
export interface ReportContent {
  id: number;
  studyInstanceUID: string;
  sectionId: number;
  content: string;
  date: Date | null;
  reportId: number;
  position: number | null;
  institutionId: number;
}

/** Institución / Hospital */
export interface Institution {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  aeTitle: string | null;
}

/** Modalidad de imagen */
export interface Modality {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
}

/** Estado del examen */
export interface ExamStatus {
  id: number;
  name: string;
  code: string;
  order: number;
}

// ═══════════════════════════════════════════════════════════
// Tipos de consulta / respuesta
// ═══════════════════════════════════════════════════════════

/** Parámetros de paginación */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Resultado paginado genérico */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Filtros del worklist */
export interface WorklistFilters {
  /** Filtro por estado del examen (ej: "Nuevo", "Validado") */
  examStatusId?: number;
  /** Filtro por institución */
  institutionId?: number;
  /** Filtro por modalidad (CT, MR, DX, US, etc.) */
  modality?: string;
  /** Filtro por radiólogo asignado */
  radiologistUsername?: string;
  /** Fecha inicio del rango */
  dateFrom?: Date;
  /** Fecha fin del rango */
  dateTo?: Date;
  /** Rango de tiempo predefinido */
  timeRange?: 'today' | '24h' | 'all';
  /** Tipo de urgencia */
  urgencyType?: string;
}

/** Modos de visualización para diagnóstico */
export type DiagnosisMode = 'dark' | 'high-contrast' | 'low-light';

/** Parámetros de búsqueda typeahead */
export interface SearchParams {
  /** Término de búsqueda (RUT, nombre, accession number, N° Cobre, etc.) */
  query: string;
  /** Máximo de resultados */
  limit?: number;
  /** Forzar búsqueda por un tipo de ID específico (Identidad Adaptativa) */
  forceIdSource?: PatientIdSource;
  /** ID de institución para determinar el tipo de búsqueda automáticamente */
  institutionId?: number;
}

/** Resultado de búsqueda condensado para typeahead */
export interface SearchResult {
  id: number;
  patientId: string;
  patientFullName: string;
  accessionNumber: string;
  modality: string;
  studyDate: Date;
  institutionName: string;
  examStatus: string;
}
