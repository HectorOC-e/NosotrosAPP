"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";

export async function addPendiente(input: { text: string; fecha: string }) {
  const { supabase, coupleId, userId } = await requireCouple();
  const text = input.text.trim();
  if (!text || !input.fecha) return;

  const { error } = await supabase.from("events").insert({
    couple_id: coupleId,
    created_by: userId,
    title: text,
    event_date: input.fecha,
    done: false,
  });
  if (error) throw error;
  revalidatePath("/calendario");
  revalidatePath("/inicio");
}

export async function togglePendiente(id: string, done: boolean) {
  const { supabase } = await requireCouple();
  const { error } = await supabase.from("events").update({ done }).eq("id", id);
  if (error) throw error;
  revalidatePath("/calendario");
  revalidatePath("/inicio");
}
