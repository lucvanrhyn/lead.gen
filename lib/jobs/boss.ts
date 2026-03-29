import PgBoss from "pg-boss";

import { getDatabaseConnectionString } from "@/lib/database-connection";

const globalForBoss = globalThis as typeof globalThis & {
  boss?: PgBoss;
};

function createBoss() {
  return new PgBoss({
    connectionString: getDatabaseConnectionString(),
    schema: process.env.PG_BOSS_SCHEMA ?? "pgboss",
  });
}

export const boss = globalForBoss.boss ?? createBoss();

if (process.env.NODE_ENV !== "production") {
  globalForBoss.boss = boss;
}
