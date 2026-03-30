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
  console.log("╚══════════════════════════════════════════╝\n");

  let passed = 0;
  let failed = 0;

  // Test 1: getWorklist (paginado)
  try {
    console.log("📋 Test 1: getWorklist (page 1, 5 items)...");
    const t0 = Date.now();
    const worklist = await getWorklist(prisma, { page: 1, pageSize: 5 });
    const elapsed = Date.now() - t0;
    console.log(`   ✅ ${worklist.total} estudios totales, ${worklist.data.length} en página (${elapsed}ms)`);
    if (worklist.data[0]) {
      const s = worklist.data[0];
      console.log(`   ├── UID: ${s.studyInstanceUID.substring(0, 40)}...`);
      console.log(`   ├── Paciente: ${s.patientFullName}`);
      console.log(`   ├── Modalidad: ${s.modality}`);
      console.log(`   ├── Estado: ${s.examStatus}`);
      console.log(`   └── Institución: ${s.institutionName}`);
    }
    passed++;
  } catch (e: any) {
    console.log(`   ❌ FALLÓ: ${e.message}`);
    failed++;
  }

  // Test 2: getWorklist con filtro de modalidad
  try {
    console.log("\n🔍 Test 2: getWorklist filtrado (CT only)...");
    const t0 = Date.now();
    const ctWorklist = await getWorklist(
      prisma,
      { page: 1, pageSize: 3 },
      { modality: "CT" }
    );
    const elapsed = Date.now() - t0;
    console.log(`   ✅ ${ctWorklist.total} estudios CT, ${ctWorklist.data.length} en página (${elapsed}ms)`);
    const allCT = ctWorklist.data.every((s) => s.modality === "CT");
    console.log(`   └── Filtro correcto: ${allCT ? "✅" : "❌"}`);
    passed++;
  } catch (e: any) {
    console.log(`   ❌ FALLÓ: ${e.message}`);
    failed++;
  }

  // Test 3: getStudyByUID
  try {
    console.log("\n🎯 Test 3: getStudyByUID...");
    // Primero obtenemos un UID válido del worklist
    const worklist = await getWorklist(prisma, { page: 1, pageSize: 1 });
    if (worklist.data[0]) {
      const uid = worklist.data[0].studyInstanceUID;
      const t0 = Date.now();
      const study = await getStudyByUID(prisma, uid);
      const elapsed = Date.now() - t0;
      if (study) {
        console.log(`   ✅ Encontrado en ${elapsed}ms`);
        console.log(`   ├── ${study.patientFullName} (${study.patientId})`);
        console.log(`   ├── ${study.modality} - ${study.studyDescription}`);
        console.log(`   └── ${study.institutionName} [${study.examStatus}]`);
        passed++;
      } else {
        console.log(`   ❌ No encontrado`);
        failed++;
      }
    }
  } catch (e: any) {
    console.log(`   ❌ FALLÓ: ${e.message}`);
    failed++;
  }

  // Test 4: searchStudies (typeahead por nombre)
  try {
    console.log("\n⚡ Test 4: searchStudies (typeahead por nombre)...");
    const t0 = Date.now();
    const results = await searchStudies(prisma, { query: "MARTINEZ", limit: 5 });
    const elapsed = Date.now() - t0;
    console.log(`   ✅ ${results.length} resultados en ${elapsed}ms ${elapsed < 100 ? "🚀 < 100ms!" : "⚠️  > 100ms"}`);
    for (const r of results.slice(0, 3)) {
      console.log(`   ├── ${r.patientFullName} | ${r.patientId} | ${r.modality}`);
    }
    passed++;
  } catch (e: any) {
    console.log(`   ❌ FALLÓ: ${e.message}`);
    failed++;
  }

  // Test 5: searchStudies (typeahead por RUT)
  try {
    console.log("\n⚡ Test 5: searchStudies (typeahead por RUT)...");
    const t0 = Date.now();
    const results = await searchStudies(prisma, { query: "11986794", limit: 5 });
    const elapsed = Date.now() - t0;
    console.log(`   ✅ ${results.length} resultados en ${elapsed}ms ${elapsed < 100 ? "🚀 < 100ms!" : ""}`);
    for (const r of results.slice(0, 3)) {
      console.log(`   ├── ${r.patientFullName} | ${r.patientId}`);
    }
    passed++;
  } catch (e: any) {
    console.log(`   ❌ FALLÓ: ${e.message}`);
    failed++;
  }

  // Test 6: Catálogos
  try {
    console.log("\n📚 Test 6: Catálogos...");
    const statuses = await getExamStatuses(prisma);
    console.log(`   ✅ Estados de examen: ${statuses.length}`);
    for (const s of statuses) {
      console.log(`   ├── [${s.id_estado_examen}] ${s.nombre} (${s.codigo})`);
    }

    const institutions = await getInstitutions(prisma);
    console.log(`   ✅ Instituciones activas: ${institutions.length}`);

    const modalities = await getModalities(prisma);
    console.log(`   ✅ Modalidades activas: ${modalities.length}`);
    for (const m of modalities) {
      console.log(`   ├── ${m.descripcion} (${m.nombre})`);
    }
    passed++;
  } catch (e: any) {
    console.log(`   ❌ FALLÓ: ${e.message}`);
    failed++;
  }

  // Test 7: getStudyReports
  try {
    console.log("\n📄 Test 7: getStudyReports...");
    const worklist = await getWorklist(prisma, { page: 1, pageSize: 1 }, { examStatusId: 3 }); // Status "Validado"
    if (worklist.data[0]) {
      const uid = worklist.data[0].studyInstanceUID;
      const t0 = Date.now();
      const reports = await getStudyReports(prisma, uid);
      const elapsed = Date.now() - t0;
      console.log(`   ✅ ${reports.length} informe(s) encontrados en ${elapsed}ms`);
      if (reports[0]) {
        const content = await getReportContent(prisma, reports[0].id);
        console.log(`   └── Contenido del informe: ${content.length} secciones`);
        if (content[0]) {
          const preview = content[0].content.substring(0, 80);
          console.log(`       └── Preview: "${preview}..."`);
        }
      }
      passed++;
    }
  } catch (e: any) {
    console.log(`   ❌ FALLÓ: ${e.message}`);
    failed++;
  }

  console.log("\n══════════════════════════════════════════");
  console.log(`  Resultado: ${passed} pasaron, ${failed} fallaron`);
  console.log("══════════════════════════════════════════");

  await prisma.$disconnect();
}

validate().catch(console.error);
