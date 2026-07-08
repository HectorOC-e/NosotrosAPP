"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
import { shortDateName } from "@/lib/format";
import type { CostCat } from "@/lib/constants";
import { getActiveBudgetId } from "@/lib/queries";
import type { SupabaseServerClient } from "@/lib/supabase/types";
import { ok, fail, type ActionResult } from "@/lib/action-result";

export async function addIdea(input: {
  text: string;
  cost: CostCat;
}): Promise<ActionResult> {
  const { supabase, coupleId, userId } = await requireCouple();
  const text = input.text.trim();
  if (!text) return ok(); // client already prevents this

  const { error } = await supabase.from("date_ideas").insert({
    couple_id: coupleId,
    created_by: userId,
    text,
    cost: input.cost,
    vibe: null,
    is_favorite: false,
  });
  if (error) {
    console.error("addIdea:", error);
    return fail("No pudimos guardar la idea. Inténtenlo de nuevo.");
  }
  revalidatePath("/citas");
  return ok();
}

export async function setFavorite(id: string, value: boolean): Promise<ActionResult> {
  const { supabase } = await requireCouple();
  const { error } = await supabase
    .from("date_ideas")
    .update({ is_favorite: value })
    .eq("id", id);
  if (error) {
    console.error("setFavorite:", error);
    return fail("No pudimos actualizar la favorita. Inténtenlo de nuevo.");
  }
  revalidatePath("/citas");
  return ok();
}

/**
 * Starts a date: creates a new active outing (budget) named after the idea and
 * linked to it. The previous outing (if any) stays as history with its expenses.
 */
export async function startDate(dateIdeaId: string): Promise<ActionResult> {
  const { supabase, coupleId } = await requireCouple();

  const { data: idea, error: readErr } = await supabase
    .from("date_ideas")
    .select("text")
    .eq("id", dateIdeaId)
    .maybeSingle();
  if (readErr) {
    console.error("startDate:", readErr);
    return fail("No pudimos empezar la cita. Inténtenlo de nuevo.");
  }
  if (!idea) return fail("Esa idea ya no existe.");

  const { error } = await supabase.from("budgets").insert({
    couple_id: coupleId,
    label: shortDateName(idea.text),
    limit_amount: 0,
    date_idea_id: dateIdeaId,
  });
  if (error) {
    console.error("startDate:", error);
    return fail("No pudimos empezar la cita. Inténtenlo de nuevo.");
  }

  revalidatePath("/citas");
  revalidatePath("/gastos");
  revalidatePath("/inicio");
  return ok();
}

/** Persists an AI-generated idea to the couple's favorites (with its vibes). */
export async function saveGeneratedIdea(input: {
  text: string;
  cost: CostCat;
  vibes: string[];
}): Promise<ActionResult> {
  const { supabase, coupleId, userId } = await requireCouple();
  const text = input.text.trim();
  if (!text) return ok(); // client already prevents this
  const { error } = await supabase.from("date_ideas").insert({
    couple_id: coupleId,
    created_by: userId,
    text,
    cost: input.cost,
    vibe: input.vibes.length ? input.vibes.join(",") : null,
    is_favorite: true,
  });
  if (error) {
    console.error("saveGeneratedIdea:", error);
    return fail("No pudimos guardar la idea. Inténtenlo de nuevo.");
  }
  revalidatePath("/citas");
  return ok();
}

/**
 * Guards the two history mutations below. Returns ok() only when the budget is a
 * past date the couple may edit: it exists and is visible under RLS, it is a cita
 * (`date_idea_id` set), and it is not the active outing. The UI never offers the
 * active outing, but Server Actions are client-invocable endpoints, so the server
 * checks too. Fails closed: if we cannot determine the active outing, we refuse
 * rather than risk deleting it and cascading its expenses away.
 */
async function checkEditablePastDate(
  supabase: SupabaseServerClient,
  budgetId: string,
): Promise<ActionResult> {
  const { data: budget, error } = await supabase
    .from("budgets")
    .select("id, date_idea_id")
    .eq("id", budgetId)
    .maybeSingle();
  if (error) {
    console.error("checkEditablePastDate:", error);
    return fail("No pudimos verificar la cita. Revisen su conexión.");
  }
  if (!budget?.date_idea_id) return fail("Esa cita ya no está en el historial.");

  // getActiveBudgetId throws on a query failure — that must not become "no active outing".
  let activeId: string | null;
  try {
    activeId = await getActiveBudgetId(supabase);
  } catch (e) {
    console.error("checkEditablePastDate/getActiveBudgetId:", e);
    return fail("No pudimos verificar la cita. Revisen su conexión.");
  }
  if (budget.id === activeId) return fail("Esa cita ya no está en el historial.");
  return ok();
}

/** Renames a past outing. The spend shown next to it is derived, not editable. */
export async function renameOuting(
  budgetId: string,
  label: string,
): Promise<ActionResult> {
  const { supabase } = await requireCouple();
  const next = label.slice(0, 60).trim();
  if (!next) return ok(); // client already prevents this; nothing to do, nothing to report

  const guard = await checkEditablePastDate(supabase, budgetId);
  if (!guard.ok) return guard;

  const { error } = await supabase
    .from("budgets")
    .update({ label: next })
    .eq("id", budgetId);
  if (error) {
    console.error("renameOuting:", error);
    return fail("No pudimos renombrar la cita. Inténtenlo de nuevo.");
  }
  revalidatePath("/citas");
  return ok();
}

/**
 * Deletes a past outing. Its expenses go with it: the FK
 * `expenses.budget_id -> budgets.id` is ON DELETE CASCADE, so Postgres removes the
 * child rows. Irreversible; the UI confirms with a two-tap before calling this.
 */
export async function deletePastDate(budgetId: string): Promise<ActionResult> {
  const { supabase } = await requireCouple();

  const guard = await checkEditablePastDate(supabase, budgetId);
  if (!guard.ok) return guard;

  const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (error) {
    console.error("deletePastDate:", error);
    return fail("No pudimos borrar la cita. Inténtenlo de nuevo.");
  }
  revalidatePath("/citas");
  return ok();
}
