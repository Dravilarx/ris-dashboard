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
  /** Tipo de urgencia */
  urgencyType?: string;
}

/** Parámetros de búsqueda typeahead */
export interface SearchParams {
  /** Término de búsqueda (RUT, nombre, accession number) */
  query: string;
  /** Máximo de resultados */
  limit?: number;
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
