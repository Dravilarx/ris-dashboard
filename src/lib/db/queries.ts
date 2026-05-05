/**
 * AMIS RIS 2030 — Capa de Queries Read-Only
 *
 * Todas las queries se ejecutan contra la vista View_Busqueda_Examen
 * y las tablas ris_informe/ris_informe_dato para máximo rendimiento.
 *
 * Usa Prisma.$queryRaw (tagged template) para parametrización segura.
 * ⚠️ SOLO LECTURA — No ejecutar operaciones de escritura.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  Study,
  Report,
  ReportContent,
  PaginatedResult,
  WorklistFilters,
  PaginationParams,
  SearchResult,
} from "@/types/ris";

// ═══════════════════════════════════════════════════════════
// Mappers: Legacy Row → Tipo Semántico
// ═══════════════════════════════════════════════════════════

function mapRowToStudy(row: Record<string, unknown>): Study {
  return {
    id: Number(row.id_ris_examen ?? row.id ?? 0),
    studyInstanceUID: String(row.codexamen ?? ""),
    accessionNumber: String(row.numeroacceso ?? ""),
    patientId: String(row.idpaciente ?? ""),
    patientName: String(row.nombre ?? "").trim(),
    patientLastName: String(row.apellidopaterno ?? "").trim(),
    patientMotherLastName: String(row.apellidomaterno ?? "").trim(),
    patientFullName: [
      String(row.nombre ?? "").trim(),
      String(row.apellidopaterno ?? "").trim(),
      String(row.apellidomaterno ?? "").trim(),
    ]
      .filter(Boolean)
      .join(" "),
    birthDate: row.fechanacimiento ? new Date(row.fechanacimiento as string) : null,
    sex: String(row.sexo ?? ""),
    age: String(row.edad ?? ""),
    studyDate: new Date(row.fechaexamen as string),
    modality: String(row.modalidad ?? ""),
    studyDescription: String(row.descripcion ?? ""),
    examStatus: String(row.nombre_estado_examen ?? ""),
    examStatusId: Number(row.id_estado_examen ?? 0),
    institutionId: Number(row.id_institucion ?? 0),
    institutionName: String(row.institucion ?? ""),
    radiologistUsername: String(row.usernameRadiologo ?? ""),
    assignmentDate: row.fechaasignacion ? new Date(row.fechaasignacion as string) : null,
    validationDate: row.fechavalidacion ? new Date(row.fechavalidacion as string) : null,
    urgencyType: String(row.nombre_tipo_urgencia ?? ""),
    clinicalHistory: String(row.antecedentes_clinicos ?? ""),
    instanceCount: Number(row.cantidad_instancias ?? row.instancias ?? 0),
    isBlocked: Boolean(row.bloqueado),
    blockDate: row.fecha_bloqueo ? new Date(row.fecha_bloqueo as string) : null,
    blockUserId: row.id_usuario_bloqueo ? Number(row.id_usuario_bloqueo) : null,
    reporterUsername: String(row.UsuarioInformador ?? ""),
    validatorUsername: String(row.UsuarioValidador ?? ""),
    technologist: String(row.tecnologo ?? ""),
    requestingPhysician: String(row.medicosolicitante ?? ""),
    externalPatientId: row.external_patient_id ? String(row.external_patient_id) : undefined,
  };
}

function mapRowToSearchResult(row: Record<string, unknown>): SearchResult {
  return {
    id: Number(row.id_ris_examen ?? 0),
    patientId: String(row.idpaciente ?? ""),
    patientFullName: String(row.nombreFull ?? row.nombre ?? "").trim(),
    accessionNumber: String(row.numeroacceso ?? ""),
    modality: String(row.modalidad ?? ""),
    studyDate: new Date(row.fechaexamen as string),
    institutionName: String(row.institucion ?? ""),
    examStatus: String(row.nombre_estado_examen ?? ""),
  };
}

// ═══════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════

/**
 * getWorklist — Lista paginada de estudios con filtros
 *
 * Usa View_Busqueda_Examen para máximo rendimiento.
 * Construye queries dinámicas con Prisma.sql para parametrización segura.
 */
export async function getWorklist(
  pagination: PaginationParams = { page: 1, pageSize: 50 },
  filters: WorklistFilters = {}
): Promise<PaginatedResult<Study>> {
  // Sanitizacion para evitar NaN en MSSQL
  const pSize = parseInt(String(pagination?.pageSize));
  const pPage = parseInt(String(pagination?.page));
  const safePageSize = isNaN(pSize) ? 50 : Math.max(1, pSize);
  const safePage = isNaN(pPage) ? 1 : Math.max(1, pPage);
  const offset = (safePage - 1) * safePageSize;

  // ===================================================================
  // RAMA: BUSQUEDA GLOBAL HISTORICA
  // Cuando q esta presente, anula TODOS los filtros de fecha y busca
  // en toda la base de datos (historial completo de todos los anos).
  // ===================================================================
  if (filters.q && filters.q.trim().length >= 2) {
    const raw = filters.q.trim();
    const searchLike = `%${raw}%`;
    const startLike  = `${raw}%`;

    const countResult = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*) AS total FROM View_Busqueda_Examen
      WHERE (
        nombre          LIKE ${searchLike}
        OR apellidopaterno LIKE ${searchLike}
        OR apellidomaterno LIKE ${searchLike}
        OR idpaciente      LIKE ${startLike}
        OR numeroacceso    LIKE ${startLike}
      )
    `;
    const searchTotal = Number(countResult[0]?.total ?? 0);

    const searchRows = await prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      SELECT *
      FROM View_Busqueda_Examen
      WHERE (
        nombre          LIKE ${searchLike}
        OR apellidopaterno LIKE ${searchLike}
        OR apellidomaterno LIKE ${searchLike}
        OR idpaciente      LIKE ${startLike}
        OR numeroacceso    LIKE ${startLike}
      )
      ORDER BY fechaexamen DESC
      OFFSET ${Prisma.raw(String(offset))} ROWS
      FETCH NEXT ${Prisma.raw(String(safePageSize))} ROWS ONLY
    `);

    return {
      data: searchRows.map(mapRowToStudy),
      page: safePage,
      pageSize: safePageSize,
      total: searchTotal,
      totalPages: Math.ceil(searchTotal / safePageSize),
    };
  }

  // ===================================================================
  // RAMA: WORKLIST CON FILTRO DE FECHA (comportamiento normal)
  // ===================================================================
  const timeRange = filters.timeRange || 'today';
  let dateFilter: Prisma.Sql = Prisma.sql`1=1`;

  if (timeRange === 'today') {
    dateFilter = Prisma.sql`fechaexamen >= CAST(GETDATE() AS DATE)`;
  } else if (timeRange === '24h') {
    dateFilter = Prisma.sql`fechaexamen >= DATEADD(hour, -24, GETDATE())`;
  }

  const conditions: Prisma.Sql[] = [dateFilter];

  if (filters.examStatusId !== undefined) {
    conditions.push(Prisma.sql`id_estado_examen = ${filters.examStatusId}`);
  }
  if (filters.institutionId !== undefined) {
    conditions.push(Prisma.sql`id_institucion = ${filters.institutionId}`);
  }
  if (filters.modality) {
    conditions.push(Prisma.sql`modalidad = ${filters.modality}`);
  }
  if (filters.radiologistUsername) {
    conditions.push(Prisma.sql`usernameRadiologo = ${filters.radiologistUsername}`);
  }
  if (filters.dateFrom) {
    conditions.push(Prisma.sql`fechaexamen >= ${filters.dateFrom}`);
  }
  if (filters.dateTo) {
    conditions.push(Prisma.sql`fechaexamen <= ${filters.dateTo}`);
  }

  const whereClause = Prisma.join(conditions, " AND ");

  const countResult = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*) AS total FROM View_Busqueda_Examen WHERE ${whereClause}
  `;
  const total = Number(countResult[0]?.total ?? 0);

  const rows = await prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
    SELECT *
    FROM View_Busqueda_Examen
    WHERE ${whereClause}
    ORDER BY fechaexamen DESC
    OFFSET ${Prisma.raw(String(offset))} ROWS
    FETCH NEXT ${Prisma.raw(String(safePageSize))} ROWS ONLY
  `);

  return {
    data: rows.map(mapRowToStudy),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages: Math.ceil(total / safePageSize),
  };
}

/**
 * getWorklistStats -- Conteos de estado para las tarjetas KPI del Panel de Trabajo
 *
 * Ejecuta UNA sola query con COUNT condicional para obtener todos los KPIs
 * sin cargar registros completos. Extremadamente eficiente en produccion.
 */
export async function getWorklistStats(
  timeRange: 'today' | '24h' | 'all' = 'today'
): Promise<{ pending: number; informed: number; validated: number; urgent: number; total: number }> {
  let dateFilter: Prisma.Sql = Prisma.sql`1=1`;
  if (timeRange === 'today') {
    dateFilter = Prisma.sql`fechaexamen >= CAST(GETDATE() AS DATE)`;
  } else if (timeRange === '24h') {
    dateFilter = Prisma.sql`fechaexamen >= DATEADD(hour, -24, GETDATE())`;
  }

  type StatsRow = {
    pending_count: number | bigint;
    informed_count: number | bigint;
    validated_count: number | bigint;
    urgent_count: number | bigint;
    total_count: number | bigint;
  };

  const result = await prisma.$queryRaw<StatsRow[]>`
    SELECT
      COUNT(CASE WHEN LOWER(nombre_estado_examen) LIKE '%pend%' THEN 1 END) AS pending_count,
      COUNT(CASE WHEN LOWER(nombre_estado_examen) LIKE '%inform%' THEN 1 END) AS informed_count,
      COUNT(CASE WHEN LOWER(nombre_estado_examen) LIKE '%valid%' THEN 1 END) AS validated_count,
      COUNT(CASE WHEN LOWER(nombre_tipo_urgencia) LIKE '%urg%' THEN 1 END) AS urgent_count,
      COUNT(*) AS total_count
    FROM View_Busqueda_Examen
    WHERE ${dateFilter}
  `;

  const row = result[0];
  return {
    pending:  Number(row?.pending_count  ?? 0),
    informed: Number(row?.informed_count ?? 0),
    validated: Number(row?.validated_count ?? 0),
    urgent:   Number(row?.urgent_count   ?? 0),
    total:    Number(row?.total_count    ?? 0),
  };
}

/**
 * getStudyByUID — Detalle completo de un estudio por StudyInstanceUID (codexamen)
 */
export async function getStudyByUID(
  studyInstanceUID: string
): Promise<Study | null> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT TOP 1 * FROM View_Busqueda_Examen WHERE codexamen = ${studyInstanceUID}
  `;
  if (rows.length === 0) return null;
  return mapRowToStudy(rows[0]);
}

/**
 * getStudyReports — Informes asociados a un estudio
 */
export async function getStudyReports(
  studyInstanceUID: string
): Promise<Report[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT * FROM ris_informe WHERE codExamen = ${studyInstanceUID} ORDER BY id_ris_informe DESC
  `;

  return rows.map((row) => ({
    id: Number(row.id_ris_informe),
    studyInstanceUID: String(row.codExamen ?? ""),
    patientId: String(row.id_paciente ?? ""),
    radiologistUsername: String(row.username_radiologo ?? ""),
    validationDate: row.fecha_validacion ? new Date(row.fecha_validacion as string) : null,
    hasCriticalPathology: Boolean(row.flag_patologia_grave),
    criticalPathologyDescription: String(row.patologia_grave ?? ""),
    description: String(row.descripcion ?? ""),
    reportStatusId: Number(row.id_estado_informe ?? 0),
    modality: String(row.modalidad ?? ""),
    reportTypeId: Number(row.id_tipo_informe ?? 0),
    institutionId: Number(row.id_institucion ?? 0),
    secondSignatureUserId: row.id_UsernameRadiologoSegundaFirma
      ? Number(row.id_UsernameRadiologoSegundaFirma)
      : null,
    signingUser: String(row.usuario_firma ?? ""),
  }));
}

/**
 * getReportContent — Texto del informe radiológico
 */
export async function getReportContent(
  reportId: number
): Promise<ReportContent[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT * FROM ris_informe_dato WHERE id_informe = ${BigInt(reportId)} ORDER BY posicion ASC
  `;

  return rows.map((row) => ({
    id: Number(row.id_informe_dato),
    studyInstanceUID: String(row.cod_examen ?? ""),
    sectionId: Number(row.id_dato ?? 0),
    content: String(row.valor ?? ""),
    date: row.fecha ? new Date(row.fecha as string) : null,
    reportId: Number(row.id_informe ?? 0),
    position: row.posicion ? Number(row.posicion) : null,
    institutionId: Number(row.id_institucion ?? 0),
  }));
}

/**
 * searchStudies — Búsqueda tipo typeahead con soporte de Identidad Adaptativa
 *
 * Estrategia de detección automática:
 * - RUT (dígitos + guión): busca por idpaciente
 * - Numérico puro (5+ dígitos): busca por numeroacceso
 * - Texto: busca por nombre del paciente
 *
 * Si forceIdSource == 'NUM_COBRE' o 'EXTERNAL_ID':
 * - Busca por external_patient_id en la tabla de producción
 */
export async function searchStudies(
  params: { query: string; limit?: number; forceIdSource?: string; institutionId?: number }
): Promise<SearchResult[]> {
  const { query, limit = 15, forceIdSource } = params;
  const cleanQuery = query.trim();

  if (cleanQuery.length < 2) return [];

  // ─── IDENTIDAD ADAPTATIVA: búsqueda forzada por ID externo ───
  if (forceIdSource === 'NUM_COBRE' || forceIdSource === 'EXTERNAL_ID') {
    const searchLike = `${cleanQuery}%`;
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT TOP ${limit}
        id_ris_examen, idpaciente, nombreFull, numeroacceso,
        modalidad, fechaexamen, institucion, nombre_estado_examen
      FROM View_Busqueda_Examen
      WHERE idpaciente LIKE ${searchLike}
      ORDER BY fechaexamen DESC
    `;
    return rows.map(mapRowToSearchResult);
  }

  // ─── DETECCIÓN AUTOMÁTICA (comportamiento estándar) ───
  const isRUT = /^\d+[-]?\d?$/i.test(cleanQuery.replace(/\./g, ""));
  const isAccession = /^\d{5,}$/.test(cleanQuery);

  let rows: Record<string, unknown>[];
  const searchLike = `${cleanQuery}%`;
  const searchContains = `%${cleanQuery}%`;

  if (isRUT) {
    rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT TOP ${limit}
        id_ris_examen, idpaciente, nombreFull, numeroacceso,
        modalidad, fechaexamen, institucion, nombre_estado_examen
      FROM View_Busqueda_Examen
      WHERE idpaciente LIKE ${searchLike}
      ORDER BY fechaexamen DESC
    `;
  } else if (isAccession) {
    rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT TOP ${limit}
        id_ris_examen, idpaciente, nombreFull, numeroacceso,
        modalidad, fechaexamen, institucion, nombre_estado_examen
      FROM View_Busqueda_Examen
      WHERE numeroacceso LIKE ${searchLike}
      ORDER BY fechaexamen DESC
    `;
  } else {
    rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT TOP ${limit}
        id_ris_examen, idpaciente, nombreFull, numeroacceso,
        modalidad, fechaexamen, institucion, nombre_estado_examen
      FROM View_Busqueda_Examen
      WHERE nombre LIKE ${searchContains} OR apellidopaterno LIKE ${searchContains}
      ORDER BY fechaexamen DESC
    `;
  }

  return rows.map(mapRowToSearchResult);
}

// =====================================================================
// LANZAMIENTO DE VISOR MEDDREAM
// =====================================================================

export interface MeddreamLaunchInfo {
  institutionId: number;
  studyInstanceUID: string;
  aetitle: string;
  urlToken: string;
  method: string;
  json: string;
  urlVisor: string;
}

/**
 * getMeddreamLaunchInfo — Obtiene la configuración necesaria para abrir
 * MedDream (visor DICOM, id_visor = 2) para un estudio dado.
 *
 * Equivale a:
 *   SELECT TOP 10 e.id_institucion, e.codexamen, e.aetitle,
 *                 'http://190.196.143.123:8090/v1/generate' AS urlToken,
 *                 m.method, m.json, iv.url AS urlVisor
 *   FROM ris_examen e
 *   INNER JOIN meddreams m            ON m.id_institucion  = e.id_institucion
 *   INNER JOIN institucion_visor iv   ON iv.id_institucion = e.id_institucion
 *   WHERE iv.id_visor = 2
 *     AND e.codexamen = @codExamen;
 */
export async function getMeddreamLaunchInfo(
  codExamen: string
): Promise<MeddreamLaunchInfo[]> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT TOP 10
      e.id_institucion,
      e.codexamen,
      e.aetitle,
      'http://190.196.143.123:8090/v1/generate' AS urlToken,
      m.method,
      m.json,
      iv.url AS urlVisor
    FROM ris_examen e
    INNER JOIN meddreams m          ON m.id_institucion  = e.id_institucion
    INNER JOIN institucion_visor iv ON iv.id_institucion = e.id_institucion
    WHERE iv.id_visor = 2
      AND e.codexamen = ${codExamen}
  `;

  return rows.map((row) => ({
    institutionId:    Number(row.id_institucion ?? 0),
    studyInstanceUID: String(row.codexamen ?? ""),
    aetitle:          String(row.aetitle ?? ""),
    urlToken:         String(row.urlToken ?? ""),
    method:           String(row.method ?? ""),
    json:             String(row.json ?? ""),
    urlVisor:         String(row.urlVisor ?? ""),
  }));
}

/**
 * getExamStatuses — Catálogo de estados de examen
 */
export async function getExamStatuses() {
  return (prisma as any).ris_estado_examen.findMany({
    orderBy: { orden: "asc" },
  });
}

/**
 * getInstitutions — Catálogo de instituciones activas
 */
export async function getInstitutions() {
  return (prisma as any).institucion.findMany({
    where: { estado: 1 },
    select: {
      id_institucion: true,
      nombre: true,
      descripcion: true,
      aetitle: true,
    },
    orderBy: { nombre: "asc" },
  });
}

/**
 * getModalities — Catalogo de modalidades activas
 */
export async function getModalities() {
  return (prisma as any).modalidad.findMany({
    where: { estado: 1 },
    orderBy: { nombre: "asc" },
  });
}

// =====================================================================
// ESTADISTICAS DE PRODUCCION Y RENDIMIENTO
// =====================================================================

export interface StatisticsFilters {
  period: 'today' | 'week' | 'month' | 'custom';
  dateFrom?: string;  // ISO date string YYYY-MM-DD
  dateTo?: string;
  modality?: string;
  institutionId?: number;
  radiologistUsername?: string;
}

export interface DayStudyRow {
  study_date: string;
  total: number;
  informed: number;
  pending: number;
}

export interface ModalityRow {
  modality: string;
  total: number;
  informed: number;
}

export interface InstitutionRow {
  institution_name: string;
  total: number;
  informed: number;
}

export interface SLASummaryRow {
  on_time: number;
  overdue: number;
  total: number;
}

export interface StatsSummaryRow {
  total: number;
  informed: number;
  pending: number;
  urgent: number;
  validated: number;
}

export interface StatisticsData {
  summary: StatsSummaryRow;
  byDay: DayStudyRow[];
  byModality: ModalityRow[];
  byInstitution: InstitutionRow[];
  sla: SLASummaryRow;
}

/**
 * Construye el filtro de fecha para las queries de estadisticas.
 * Soporta: today, week, month, custom (dateFrom/dateTo).
 */
function buildStatsDateFilter(filters: StatisticsFilters): Prisma.Sql {
  if (filters.period === 'today') {
    return Prisma.sql`fechaexamen >= CAST(GETDATE() AS DATE)`;
  }
  if (filters.period === 'week') {
    return Prisma.sql`fechaexamen >= DATEADD(day, -7, CAST(GETDATE() AS DATE))`;
  }
  if (filters.period === 'month') {
    return Prisma.sql`fechaexamen >= CAST(DATEADD(day, 1-DAY(GETDATE()), CAST(GETDATE() AS DATE)) AS DATE)`;
  }
  if (filters.period === 'custom' && filters.dateFrom && filters.dateTo) {
    return Prisma.sql`fechaexamen >= ${filters.dateFrom} AND fechaexamen <= DATEADD(day, 1, CAST(${filters.dateTo} AS DATE))`;
  }
  // Fallback: mes actual
  return Prisma.sql`fechaexamen >= CAST(DATEADD(day, 1-DAY(GETDATE()), CAST(GETDATE() AS DATE)) AS DATE)`;
}

/**
 * getStatisticsData — Dashboard de estadisticas de produccion y rendimiento.
 *
 * Ejecuta 4 queries en paralelo:
 * 1. Resumen KPI (total, informados, pendientes, urgentes)
 * 2. Estudios por dia (para grafico de barras)
 * 3. Estudios por modalidad (para grafico de barras horizontales)
 * 4. Cumplimiento SLA aproximado (estudios en tiempo vs. vencidos)
 */
export async function getStatisticsData(
  filters: StatisticsFilters
): Promise<StatisticsData> {
  const dateFilter = buildStatsDateFilter(filters);

  // Condiciones adicionales (modalidad, institucion, radiologo)
  const extraConditions: Prisma.Sql[] = [];
  if (filters.modality) {
    extraConditions.push(Prisma.sql`modalidad = ${filters.modality}`);
  }
  if (filters.institutionId) {
    extraConditions.push(Prisma.sql`id_institucion = ${filters.institutionId}`);
  }
  if (filters.radiologistUsername) {
    extraConditions.push(Prisma.sql`usernameRadiologo = ${filters.radiologistUsername}`);
  }

  const extraWhere = extraConditions.length > 0
    ? Prisma.sql` AND ${Prisma.join(extraConditions, ' AND ')}`
    : Prisma.sql``;

  // ── 1. Resumen KPI ──────────────────────────────────────────────
  const summaryQuery = prisma.$queryRaw<StatsSummaryRow[]>`
    SELECT
      COUNT(*)                                                             AS total,
      COUNT(CASE WHEN LOWER(nombre_estado_examen) LIKE '%inform%'
                   OR LOWER(nombre_estado_examen) LIKE '%valid%'  THEN 1 END) AS informed,
      COUNT(CASE WHEN LOWER(nombre_estado_examen) LIKE '%pend%'   THEN 1 END) AS pending,
      COUNT(CASE WHEN LOWER(nombre_tipo_urgencia) LIKE '%urg%'    THEN 1 END) AS urgent,
      COUNT(CASE WHEN LOWER(nombre_estado_examen) LIKE '%valid%'  THEN 1 END) AS validated
    FROM View_Busqueda_Examen
    WHERE ${dateFilter} ${extraWhere}
  `;

  // ── 2. Estudios por dia (ultimos 31 dias maximo) ─────────────────
  const byDayQuery = prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      CAST(fechaexamen AS DATE)                                            AS study_date,
      COUNT(*)                                                             AS total,
      COUNT(CASE WHEN LOWER(nombre_estado_examen) LIKE '%inform%'
                   OR LOWER(nombre_estado_examen) LIKE '%valid%'  THEN 1 END) AS informed,
      COUNT(CASE WHEN LOWER(nombre_estado_examen) LIKE '%pend%'   THEN 1 END) AS pending
    FROM View_Busqueda_Examen
    WHERE ${dateFilter} ${extraWhere}
    GROUP BY CAST(fechaexamen AS DATE)
    ORDER BY study_date ASC
  `;

  // ── 3. Estudios por modalidad ────────────────────────────────────
  const byModalityQuery = prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      modalidad                                                            AS modality,
      COUNT(*)                                                             AS total,
      COUNT(CASE WHEN LOWER(nombre_estado_examen) LIKE '%inform%'
                   OR LOWER(nombre_estado_examen) LIKE '%valid%'  THEN 1 END) AS informed
    FROM View_Busqueda_Examen
    WHERE ${dateFilter} ${extraWhere}
    GROUP BY modalidad
    ORDER BY total DESC
  `;

  // ── 4. Estudios por institucion ──────────────────────────────────
  const byInstitutionQuery = prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      ISNULL(institucion, 'Sin Institucion')                               AS institution_name,
      COUNT(*)                                                             AS total,
      COUNT(CASE WHEN LOWER(nombre_estado_examen) LIKE '%inform%'
                   OR LOWER(nombre_estado_examen) LIKE '%valid%'  THEN 1 END) AS informed
    FROM View_Busqueda_Examen
    WHERE ${dateFilter} ${extraWhere}
    GROUP BY institucion
    ORDER BY total DESC
  `;

  // ── 5. Cumplimiento SLA (aproximacion por tiempo transcurrido) ───
  // SLA aproximado: URGENCIA = 60 min, NORMAL = 240 min, CRITICO = 30 min
  // Compara fechaexamen con fechavalidacion (o GETDATE() si no esta validado)
  const slaQuery = prisma.$queryRaw<SLASummaryRow[]>`
    SELECT
      COUNT(CASE WHEN
        (LOWER(nombre_tipo_urgencia) LIKE '%critic%' AND DATEDIFF(minute, fechaexamen, ISNULL(fechavalidacion, GETDATE())) <= 30)
        OR (LOWER(nombre_tipo_urgencia) LIKE '%urg%'
            AND LOWER(nombre_tipo_urgencia) NOT LIKE '%critic%'
            AND DATEDIFF(minute, fechaexamen, ISNULL(fechavalidacion, GETDATE())) <= 60)
        OR (LOWER(nombre_tipo_urgencia) NOT LIKE '%urg%'
            AND DATEDIFF(minute, fechaexamen, ISNULL(fechavalidacion, GETDATE())) <= 240)
      THEN 1 END) AS on_time,
      COUNT(CASE WHEN
        (LOWER(nombre_tipo_urgencia) LIKE '%critic%' AND DATEDIFF(minute, fechaexamen, ISNULL(fechavalidacion, GETDATE())) > 30)
        OR (LOWER(nombre_tipo_urgencia) LIKE '%urg%'
            AND LOWER(nombre_tipo_urgencia) NOT LIKE '%critic%'
            AND DATEDIFF(minute, fechaexamen, ISNULL(fechavalidacion, GETDATE())) > 60)
        OR (LOWER(nombre_tipo_urgencia) NOT LIKE '%urg%'
            AND DATEDIFF(minute, fechaexamen, ISNULL(fechavalidacion, GETDATE())) > 240)
      THEN 1 END) AS overdue,
      COUNT(*) AS total
    FROM View_Busqueda_Examen
    WHERE ${dateFilter} ${extraWhere}
  `;

  // Ejecutar todo en paralelo
  const [summaryRows, dayRows, modalityRows, institutionRows, slaRows] = await Promise.all([
    summaryQuery,
    byDayQuery,
    byModalityQuery,
    byInstitutionQuery,
    slaQuery,
  ]);

  const summary = summaryRows[0] ?? { total: 0, informed: 0, pending: 0, urgent: 0, validated: 0 };

  return {
    summary: {
      total:     Number(summary.total     ?? 0),
      informed:  Number(summary.informed  ?? 0),
      pending:   Number(summary.pending   ?? 0),
      urgent:    Number(summary.urgent    ?? 0),
      validated: Number(summary.validated ?? 0),
    },
    byDay: dayRows.map((r) => ({
      study_date: String(r.study_date ?? '').split('T')[0],
      total:      Number(r.total     ?? 0),
      informed:   Number(r.informed  ?? 0),
      pending:    Number(r.pending   ?? 0),
    })),
    byModality: modalityRows.map((r) => ({
      modality: String(r.modality ?? 'Desconocida'),
      total:    Number(r.total    ?? 0),
      informed: Number(r.informed ?? 0),
    })),
    byInstitution: institutionRows.map((r) => ({
      institution_name: String(r.institution_name ?? 'Sin Centro'),
      total:            Number(r.total            ?? 0),
      informed:         Number(r.informed         ?? 0),
    })),
    sla: {
      on_time: Number(slaRows[0]?.on_time ?? 0),
      overdue: Number(slaRows[0]?.overdue ?? 0),
      total:   Number(slaRows[0]?.total   ?? 0),
    },
  };
}
