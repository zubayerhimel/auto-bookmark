import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  // fall back to the existing environment
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations need a direct or session-pooler connection (not the transaction pooler).
  dbCredentials: {
    url: (process.env.DIRECT_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL)!,
  },
  entities: { roles: { provider: "supabase" } },
});
