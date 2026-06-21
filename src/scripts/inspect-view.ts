/**
 * AMIS RIS 2030 — Inspección de columnas (SOLO LECTURA)
 * Lee la estructura de la vista View_Busqueda_Examen.
 * No modifica nada: solo ejecuta SELECT sobre el catálogo del sistema.
 * Ejecutar con: npx tsx src/scripts/inspect-view.ts
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

async function inspectView() {
  console.log("=== Columnas de View_Busqueda_Examen (solo lectura) ===\n");
  try {
    const columns: any[] = await prisma.$queryRaw`
      SELECT
        ORDINAL_POSITION AS pos,
        COLUMN_NAME      AS nombre,
        DATA_TYPE        AS tipo,
        CHARACTER_MAXIMUM_LENGTH AS largo,
        IS_NULLABLE      AS nullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'View_Busqueda_Examen'
      ORDER BY ORDINAL_POSITION
    `;

    if (columns.length === 0) {
      console.log("No se encontro la vista 'View_Busqueda_Examen'.");
      console.log("Puede que haya cambiado de nombre con la migracion.");
    } else {
      console.log(`Total de columnas: ${columns.length}\n`);
      for (const c of columns) {
        const largo = c.largo ? `(${c.largo})` : "";
        const nul = c.nullable === "YES" ? "(nullable)" : "";
        console.log(`${String(c.pos).padStart(3)}  ${c.nombre}  -  ${c.tipo}${largo}  ${nul}`);
      }
    }
  } catch (error: any) {
    console.error("Error al leer la estructura:");
    console.error(`   ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

inspectView();