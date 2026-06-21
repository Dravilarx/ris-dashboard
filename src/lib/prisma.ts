import { PrismaClient } from "@prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[prisma] Falta la variable de entorno ${name}. Configurala en .env (no hay valores por defecto).`
    );
  }
  return value;
}

function createPrismaClient() {
  const adapter = new PrismaMssql({
    server: requireEnv("DB_HOST"),
    port: parseInt(process.env.DB_PORT || "1433"),
    database: requireEnv("DB_NAME"),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// IMPORTANTE: Este cliente es EXCLUSIVAMENTE de lectura.
// No ejecutar create/update/delete contra la base de Multiris.