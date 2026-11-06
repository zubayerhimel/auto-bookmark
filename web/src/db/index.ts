import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Supabase Postgres. Use the pooled "Transaction" connection string on Vercel.
 * POSTGRES_URL is what the Vercel Supabase integration sets.
 */
export function databaseUrl() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  const url = new URL(raw);
  url.searchParams.delete("supa"); // integration-only marker that Postgres rejects
  return url.toString();
}

const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };
const client =
  globalForDb.pgClient ??
  // prepare: false is required by Supabase's transaction pooler.
  postgres(databaseUrl(), { max: process.env.VERCEL ? 5 : 10, prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema, casing: "snake_case" });
export { schema };
