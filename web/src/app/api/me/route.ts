import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { db } from "@/db";
import { getRequestUserId } from "@/lib/session";

/** Lets the extension confirm its token and show which account it saves to. */
export async function GET(req: Request) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [u] = await db
    .select({
      email: authUsers.email,
      name: sql<string | null>`coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')`,
    })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .limit(1);
  return NextResponse.json(u ?? null);
}
