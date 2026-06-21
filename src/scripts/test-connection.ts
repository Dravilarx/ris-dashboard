/**
 * AMIS RIS 2030 — Connectivity Test
 * Ejecutar con: npx tsx src/scripts/test-connection.ts
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

const prisma = new PrismaClient({
  adapter,
  log: ["query", "info", "warn", "error"],
});

async function testConnection() {
  console.log("=== Test de Conexion ===\n");
  const startTime = Date.now();

  try {
    console.log("Test 1: Conexion al servidor...");
    await prisma.$queryRaw`SELECT 1 AS connected`;
    console.log("   OK Conexion exitosa\n");

    console.log("Test 2: Verificando base de datos...");
    const dbName: any[] = await prisma.$queryRaw`SELECT DB_NAME() AS DatabaseName`;
    console.log(`   OK Conectado a: ${dbName[0].DatabaseName}\n`);

    console.log("Test 3: Tablas accesibles...");
    const tableCount: any[] = await prisma.$queryRaw`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
    `;
    console.log(`   OK Tablas accesibles: ${tableCount[0].total}\n`);

    console.log("Test 4: Permisos del usuario...");
    const permissions: any[] = await prisma.$queryRaw`
      SELECT
        HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'SELECT') AS CanSelect,
        HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'INSERT') AS CanInsert,
        HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'UPDATE') AS CanUpdate,
        HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'DELETE') AS CanDelete
    `;
    const perms = permissions[0];
    console.log(`   SELECT: ${perms.CanSelect ? "SI" : "NO"}`);
    console.log(`   INSERT: ${perms.CanInsert ? "tiene permiso (ojo)" : "bloqueado (bien)"}`);
    console.log(`   UPDATE: ${perms.CanUpdate ? "tiene permiso (ojo)" : "bloqueado (bien)"}`);
    console.log(`   DELETE: ${perms.CanDelete ? "tiene permiso (ojo)" : "bloqueado (bien)"}`);

    const elapsed = Date.now() - startTime;
    console.log(`\nLatencia total: ${elapsed}ms`);
    console.log("Todos los tests pasaron correctamente.");
  } catch (error: any) {
    console.error("\nError de conexion:");
    console.error(`   Mensaje: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();