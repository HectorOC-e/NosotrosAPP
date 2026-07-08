import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Budget, Couple, Profile } from "@/lib/database.types";
import type { SupabaseServerClient as DB } from "@/lib/supabase/types";
import { sessionIsMissing } from "@/lib/supabase/auth-error";

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
    error: authErr,
  } = await supabase.auth.getUser();
  // "There is no session" is a legitimate answer. "We could not ask" is a failure,
  // and returning null for it would look to every caller like a forced logout.
  if (authErr && !sessionIsMissing(authErr)) throw authErr;
  if (!user) return null;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) throw profileErr;

  let couple: Couple | null = null;
  let partner: Profile | null = null;

  if (profile?.couple_id) {
    const [
      { data: coupleRow, error: coupleErr },
      { data: partnerRow, error: partnerErr },
    ] = await Promise.all([
      supabase.from("couples").select("*").eq("id", profile.couple_id).maybeSingle(),
      supabase
        .from("profiles")
        .select("*")
        .eq("couple_id", profile.couple_id)
        .neq("id", user.id)
        .maybeSingle(),
    ]);
    if (coupleErr) throw coupleErr;
    if (partnerErr) throw partnerErr;
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

/**
 * The active outing is the most recently created budget for the couple.
 * Single source of truth: every screen and action that asks "which outing is
 * active?" goes through here, so they can never disagree. `coupleId` is
 * optional: pass it in server actions for explicit scoping; server components
 * can omit it and rely on RLS. Throws if the query fails — callers must not
 * treat a query error as "no active outing".
 */
export async function getActiveBudget(
  supabase: DB,
  coupleId?: string,
): Promise<Budget | null> {
  let filter = supabase.from("budgets").select("*");
  if (coupleId) filter = filter.eq("couple_id", coupleId);
  const { data, error } = await filter
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** The active outing's id, for callers that only need to compare identity. */
export async function getActiveBudgetId(
  supabase: DB,
  coupleId?: string,
): Promise<string | null> {
  return (await getActiveBudget(supabase, coupleId))?.id ?? null;
}
