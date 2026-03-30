import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export const DEFAULT_DATABASE_URL =
  "postgresql://lead_intelligence:lead_intelligence@localhost:5432/lead_intelligence";

type DatabaseEnv = {
  DATABASE_URL?: string;
  NODE_ENV?: string;
};

export function getDatabaseConnectionString(env: DatabaseEnv = process.env) {
  const configured = env.DATABASE_URL?.trim();

  if (!configured) {
    return DEFAULT_DATABASE_URL;
  }

  return configured.replace(/^DATABASE_URL=/, "");
}

export function createPrismaAdapter(env: DatabaseEnv = process.env) {
  return new PrismaPg({
    connectionString: getDatabaseConnectionString(env),
  });
}

export function createPrismaClient(env: DatabaseEnv = process.env) {
  return new PrismaClient({
    adapter: createPrismaAdapter(env),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}
