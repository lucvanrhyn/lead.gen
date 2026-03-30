import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool, type PoolConfig } from "pg";

export const DEFAULT_DATABASE_URL =
  "postgresql://lead_intelligence:lead_intelligence@localhost:5432/lead_intelligence";
const DEFAULT_PRODUCTION_DATABASE_POOL_MAX = 1;
const DEFAULT_DEVELOPMENT_DATABASE_POOL_MAX = 5;

type DatabaseEnv = {
  DATABASE_URL?: string;
  DATABASE_POOL_MAX?: string;
  NODE_ENV?: string;
};

export function getDatabaseConnectionString(env: DatabaseEnv = process.env) {
  const configured = env.DATABASE_URL?.trim();

  if (!configured) {
    return DEFAULT_DATABASE_URL;
  }

  return configured.replace(/^DATABASE_URL=/, "");
}

function resolveDatabasePoolMax(env: DatabaseEnv) {
  const configured = Number.parseInt(env.DATABASE_POOL_MAX?.trim() ?? "", 10);

  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return env.NODE_ENV === "production"
    ? DEFAULT_PRODUCTION_DATABASE_POOL_MAX
    : DEFAULT_DEVELOPMENT_DATABASE_POOL_MAX;
}

export function getDatabasePoolConfig(env: DatabaseEnv = process.env): PoolConfig {
  return {
    connectionString: getDatabaseConnectionString(env),
    max: resolveDatabasePoolMax(env),
    idleTimeoutMillis: env.NODE_ENV === "production" ? 5_000 : 10_000,
    allowExitOnIdle: env.NODE_ENV !== "production",
  };
}

const globalForDatabasePool = globalThis as typeof globalThis & {
  prismaPool?: Pool;
};

function getPrismaPool(env: DatabaseEnv = process.env) {
  if (env.NODE_ENV === "production") {
    return new Pool(getDatabasePoolConfig(env));
  }

  globalForDatabasePool.prismaPool ??= new Pool(getDatabasePoolConfig(env));
  return globalForDatabasePool.prismaPool;
}

export function createPrismaAdapter(env: DatabaseEnv = process.env) {
  return new PrismaPg(getPrismaPool(env));
}

export function createPrismaClient(env: DatabaseEnv = process.env) {
  return new PrismaClient({
    adapter: createPrismaAdapter(env),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}
