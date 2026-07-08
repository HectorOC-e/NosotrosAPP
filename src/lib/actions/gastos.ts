"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
import { getActiveBudgetId } from "@/lib/queries";

export async function saveOuting(input: { name: string; limit: number }) {
  const { supabase, coupleId } = await requireCouple();
  const name = input.name.trim();
  if (!name || !Number.isFinite(input.limit) || input.limit <= 0) return;

  const activeId = await getActiveBudgetId(supabase, coupleId);
  if (activeId) {
    const { error } = await supabase
      .from("budgets")
      .update({ label: name, limit_amount: input.limit })
      .eq("id", activeId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("budgets").insert({
      couple_id: coupleId,
      label: name,
      limit_amount: input.limit,
    });
    if (error) throw error;
  }
  revalidatePath("/gastos");
  revalidatePath("/inicio");
}

export async function addExpense(input: {
  desc: string;
  monto: number;
  profileId: string;
}) {
  const { supabase, coupleId } = await requireCouple();
  const desc = input.desc.trim();
  if (!desc || !Number.isFinite(input.monto) || input.monto <= 0) return;

  // Ensure there's an active outing to attach the expense to.
  let budgetId = await getActiveBudgetId(supabase, coupleId);
  if (!budgetId) {
    const { data, error } = await supabase
      .from("budgets")
      .insert({ couple_id: coupleId, label: "Salida", limit_amount: 0 })
      .select("id")
      .single();
    if (error) throw error;
    budgetId = data.id;
  }

  const { error } = await supabase.from("expenses").insert({
    couple_id: coupleId,
    budget_id: budgetId,
    profile_id: input.profileId,
    description: desc,
    amount: input.monto,
  });
  if (error) throw error;
  revalidatePath("/gastos");
  revalidatePath("/inicio");
}

export async function removeExpense(id: string) {
  const { supabase } = await requireCouple();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/gastos");
  revalidatePath("/inicio");
}
