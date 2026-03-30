/**
 * AMIS RIS 2030 — Connectivity Test
 *
 * Ejecutar con: npx tsx src/scripts/test-connection.ts
 *
 * Verifica:
 * 1. Conexión TCP al servidor SQL Server
 * 2. Autenticación con las credenciales
 * 3. Acceso de lectura a la base DBMULTIRISQA
 * 4. Query de prueba (SELECT 1 + conteo de tablas)
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

const prisma = new PrismaClient({
  adapter,
  log: ["query", "info", "warn", "error"],
});

async function testConnection() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  AMIS RIS 2030 — Connectivity Test      ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const startTime = Date.now();

  try {
    // Test 1: Conexión básica
    console.log("🔌 Test 1: Conexión al servidor...");
    await prisma.$queryRaw`SELECT 1 AS connected`;
    console.log("   ✅ Conexión exitosa\n");

    // Test 2: Verificar base de datos
    console.log("🗄️  Test 2: Verificando base de datos...");
    const dbName: any[] = await prisma.$queryRaw`SELECT DB_NAME() AS DatabaseName`;
    console.log(`   ✅ Conectado a: ${dbName[0].DatabaseName}\n`);

    // Test 3: Contar tablas accesibles
    console.log("📋 Test 3: Tablas accesibles...");
    const tableCount: any[] = await prisma.$queryRaw`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
    `;
    console.log(`   ✅ Tablas accesibles: ${tableCount[0].total}\n`);

    // Test 4: Verificar permisos de lectura
    console.log("🔒 Test 4: Permisos del usuario...");
    const permissions: any[] = await prisma.$queryRaw`
      SELECT
        HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'SELECT') AS CanSelect,
        HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'INSERT') AS CanInsert,
        HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'UPDATE') AS CanUpdate,
        HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'DELETE') AS CanDelete
    `;
    const perms = permissions[0];
    console.log(`   SELECT: ${perms.CanSelect ? "✅" : "❌"}`);
    console.log(
      `   INSERT: ${perms.CanInsert ? "⚠️  (tiene permiso)" : "✅ bloqueado"}`
    );
    console.log(
      `   UPDATE: ${perms.CanUpdate ? "⚠️  (tiene permiso)" : "✅ bloqueado"}`
    );
    console.log(
      `   DELETE: ${perms.CanDelete ? "⚠️  (tiene permiso)" : "✅ bloqueado"}`
    );

    const elapsed = Date.now() - startTime;
    console.log(`\n⏱️  Latencia total: ${elapsed}ms`);
    console.log("🎉 Todos los tests pasaron correctamente.");
  } catch (error: any) {
    console.error("\n❌ Error de conexión:");
    console.error(`   Código: ${error.code || "N/A"}`);
    console.error(`   Mensaje: ${error.message}`);

    if (error.message?.includes("ECONNREFUSED")) {
      console.error(
        "\n💡 Sugerencia: Verifica que el puerto 1433 esté abierto y accesible."
      );
      console.error("   Intenta: telnet 190.196.143.123 1433");
    }
    if (error.message?.includes("Login failed")) {
      console.error(
        "\n💡 Sugerencia: Verifica usuario y contraseña en el .env"
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
