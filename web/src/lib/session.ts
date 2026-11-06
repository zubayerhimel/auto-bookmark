import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auth } from "./auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
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
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user.id ?? null;
}
