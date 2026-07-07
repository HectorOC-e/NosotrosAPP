"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
import { shortDateName } from "@/lib/format";
import type { CostCat } from "@/lib/constants";

export async function addIdea(input: { text: string; cost: CostCat }) {
  const { supabase, coupleId, userId } = await requireCouple();
  const text = input.text.trim();
  if (!text) return;

  const { error } = await supabase.from("date_ideas").insert({
    couple_id: coupleId,
    created_by: userId,
    text,
    cost: input.cost,
    vibe: null,
    is_favorite: false,
  });
  if (error) throw error;
  revalidatePath("/citas");
}

export async function setFavorite(id: string, value: boolean) {
  const { supabase } = await requireCouple();
  const { error } = await supabase
    .from("date_ideas")
    .update({ is_favorite: value })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/citas");
}

/**
 * Starts a date: creates a new active outing (budget) named after the idea and
 * linked to it. The previous outing (if any) stays as history with its expenses.
 */
export async function startDate(dateIdeaId: string): Promise<{ ok: boolean }> {
  const { supabase, coupleId } = await requireCouple();

  const { data: idea } = await supabase
    .from("date_ideas")
    .select("text")
    .eq("id", dateIdeaId)
    .maybeSingle();
  if (!idea) return { ok: false };

  const { error } = await supabase.from("budgets").insert({
    couple_id: coupleId,
    label: shortDateName(idea.text),
    limit_amount: 0,
    date_idea_id: dateIdeaId,
  });
  if (error) throw error;

  revalidatePath("/citas");
  revalidatePath("/gastos");
  revalidatePath("/inicio");
  return { ok: true };
}

/** Persists an AI-generated idea to the couple's favorites (with its vibes). */
export async function saveGeneratedIdea(input: {
  text: string;
  cost: CostCat;
  vibes: string[];
}): Promise<void> {
  const { supabase, coupleId, userId } = await requireCouple();
  const text = input.text.trim();
  if (!text) return;
  const { error } = await supabase.from("date_ideas").insert({
    couple_id: coupleId,
    created_by: userId,
    text,
    cost: input.cost,
    vibe: input.vibes.length ? input.vibes.join(",") : null,
    is_favorite: true,
  });
  if (error) throw error;
  revalidatePath("/citas");
}
