import PgBoss from "pg-boss";

const globalForBoss = globalThis as typeof globalThis & {
  boss?: PgBoss;
};

function createBoss() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for pg-boss.");
  }

  return new PgBoss({
    connectionString: process.env.DATABASE_URL,
    schema: process.env.PG_BOSS_SCHEMA ?? "pgboss",
  });
}

export const boss = globalForBoss.boss ?? createBoss();

if (process.env.NODE_ENV !== "production") {
  globalForBoss.boss = boss;
}
