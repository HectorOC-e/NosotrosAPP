import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseServerClient as DB } from "@/lib/supabase/types";

/** Ensures the signed-in user has a profile row (there is no DB trigger for it). */
export async function ensureProfile(
  supabase: DB,
  userId: string,
  displayName?: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("profiles").insert({
    id: userId,
    ...(displayName ? { display_name: displayName } : {}),
  });
  if (error) throw error;
}

/**
 * Creates a new couple and links the caller as its `creador`.
 *
 * RLS note: `couples` SELECT is gated on `id = get_my_couple_id()`, so an
 * `insert().select()` returns nothing (the profile isn't linked yet). We
 * therefore generate the couple id client-side, link the profile, and only
 * then read the row back to obtain the auto-generated `invite_code`.
 */
export async function createCouple(
  supabase: DB,
  userId: string,
  opts: { coupleName?: string; displayName?: string },
): Promise<{ coupleId: string; inviteCode: string }> {
  await ensureProfile(supabase, userId, opts.displayName);

  const coupleId = randomUUID();

  const { error: insertErr } = await supabase.from("couples").insert({
    id: coupleId,
    name: opts.coupleName?.trim() || null,
  });
  if (insertErr) throw insertErr;

  const { error: linkErr } = await supabase
    .from("profiles")
    .update({
      couple_id: coupleId,
      partner_role: "creador",
      ...(opts.displayName?.trim()
        ? { display_name: opts.displayName.trim() }
        : {}),
    })
    .eq("id", userId);
  if (linkErr) throw linkErr;

  // Now that the profile is linked, RLS allows reading the couple back.
  const { data: couple, error: readErr } = await supabase
    .from("couples")
    .select("invite_code")
    .eq("id", coupleId)
    .single();
  if (readErr) throw readErr;

  return { coupleId, inviteCode: couple.invite_code };
}

/**
 * Joins an existing couple by invite code as `invitado`, via the
 * `join_couple_by_code` SECURITY DEFINER RPC (RLS forbids reading a couple
 * you are not yet a member of).
 */
export async function joinCouple(
  supabase: DB,
  userId: string,
  opts: { code: string; displayName?: string },
): Promise<{ coupleId: string }> {
  await ensureProfile(supabase, userId, opts.displayName);

  const { data, error } = await supabase.rpc("join_couple_by_code", {
    p_code: opts.code.trim().toUpperCase(),
    p_display_name: opts.displayName?.trim() || undefined,
  });
  if (error) throw error;

  return { coupleId: data as string };
}
