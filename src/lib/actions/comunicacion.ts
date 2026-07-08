"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
import { toInputDate } from "@/lib/format";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/**
 * Sets the current user's own mood for today. Each partner controls only their
 * own check-in; both partners can see both. Upserts on (self, today).
 */
export async function setMood(emoji: string): Promise<ActionResult> {
  const { supabase, coupleId, userId } = await requireCouple();
  const today = toInputDate(new Date());

  const { data: existing, error: readErr } = await supabase
    .from("moods")
    .select("id")
    .eq("couple_id", coupleId)
    .eq("profile_id", userId)
    .eq("mood_date", today)
    .maybeSingle();
  if (readErr) return fail("No pudimos guardar tu ánimo. Revisen su conexión.");

  if (existing) {
    const { error } = await supabase
      .from("moods")
      .update({ mood_emoji: emoji })
      .eq("id", existing.id);
    if (error) return fail("No pudimos guardar tu ánimo. Inténtenlo de nuevo.");
  } else {
    const { error } = await supabase.from("moods").insert({
      couple_id: coupleId,
      profile_id: userId,
      mood_date: today,
      mood_emoji: emoji,
    });
    if (error) return fail("No pudimos guardar tu ánimo. Inténtenlo de nuevo.");
  }
  revalidatePath("/comunicacion");
  revalidatePath("/inicio");
  return ok();
}
