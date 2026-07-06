import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the authenticated user and their couple for a mutation.
 * Redirects to /login when there is no session or no linked couple.
 */
export async function requireCouple() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, couple_id, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.couple_id) redirect("/login");

  return { supabase, userId: user.id, coupleId: profile.couple_id, profile };
}
