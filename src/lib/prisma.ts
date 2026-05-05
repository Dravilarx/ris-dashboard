import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaMssql({
    server: process.env.DB_HOST || "190.196.143.123",
    port: parseInt(process.env.DB_PORT || "1433"),
    database: process.env.DB_NAME || "DBMULTIRISQA",
    user: process.env.DB_USER || "sa",
    password: process.env.DB_PASSWORD || ".R1spAc52020.",
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ⚠️ IMPORTANTE: Este cliente es EXCLUSIVAMENTE de lectura.
// No ejecutar create/update/delete contra la DB legacy.
