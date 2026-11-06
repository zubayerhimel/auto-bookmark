import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getRequestUserId } from "@/lib/session";

/** Lets the extension confirm its token and show which account it saves to. */
export async function GET(req: Request) {
  const userId = await getRequestUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await (await clerkClient()).users.getUser(userId).catch(() => null);
  if (!user) return NextResponse.json(null);
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  return NextResponse.json({ email, name: user.fullName || user.username || null });
}
