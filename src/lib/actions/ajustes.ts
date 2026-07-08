"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
import { ok, fail, type ActionResult } from "@/lib/action-result";

/** Saves shared couple context (couples) + the caller's own "about" (profiles). */
export async function saveAboutUs(input: {
  location: string;
  typicalBudget: string;
  togetherSince: string;
  hasKids: boolean;
  about: string;
}): Promise<ActionResult> {
  const { supabase, coupleId, userId } = await requireCouple();

  const trimmedBudget = input.typicalBudget.trim();
  const budget = trimmedBudget === "" ? null : Math.max(0, Number(trimmedBudget));

  const { error: cErr } = await supabase
    .from("couples")
    .update({
      location: input.location.trim() || null,
      typical_budget: budget != null && Number.isFinite(budget) ? budget : null,
      together_since: input.togetherSince || null,
      has_kids: input.hasKids,
    })
    .eq("id", coupleId);
  if (cErr) return fail("No pudimos guardar. Inténtenlo de nuevo.");

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ about: input.about.trim() || null })
    .eq("id", userId);
  if (pErr) return fail("No pudimos guardar. Inténtenlo de nuevo.");

  revalidatePath("/ajustes");
  revalidatePath("/inicio");
  revalidatePath("/citas");
  revalidatePath("/comunicacion");
  return ok();
}
