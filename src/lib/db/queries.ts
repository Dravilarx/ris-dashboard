/**
 * AMIS RIS 2030 — Capa de Queries Read-Only
 *
 * Todas las queries se ejecutan contra la vista View_Busqueda_Examen
 * y las tablas ris_informe/ris_informe_dato para máximo rendimiento.
 *
 * Usa Prisma.$queryRaw (tagged template) para parametrización segura.
 * ⚠️ SOLO LECTURA — No ejecutar operaciones de escritura.
 */

import { PrismaClient, Prisma } from "@prisma/client";
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
  prisma: PrismaClient,
  pagination: PaginationParams = { page: 1, pageSize: 50 },
  filters: WorklistFilters = {}
): Promise<PaginatedResult<Study>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  // Construir fragmentos SQL dinámicos
  const conditions: Prisma.Sql[] = [Prisma.sql`1=1`];

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

  // Count total
  const countResult = await prisma.$queryRaw<{ total: number }[]>`
    SELECT COUNT(*) AS total FROM View_Busqueda_Examen WHERE ${whereClause}
  `;
  const total = Number(countResult[0]?.total ?? 0);

  // Fetch page — OFFSET/FETCH requiere SQL crudo para inyectar números
  const dataQuery = Prisma.sql`
    SELECT *
    FROM View_Busqueda_Examen
    WHERE ${whereClause}
    ORDER BY fechaexamen DESC
    OFFSET ${offset} ROWS
    FETCH NEXT ${pageSize} ROWS ONLY
  `;
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>(dataQuery);

  return {
    data: rows.map(mapRowToStudy),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * getStudyByUID — Detalle completo de un estudio por StudyInstanceUID (codexamen)
 */
export async function getStudyByUID(
  prisma: PrismaClient,
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
  prisma: PrismaClient,
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
  prisma: PrismaClient,
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
 * searchStudies — Búsqueda tipo typeahead por RUT, nombre o accession number
 *
 * Estrategia de detección automática:
 * - RUT (dígitos + guión): busca por idpaciente
 * - Numérico puro (5+ dígitos): busca por numeroacceso
 * - Texto: busca por nombre del paciente
 */
export async function searchStudies(
  prisma: PrismaClient,
  params: { query: string; limit?: number }
): Promise<SearchResult[]> {
  const { query, limit = 15 } = params;
  const cleanQuery = query.trim();

  if (cleanQuery.length < 2) return [];

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

/**
 * getExamStatuses — Catálogo de estados de examen
 */
export async function getExamStatuses(prisma: PrismaClient) {
  return prisma.ris_estado_examen.findMany({
    orderBy: { orden: "asc" },
  });
}

/**
 * getInstitutions — Catálogo de instituciones activas
 */
export async function getInstitutions(prisma: PrismaClient) {
  return prisma.institucion.findMany({
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
 * getModalities — Catálogo de modalidades activas
 */
export async function getModalities(prisma: PrismaClient) {
  return prisma.modalidad.findMany({
    where: { estado: 1 },
    orderBy: { nombre: "asc" },
  });
}
