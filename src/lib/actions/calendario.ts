"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
import { ok, fail, type ActionResult } from "@/lib/action-result";

export async function addPendiente(input: {
  text: string;
  fecha: string;
}): Promise<ActionResult> {
  const { supabase, coupleId, userId } = await requireCouple();
  const text = input.text.trim();
  if (!text || !input.fecha) return ok(); // client already prevents this

  const { error } = await supabase.from("events").insert({
    couple_id: coupleId,
    created_by: userId,
    title: text,
    event_date: input.fecha,
    done: false,
  });
  if (error) return fail("No pudimos agregar el pendiente. Inténtenlo de nuevo.");
  revalidatePath("/calendario");
  revalidatePath("/inicio");
  return ok();
}

export async function togglePendiente(
  id: string,
  done: boolean,
): Promise<ActionResult> {
  const { supabase } = await requireCouple();
  const { error } = await supabase.from("events").update({ done }).eq("id", id);
  if (error) return fail("No pudimos actualizar el pendiente. Inténtenlo de nuevo.");
  revalidatePath("/calendario");
  revalidatePath("/inicio");
  return ok();
}
