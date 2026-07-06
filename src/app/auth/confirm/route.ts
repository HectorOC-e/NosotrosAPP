import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { completePendingOnboarding } from "@/lib/onboarding-core";

/**
 * Handles the email-confirmation link. Supabase sends the user here with
 * `token_hash` + `type`; we verify it (which sets the session cookies), then
 * complete any pending couple onboarding and route to the right place.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login?error=enlace`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=enlace`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=sesion`);
  }

  // Finish create/join if there's a pending intent from before confirmation.
  await completePendingOnboarding(supabase, user.id);

  // Do they belong to a couple now?
  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.couple_id) {
    return NextResponse.redirect(`${origin}/bienvenida`);
  }
  // Confirmed but not paired (e.g. intent lost / invalid code) → onboarding choice.
  return NextResponse.redirect(`${origin}/login`);
}
