/**
 * AMIS RIS 2030 — Schema Discovery Script
 *
 * Ejecutar con: npx tsx src/scripts/introspect-schema.ts
 *
 * Este script:
 * 1. Lista TODAS las tablas del schema 'dbo'
 * 2. Busca columnas clave RIS (StudyInstanceUID, PatientID, etc.)
 * 3. Genera un reporte de mapeo tabla → entidad
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql({
  server: "190.196.143.123",
  port: 1433,
  database: "DBMULTIRISQA",
  user: "Mavila",
  password: process.env.DB_PASSWORD || "",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
});

const prisma = new PrismaClient({ adapter });

interface TableInfo {
  TABLE_SCHEMA: string;
  TABLE_NAME: string;
  TABLE_TYPE: string;
}

interface ColumnInfo {
  TableName: string;
  ColumnName: string;
  DataType: string;
}

interface TableCandidate {
  TableName: string;
}

interface ColumnDetail {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  IS_NULLABLE: string;
}

async function discoverSchema() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  AMIS RIS 2030 — Schema Discovery       ║");
  console.log("║  Target: DBMULTIRISQA                    ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // 1. Listar todas las tablas
  const tables: TableInfo[] = await prisma.$queryRaw`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `;

  console.log(`📋 Total de tablas encontradas: ${tables.length}\n`);
  console.log("─── TABLAS ───────────────────────────────");
  for (const t of tables) {
    console.log(`  [${t.TABLE_SCHEMA}].${t.TABLE_NAME}`);
  }

  // 2. Buscar columnas clave de RIS
  const risColumns: ColumnInfo[] = await prisma.$queryRaw`
    SELECT t.name AS TableName, c.name AS ColumnName, ty.name AS DataType
    FROM sys.tables t
    JOIN sys.columns c ON t.object_id = c.object_id
    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    WHERE c.name LIKE '%Patient%'
       OR c.name LIKE '%Study%'
       OR c.name LIKE '%Accession%'
       OR c.name LIKE '%Modality%'
       OR c.name LIKE '%Report%'
       OR c.name LIKE '%InstanceUID%'
       OR c.name LIKE '%ReferringPhysician%'
       OR c.name LIKE '%Paciente%'
       OR c.name LIKE '%Estudio%'
       OR c.name LIKE '%Informe%'
       OR c.name LIKE '%Modalidad%'
    ORDER BY t.name, c.name
  `;

  console.log("\n─── COLUMNAS CLAVE RIS ───────────────────");
  let currentTable = "";
  for (const col of risColumns) {
    if (col.TableName !== currentTable) {
      currentTable = col.TableName;
      console.log(`\n  📁 ${currentTable}`);
    }
    console.log(`     ├── ${col.ColumnName} (${col.DataType})`);
  }

  // 3. Buscar tablas candidatas para las entidades principales
  console.log("\n─── CANDIDATOS POR ENTIDAD ───────────────");

  const patientTables: TableCandidate[] = await prisma.$queryRaw`
    SELECT DISTINCT t.name AS TableName
    FROM sys.tables t
    WHERE t.name LIKE '%Patient%' OR t.name LIKE '%Paciente%'
    ORDER BY t.name
  `;
  console.log("\n  🎯 Pacientes:");
  for (const c of patientTables) console.log(`     → ${c.TableName}`);

  const studyTables: TableCandidate[] = await prisma.$queryRaw`
    SELECT DISTINCT t.name AS TableName
    FROM sys.tables t
    WHERE t.name LIKE '%Study%' OR t.name LIKE '%Estudio%' OR t.name LIKE '%Exam%'
    ORDER BY t.name
  `;
  console.log("\n  🎯 Estudios:");
  for (const c of studyTables) console.log(`     → ${c.TableName}`);

  const reportTables: TableCandidate[] = await prisma.$queryRaw`
    SELECT DISTINCT t.name AS TableName
    FROM sys.tables t
    WHERE t.name LIKE '%Report%' OR t.name LIKE '%Informe%' OR t.name LIKE '%Result%'
    ORDER BY t.name
  `;
  console.log("\n  🎯 Informes:");
  for (const c of reportTables) console.log(`     → ${c.TableName}`);

  // 4. Detalle de columnas de las tablas más relevantes
  console.log("\n─── DETALLE DE TABLAS PRINCIPALES ────────");

  // Encontrar las tablas que contienen StudyInstanceUID
  const uidTables: TableCandidate[] = await prisma.$queryRaw`
    SELECT DISTINCT t.name AS TableName
    FROM sys.tables t
    JOIN sys.columns c ON t.object_id = c.object_id
    WHERE c.name LIKE '%StudyInstanceUID%' OR c.name LIKE '%InstanceUID%'
  `;

  console.log("\n  🔑 Tablas con InstanceUID:");
  for (const t of uidTables) {
    console.log(`\n  📁 ${t.TableName} (columnas completas):`);
    const cols: ColumnDetail[] = await prisma.$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = ${t.TableName}
      ORDER BY ORDINAL_POSITION
    `;
    for (const c of cols) {
      const nullable = c.IS_NULLABLE === "YES" ? "NULL" : "NOT NULL";
      const length = c.CHARACTER_MAXIMUM_LENGTH
        ? `(${c.CHARACTER_MAXIMUM_LENGTH})`
        : "";
      console.log(
        `     ├── ${c.COLUMN_NAME}: ${c.DATA_TYPE}${length} ${nullable}`
      );
    }
  }

  // 5. Buscar vistas (pueden tener datos consolidados)
  const views: TableInfo[] = await prisma.$queryRaw`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'VIEW'
    ORDER BY TABLE_NAME
  `;

  if (views.length > 0) {
    console.log(`\n─── VISTAS (${views.length}) ────────────────────────`);
    for (const v of views) {
      console.log(`  [${v.TABLE_SCHEMA}].${v.TABLE_NAME}`);
    }
  }

  await prisma.$disconnect();
  console.log("\n✅ Descubrimiento completado.");
}

discoverSchema().catch(console.error);
