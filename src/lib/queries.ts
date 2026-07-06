import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Couple, Profile } from "@/lib/database.types";

export type SessionContext = {
  userId: string;
  email: string | null;
  /** The signed-in user's own profile, or null if it has not been created yet. */
  profile: Profile | null;
  /** The couple both partners belong to, or null before onboarding completes. */
  couple: Couple | null;
  /** The other partner's profile, or null if they haven't joined yet. */
  partner: Profile | null;
};

/**
 * Loads everything a page needs about the current session in one place.
 * Returns null when there is no authenticated user.
 *
 * Onboarding state can be derived:
 *   - profile === null || profile.couple_id === null  → needs onboarding
 *   - couple !== null && partner === null             → waiting for partner
 */
export const getSessionContext = cache(async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  let couple: Couple | null = null;
  let partner: Profile | null = null;

  if (profile?.couple_id) {
    const [{ data: coupleRow }, { data: partnerRow }] = await Promise.all([
      supabase.from("couples").select("*").eq("id", profile.couple_id).maybeSingle(),
      supabase
        .from("profiles")
        .select("*")
        .eq("couple_id", profile.couple_id)
        .neq("id", user.id)
        .maybeSingle(),
    ]);
    couple = coupleRow;
    partner = partnerRow;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile ?? null,
    couple,
    partner,
  };
});
