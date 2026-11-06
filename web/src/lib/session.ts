import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** The signed-in Clerk user id, or null. */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** For pages and server actions: sends signed-out visitors to sign in (pages) or rejects (actions). */
export async function requireUser(): Promise<{ id: string }> {
  const { userId } = await auth.protect();
  return { id: userId };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken() {
  return `abk_${randomBytes(32).toString("base64url")}`;
}

/**
 * Resolves the caller of an API route: either a browser session
 * or an extension token sent as `Authorization: Bearer abk_…`.
 */
export async function getRequestUserId(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer abk_")) {
    const token = header.slice(7).trim();
    const [row] = await db
      .select({ id: schema.apiToken.id, userId: schema.apiToken.userId })
      .from(schema.apiToken)
      .where(eq(schema.apiToken.tokenHash, hashToken(token)))
      .limit(1);
    if (!row) return null;
    await db
      .update(schema.apiToken)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.apiToken.id, row.id));
    return row.userId;
  }
  return getUserId();
}
