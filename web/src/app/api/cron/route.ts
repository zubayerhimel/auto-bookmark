import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { checkStaleLinks } from "@/lib/link-check";
import { drainPending } from "@/lib/pipeline";

export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily job (vercel.json `crons`; Vercel sends CRON_SECRET as a bearer token). It finishes any
 * processing that was cut off, then spends the rest of the run checking for dead links.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const started = Date.now();
  const processed = await drainPending(null, 150_000);
  const links = await checkStaleLinks(started + 270_000);
  return NextResponse.json({ processed, links });
}
