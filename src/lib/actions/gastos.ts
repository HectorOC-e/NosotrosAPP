"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
import { getActiveBudgetId } from "@/lib/queries";
import { ok, fail, type ActionResult } from "@/lib/action-result";

export async function saveOuting(input: {
  name: string;
  limit: number;
}): Promise<ActionResult> {
  const { supabase, coupleId } = await requireCouple();
  const name = input.name.trim();
  if (!name || !Number.isFinite(input.limit) || input.limit <= 0) return ok();

  let activeId: string | null;
  try {
    activeId = await getActiveBudgetId(supabase, coupleId);
  } catch {
    return fail("No pudimos guardar la salida. Revisen su conexión.");
  }

  if (activeId) {
    const { error } = await supabase
      .from("budgets")
      .update({ label: name, limit_amount: input.limit })
      .eq("id", activeId);
    if (error) return fail("No pudimos guardar la salida. Inténtenlo de nuevo.");
  } else {
    const { error } = await supabase.from("budgets").insert({
      couple_id: coupleId,
      label: name,
      limit_amount: input.limit,
    });
    if (error) return fail("No pudimos guardar la salida. Inténtenlo de nuevo.");
  }
  revalidatePath("/gastos");
  revalidatePath("/inicio");
  return ok();
}

export async function addExpense(input: {
  desc: string;
  monto: number;
  profileId: string;
}): Promise<ActionResult> {
  const { supabase, coupleId } = await requireCouple();
  const desc = input.desc.trim();
  if (!desc || !Number.isFinite(input.monto) || input.monto <= 0) return ok();

  // Ensure there's an active outing to attach the expense to. A failed lookup must
  // not read as "no active outing" — that would silently create a duplicate budget.
  let budgetId: string | null;
  try {
    budgetId = await getActiveBudgetId(supabase, coupleId);
  } catch {
    return fail("No pudimos registrar el gasto. Revisen su conexión.");
  }

  if (!budgetId) {
    const { data, error } = await supabase
      .from("budgets")
      .insert({ couple_id: coupleId, label: "Salida", limit_amount: 0 })
      .select("id")
      .single();
    if (error) return fail("No pudimos registrar el gasto. Inténtenlo de nuevo.");
    budgetId = data.id;
  }

  const { error } = await supabase.from("expenses").insert({
    couple_id: coupleId,
    budget_id: budgetId,
    profile_id: input.profileId,
    description: desc,
    amount: input.monto,
  });
  if (error) return fail("No pudimos registrar el gasto. Inténtenlo de nuevo.");
  revalidatePath("/gastos");
  revalidatePath("/inicio");
  return ok();
}

export async function removeExpense(id: string): Promise<ActionResult> {
  const { supabase } = await requireCouple();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return fail("No pudimos borrar el gasto. Inténtenlo de nuevo.");
  revalidatePath("/gastos");
  revalidatePath("/inicio");
  return ok();
}
