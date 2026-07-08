"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
import { createServiceClient } from "@/lib/supabase/service";
import {
  callOpenRouter,
  OpenRouterError,
  type ChatMessage,
} from "@/lib/ai/openrouter";
import {
  chatSystem,
  reflectionUserPrompt,
  summarizeMoods,
  dateIdeaMessages,
  guidingQuestionMessages,
  parseDateIdea,
  parseGuidingQuestion,
} from "@/lib/ai/prompts";
import { buildCoupleContext } from "@/lib/ai/context";
import {
  TOPICS,
  DEFAULT_AI_MODEL,
  COST_CATS,
  VIBE_CATS,
  type CostCat,
  type VibeCat,
} from "@/lib/constants";
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
    const msg = error.code === "42501"
      ? "Solo quien creó el espacio puede configurar el mediador."
      : "No pudimos guardar la configuración. Intenta de nuevo.";
    return { ok: false, error: msg };
  }
  revalidatePath("/ajustes");
  revalidatePath("/comunicacion");
  return { ok: true };
}

type Reason = "sin-key" | "fallo" | "saturado" | "credito" | "auth";

type CoupleCtx = Awaited<ReturnType<typeof requireCouple>>;

/**
 * Shared engine: gathers context, calls the model, and persists rows ONLY after
 * a successful reply — so a failed model call never leaves an orphaned user
 * message in the shared, append-only thread.
 */
async function runMediator(
  ctx: CoupleCtx,
  kind: "chat" | "summary",
  userText?: string,
): Promise<{ ok: boolean; reason?: Reason }> {
  const { supabase, coupleId, userId } = ctx;

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
  const coupleContext = await buildCoupleContext(supabase, coupleId);

  let messages: ChatMessage[];
  if (kind === "chat") {
    const { data: recent } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("kind", "chat")
      .order("created_at", { ascending: false })
      .limit(10);
    const history = (recent ?? []).reverse();
    messages = [
      { role: "system", content: chatSystem(moodSummary, coupleContext) },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: (userText ?? "").trim() },
    ];
  } else {
    messages = [
      { role: "system", content: chatSystem(moodSummary, coupleContext) },
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
  } catch (e) {
    const status = e instanceof OpenRouterError ? e.status : 0;
    if (status === 429) return { ok: false, reason: "saturado" };
    if (status === 402) return { ok: false, reason: "credito" };
    if (status === 401 || status === 403) return { ok: false, reason: "auth" };
    return { ok: false, reason: "fallo" };
  }

  // Persist only after a successful reply. For chat, store the user turn first.
  if (kind === "chat") {
    const { error: userErr } = await supabase.from("ai_messages").insert({
      couple_id: coupleId,
      role: "user",
      kind: "chat",
      content: (userText ?? "").trim(),
      created_by: userId,
    });
    if (userErr) return { ok: false, reason: "fallo" };
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

/** Generates the assistant reply for a user message; persists both only on success. */
export async function sendMediatorMessage(
  text: string,
): Promise<{ ok: boolean; reason?: Reason }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "fallo" };
  const ctx = await requireCouple();
  return runMediator(ctx, "chat", trimmed);
}

/** Generates and stores a weekly reflection (assistant row, kind='summary'). */
export async function generateWeeklyReflection(): Promise<{
  ok: boolean;
  reason?: Reason;
}> {
  const ctx = await requireCouple();
  return runMediator(ctx, "summary");
}

/**
 * Shared one-shot AI call: reads the couple key (service-role), calls OpenRouter,
 * maps errors to warm reasons. Returns the raw assistant text on success.
 */
async function callCoupleAI(
  coupleId: string,
  messages: ChatMessage[],
): Promise<{ ok: boolean; text?: string; reason?: Reason }> {
  const service = createServiceClient();
  const { data: cfgRows, error: cfgErr } = await service.rpc(
    "get_couple_ai_key",
    { p_couple_id: coupleId },
  );
  if (cfgErr) return { ok: false, reason: "fallo" };
  const cfg = cfgRows?.[0];
  if (!cfg?.api_key) return { ok: false, reason: "sin-key" };
  const model = cfg.model || DEFAULT_AI_MODEL;
  try {
    const text = await callOpenRouter({ apiKey: cfg.api_key, model, messages });
    return { ok: true, text };
  } catch (e) {
    const status = e instanceof OpenRouterError ? e.status : 0;
    if (status === 429) return { ok: false, reason: "saturado" };
    if (status === 402) return { ok: false, reason: "credito" };
    if (status === 401 || status === 403) return { ok: false, reason: "auth" };
    return { ok: false, reason: "fallo" };
  }
}

/** Generates one fresh AI date idea from all active filters + couple context. */
export async function generateDateIdea(input: {
  filters: string[];
}): Promise<{
  ok: boolean;
  idea?: { text: string; cost: CostCat; vibes: VibeCat[] };
  reason?: Reason;
}> {
  const { supabase, coupleId } = await requireCouple();
  const costFilter = input.filters.find((f) =>
    (COST_CATS as readonly string[]).includes(f),
  );
  const vibes = input.filters.filter((f) =>
    (VIBE_CATS as readonly string[]).includes(f),
  );
  const [{ data: existing }, { data: started }] = await Promise.all([
    supabase.from("date_ideas").select("text").limit(15),
    supabase.from("budgets").select("date_ideas(text)").not("date_idea_id", "is", null),
  ]);
  const startedTexts = ((started ?? []) as { date_ideas: { text: string } | null }[])
    .map((b) => b.date_ideas?.text)
    .filter((t): t is string => !!t);
  const avoid = Array.from(
    new Set([...startedTexts, ...(existing ?? []).map((r) => r.text)]),
  ).slice(0, 20);
  const coupleContext = await buildCoupleContext(supabase, coupleId);
  const res = await callCoupleAI(
    coupleId,
    dateIdeaMessages({ costFilter, vibes, avoid, coupleContext }),
  );
  if (!res.ok || !res.text) return { ok: false, reason: res.reason ?? "fallo" };
  return { ok: true, idea: parseDateIdea(res.text, costFilter) };
}

/** Generates one guiding question tied to the couple's topics + moods + context. */
export async function generateGuidingQuestion(): Promise<{
  ok: boolean;
  question?: string;
  topic?: string;
  reason?: Reason;
}> {
  const { supabase, coupleId } = await requireCouple();
  const since = toInputDate(new Date(Date.now() - 7 * 86_400_000));
  const { data: moods } = await supabase
    .from("moods")
    .select("mood_emoji, mood_date")
    .gte("mood_date", since);
  const moodSummary = summarizeMoods(moods ?? []);
  const coupleContext = await buildCoupleContext(supabase, coupleId);
  const res = await callCoupleAI(
    coupleId,
    guidingQuestionMessages({
      moodSummary,
      topics: TOPICS.map((t) => ({ title: t.title, question: t.question })),
      coupleContext,
    }),
  );
  if (!res.ok || !res.text) return { ok: false, reason: res.reason ?? "fallo" };
  const parsed = parseGuidingQuestion(
    res.text,
    TOPICS.map((t) => t.title),
  );
  return { ok: true, question: parsed.question, topic: parsed.topic };
}
