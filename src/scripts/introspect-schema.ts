/**
 * AMIS RIS 2030 — Schema Discovery Script (SOLO LECTURA)
 * Ejecutar con: npx tsx src/scripts/introspect-schema.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const adapter = new PrismaMssql({
  server: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT || "1433"),
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD || "",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
});

const prisma = new PrismaClient({ adapter });

interface TableInfo { TABLE_SCHEMA: string; TABLE_NAME: string; TABLE_TYPE: string; }
interface ColumnInfo { TableName: string; ColumnName: string; DataType: string; }
interface TableCandidate { TableName: string; }
interface ColumnDetail { COLUMN_NAME: string; DATA_TYPE: string; CHARACTER_MAXIMUM_LENGTH: number | null; IS_NULLABLE: string; }

async function discoverSchema() {
  console.log("=== AMIS RIS 2030 — Schema Discovery ===");
  console.log(`Target: ${process.env.DB_NAME}\n`);

  const tables: TableInfo[] = await prisma.$queryRaw`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_SCHEMA, TABLE_NAME
  `;
  console.log(`Total de tablas: ${tables.length}\n`);
  console.log("--- TABLAS ---");
  for (const t of tables) console.log(`  [${t.TABLE_SCHEMA}].${t.TABLE_NAME}`);

  const risColumns: ColumnInfo[] = await prisma.$queryRaw`
    SELECT t.name AS TableName, c.name AS ColumnName, ty.name AS DataType
    FROM sys.tables t
    JOIN sys.columns c ON t.object_id = c.object_id
    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    WHERE c.name LIKE '%Patient%' OR c.name LIKE '%Study%' OR c.name LIKE '%Accession%'
       OR c.name LIKE '%Modality%' OR c.name LIKE '%Report%' OR c.name LIKE '%InstanceUID%'
       OR c.name LIKE '%Paciente%' OR c.name LIKE '%Estudio%' OR c.name LIKE '%Informe%'
       OR c.name LIKE '%Modalidad%'
    ORDER BY t.name, c.name
  `;
  console.log("\n--- COLUMNAS CLAVE RIS ---");
  let currentTable = "";
  for (const col of risColumns) {
    if (col.TableName !== currentTable) {
      currentTable = col.TableName;
      console.log(`\n  ${currentTable}`);
    }
    console.log(`     - ${col.ColumnName} (${col.DataType})`);
  }

  const views: TableInfo[] = await prisma.$queryRaw`
    SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'VIEW'
    ORDER BY TABLE_NAME
  `;
  if (views.length > 0) {
    console.log(`\n--- VISTAS (${views.length}) ---`);
    for (const v of views) console.log(`  [${v.TABLE_SCHEMA}].${v.TABLE_NAME}`);
  }

  await prisma.$disconnect();
  console.log("\nDescubrimiento completado.");
}

discoverSchema().catch(console.error);