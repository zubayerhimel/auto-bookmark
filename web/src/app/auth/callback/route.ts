import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Google sends the user back here; trade the one-time code for a session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/library";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/library";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/?error=signin`);
}
