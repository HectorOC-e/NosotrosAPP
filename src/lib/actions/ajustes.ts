"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";

/** Saves shared couple context (couples) + the caller's own "about" (profiles). */
export async function saveAboutUs(input: {
  location: string;
  typicalBudget: string;
  togetherSince: string;
  hasKids: boolean;
  about: string;
}): Promise<{ ok: boolean }> {
  const { supabase, coupleId, userId } = await requireCouple();

  const trimmedBudget = input.typicalBudget.trim();
  const budget = trimmedBudget === "" ? null : Number(trimmedBudget);

  const { error: cErr } = await supabase
    .from("couples")
    .update({
      location: input.location.trim() || null,
      typical_budget: budget != null && Number.isFinite(budget) ? budget : null,
      together_since: input.togetherSince || null,
      has_kids: input.hasKids,
    })
    .eq("id", coupleId);
  if (cErr) return { ok: false };

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ about: input.about.trim() || null })
    .eq("id", userId);
  if (pErr) return { ok: false };

  revalidatePath("/ajustes");
  revalidatePath("/inicio");
  revalidatePath("/citas");
  revalidatePath("/comunicacion");
  return { ok: true };
}
