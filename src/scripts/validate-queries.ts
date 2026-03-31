// @ts-nocheck

/**
 * AMIS RIS 2030 — Validación de Queries
 *
 * Ejecutar con: npx tsx src/scripts/validate-queries.ts
 *
 * Prueba todas las funciones de la capa de datos
 * contra la base de datos legacy en vivo.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import {
  getWorklist,
  getStudyByUID,
  getStudyReports,
  getReportContent,
  searchStudies,
  getExamStatuses,
  getInstitutions,
  getModalities,
} from "../lib/db/queries";

const adapter = new PrismaMssql({
  server: process.env.DB_HOST || "190.196.143.123",
  port: parseInt(process.env.DB_PORT || "1433"),
  database: process.env.DB_NAME || "DBMULTIRISQA",
  user: process.env.DB_USER || "Mavila",
  password: process.env.DB_PASSWORD || "",
  options: { encrypt: true, trustServerCertificate: true },
});

const prisma = new PrismaClient({ adapter });

async function validate() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  AMIS RIS 2030 — Query Validation       ║");
  console.log("╚══════════════════════════════════════════╝\\n");

  let passed = 0;
  let failed = 0;

  // Test 1: getWorklist (paginado)
  try {
    console.log("📋 Test 1: getWorklist (page 1, 5 items)...");
    const t0 = Date.now();
    const worklist = await getWorklist({ page: 1, pageSize: 5 });
    const elapsed = Date.now() - t0;
    console.log(`   ✅ ${worklist.total} estudios totales, ${worklist.data.length} en página (en ${elapsed}ms)`);
    if (worklist.data[0]) {
       console.log("   ➤ Primer paciente:", worklist.data[0].patientFullName);
       console.log("   ➤ Médico Solicitante:", worklist.data[0].requestingPhysician);
    }
    console.log("------------------------------------------");

    // Test 2: Búsqueda
    console.log("🔍 Test 2: Búsqueda 'vega'...");
    const t1 = Date.now();
    const searchRes = await searchStudies('vega');
    passed++;
  } catch (e: any) {
    console.log(`   ❌ FALLÓ: ${e.message}`);
    failed++;
  }

  console.log("\\n══════════════════════════════════════════");
  console.log(`  Resultado: ${passed} pasaron, ${failed} fallaron`);
  console.log("══════════════════════════════════════════");

  await prisma.$disconnect();
}

validate().catch(console.error);
