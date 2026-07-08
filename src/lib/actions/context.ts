import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sessionIsMissing } from "@/lib/supabase/auth-error";

/**
 * Resolves the authenticated user and their couple for a mutation.
 * Redirects to /login when there is no session or no linked couple.
 *
 * Throws when it could not determine either — a network failure must not be
 * dressed up as a logout. The thrown error reaches the nearest error boundary,
 * so the user sees "Algo se nos cayó" rather than being bounced to /login.
 */
export async function requireCouple() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  // "There is no session" is a legitimate answer. "We could not ask" is a failure.
  if (authErr && !sessionIsMissing(authErr)) throw authErr;
  if (!user) redirect("/login");

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, couple_id, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) throw profileErr;

  if (!profile?.couple_id) redirect("/login");

  return { supabase, userId: user.id, coupleId: profile.couple_id, profile };
}
