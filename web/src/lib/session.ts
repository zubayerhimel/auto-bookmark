import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createClient } from "./supabase/server";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const email = typeof claims.email === "string" ? claims.email : "";
  const name = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && !!v);
  const image = [meta.avatar_url, meta.picture].find((v): v is string => typeof v === "string" && !!v);
  return { id: claims.sub, email, name: name ?? email.split("@")[0], image: image ?? null };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/");
  return user;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken() {
  return `abk_${randomBytes(32).toString("base64url")}`;
}

/**
 * Resolves the caller of an API route: either a browser session cookie
 * or an extension token sent as `Authorization: Bearer abk_…`.
 */
export async function getRequestUserId(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
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
  return (await getUser())?.id ?? null;
}
