import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não está definida (veja .env.example).");
  }
  return drizzle(neon(url), { schema });
}

let cached: Db | undefined;

/** Conexão criada sob demanda, para o build não exigir o banco. */
export function getDb(): Db {
  return (cached ??= createDb());
}

export type Database = Db;
export * as tables from "./schema";
