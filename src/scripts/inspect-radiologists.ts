/**
 * AMIS RIS 2030 — Nombres reales de radiólogos (SOLO LECTURA)
 * Cruza los radiólogos activos con la tabla 'usuario' del Multiris.
 * Ejecutar con: npx tsx src/scripts/inspect-radiologists.ts
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
  console.log("=== Nombres reales de radiólogos (solo lectura) ===\n");
  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT u.username, u.nombre, u.apellido_paterno, u.apellido_materno
      FROM usuario u
      WHERE u.username IN (
        SELECT DISTINCT usernameRadiologo
        FROM View_Busqueda_Examen
        WHERE usernameRadiologo IS NOT NULL
          AND usernameRadiologo <> ''
          AND fechaexamen >= DATEADD(year, -1, GETDATE())
      )
      ORDER BY u.apellido_paterno, u.nombre
    `;
    console.log(`Total: ${rows.length}\n`);
    for (const r of rows) {
      console.log(`${r.username}\t${r.nombre} ${r.apellido_paterno} ${r.apellido_materno}`);
    }
  } catch (error: any) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();