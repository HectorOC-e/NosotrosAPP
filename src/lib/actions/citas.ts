"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
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
