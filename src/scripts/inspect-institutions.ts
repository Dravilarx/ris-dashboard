/**
 * AMIS RIS 2030 — Instituciones en el espejo (SOLO LECTURA)
 * Ejecutar con: npx tsx src/scripts/inspect-institutions.ts
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
  options: { encrypt: true, trustServerCertificate: true },
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== Instituciones en el espejo (solo lectura) ===\n");
  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT id_institucion, institucion, COUNT(*) AS examenes
      FROM View_Busqueda_Examen
      GROUP BY id_institucion, institucion
      ORDER BY COUNT(*) DESC
    `;
    console.log(`Total de instituciones: ${rows.length}\n`);
    for (const r of rows) {
      console.log(`${String(r.id_institucion).padStart(5)}  |  ${r.institucion}  |  ${r.examenes} examenes`);
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();