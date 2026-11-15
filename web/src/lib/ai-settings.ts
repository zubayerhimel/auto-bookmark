import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AiProvider } from "@/db/schema";
import { configFor, serverConfig, type AiConfig } from "./ai";
import { open, seal } from "./secret-box";

export const AI_KEY_MISSING = "Add your AI key in Settings to get a summary.";

/** What the settings page shows about the saved key. Never includes the key itself. */
export async function getAiSettings(userId: string) {
  const [row] = await db
    .select({
      provider: schema.aiSettings.provider,
      keyHint: schema.aiSettings.keyHint,
      model: schema.aiSettings.model,
      updatedAt: schema.aiSettings.updatedAt,
    })
    .from(schema.aiSettings)
    .where(eq(schema.aiSettings.userId, userId))
    .limit(1);
  return row ?? null;
}

/** The user's own AI setup, else the server's shared key if the operator allows it, else null. */
export async function getAiConfig(userId: string): Promise<AiConfig | null> {
  const [row] = await db
    .select()
    .from(schema.aiSettings)
    .where(eq(schema.aiSettings.userId, userId))
    .limit(1);
  if (row) {
    try {
      return configFor(row.provider, open(row.apiKeyEncrypted), row.model);
    } catch (err) {
      // AI_KEY_SECRET changed or is missing: the saved key can't be read, so it has to be added again.
      console.error("[ai-settings] couldn't decrypt the key for", userId, err);
      return null;
    }
  }
  return serverConfig();
}

export async function saveAiSettings(userId: string, provider: AiProvider, apiKey: string, model: string | null) {
  const values = {
    provider,
    apiKeyEncrypted: seal(apiKey),
    keyHint: apiKey.slice(-4),
    model,
  };
  await db
    .insert(schema.aiSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: schema.aiSettings.userId, set: values });
}

export async function removeAiSettings(userId: string) {
  await db.delete(schema.aiSettings).where(eq(schema.aiSettings.userId, userId));
}
