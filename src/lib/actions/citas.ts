"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
import { shortDateName } from "@/lib/format";
import type { CostCat } from "@/lib/constants";
import { getActiveBudgetId } from "@/lib/queries";
import type { SupabaseServerClient } from "@/lib/supabase/types";

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

/**
 * Guards the two history mutations below. Returns true only when the budget is a
 * past date the couple may edit: it exists and is visible under RLS, it is a cita
 * (`date_idea_id` set), and it is not the active outing. The UI never offers the
 * active outing, but Server Actions are client-invocable endpoints, so the server
 * checks too. Callers no-op on false — these states are unreachable from the UI
 * and a thrown error would tell the user nothing useful.
 */
async function isEditablePastDate(
  supabase: SupabaseServerClient,
  budgetId: string,
): Promise<boolean> {
  const { data: budget } = await supabase
    .from("budgets")
    .select("id, date_idea_id")
    .eq("id", budgetId)
    .maybeSingle();
  if (!budget?.date_idea_id) return false;
  return budget.id !== (await getActiveBudgetId(supabase));
}

/** Renames a past outing. The spend shown next to it is derived, not editable. */
export async function renameOuting(budgetId: string, label: string): Promise<void> {
  const { supabase } = await requireCouple();
  const next = label.trim().slice(0, 60);
  if (!next) return;
  if (!(await isEditablePastDate(supabase, budgetId))) return;

  const { error } = await supabase
    .from("budgets")
    .update({ label: next })
    .eq("id", budgetId);
  if (error) throw error;
  revalidatePath("/citas");
}

/**
 * Deletes a past outing. Its expenses go with it: the FK
 * `expenses.budget_id -> budgets.id` is ON DELETE CASCADE, so Postgres removes the
 * child rows. Irreversible; the UI confirms with a two-tap before calling this.
 */
export async function deletePastDate(budgetId: string): Promise<void> {
  const { supabase } = await requireCouple();
  if (!(await isEditablePastDate(supabase, budgetId))) return;

  const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (error) throw error;
  revalidatePath("/citas");
}
