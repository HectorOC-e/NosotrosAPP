"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
import { createServiceClient } from "@/lib/supabase/service";
import { callOpenRouter, type ChatMessage } from "@/lib/ai/openrouter";
import {
  chatSystem,
  reflectionUserPrompt,
  summarizeMoods,
} from "@/lib/ai/prompts";
import { TOPICS, DEFAULT_AI_MODEL } from "@/lib/constants";
import { toInputDate } from "@/lib/format";

/** Creator saves provider/model/key. Errors surface as a warm string. */
export async function saveAiConfig(input: {
  model: string;
  key: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireCouple();
  const { error } = await supabase.rpc("set_ai_config", {
    p_provider: "openrouter",
    p_model: input.model,
    p_key: input.key,
  });
  if (error) {
    const msg = /creador/i.test(error.message)
      ? "Solo quien creó el espacio puede configurar el mediador."
      : "No pudimos guardar la configuración. Intenta de nuevo.";
    return { ok: false, error: msg };
  }
  revalidatePath("/ajustes");
  revalidatePath("/comunicacion");
  return { ok: true };
}

type Reason = "sin-key" | "fallo";

/** Shared engine: gathers context, calls the model, persists the assistant row. */
async function runMediator(
  kind: "chat" | "summary",
): Promise<{ ok: boolean; reason?: Reason }> {
  const { supabase, coupleId } = await requireCouple();

  // Read provider/model/key with the service role (never exposed to client).
  const service = createServiceClient();
  const { data: cfgRows, error: cfgErr } = await service.rpc(
    "get_couple_ai_key",
    { p_couple_id: coupleId },
  );
  if (cfgErr) return { ok: false, reason: "fallo" };
  const cfg = cfgRows?.[0];
  if (!cfg?.api_key) return { ok: false, reason: "sin-key" };
  const model = cfg.model || DEFAULT_AI_MODEL;

  // Context: last 7 days of moods + recent chat history.
  const since = toInputDate(new Date(Date.now() - 7 * 86_400_000));
  const { data: moods } = await supabase
    .from("moods")
    .select("mood_emoji, mood_date")
    .gte("mood_date", since);
  const moodSummary = summarizeMoods(moods ?? []);

  let messages: ChatMessage[];
  if (kind === "chat") {
    const { data: history } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("kind", "chat")
      .order("created_at", { ascending: true })
      .limit(10);
    messages = [
      { role: "system", content: chatSystem(moodSummary) },
      ...(history ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];
  } else {
    messages = [
      { role: "system", content: chatSystem(moodSummary) },
      {
        role: "user",
        content: reflectionUserPrompt(
          moodSummary,
          TOPICS.map((t) => t.title),
        ),
      },
    ];
  }

  let reply: string;
  try {
    reply = await callOpenRouter({ apiKey: cfg.api_key, model, messages });
  } catch {
    return { ok: false, reason: "fallo" };
  }

  const { error: insErr } = await supabase.from("ai_messages").insert({
    couple_id: coupleId,
    role: "assistant",
    kind,
    content: reply,
    created_by: null,
  });
  if (insErr) return { ok: false, reason: "fallo" };

  revalidatePath("/comunicacion");
  return { ok: true };
}

/** Persists the user's message, then generates + stores the assistant reply. */
export async function sendMediatorMessage(
  text: string,
): Promise<{ ok: boolean; reason?: Reason }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "fallo" };

  const { supabase, coupleId, userId } = await requireCouple();
  const { error } = await supabase.from("ai_messages").insert({
    couple_id: coupleId,
    role: "user",
    kind: "chat",
    content: trimmed,
    created_by: userId,
  });
  if (error) return { ok: false, reason: "fallo" };

  return runMediator("chat");
}

/** Generates and stores a weekly reflection (assistant row, kind='summary'). */
export async function generateWeeklyReflection(): Promise<{
  ok: boolean;
  reason?: Reason;
}> {
  return runMediator("summary");
}
