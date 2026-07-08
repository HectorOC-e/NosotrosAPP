import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { chatSystem, summarizeMoods } from "@/lib/ai/prompts";
import { buildCoupleContext } from "@/lib/ai/context";
import { MAX_OUTPUT_TOKENS, type ChatMessage } from "@/lib/ai/openrouter";
import { DEFAULT_AI_MODEL } from "@/lib/constants";
import { toInputDate } from "@/lib/format";

export const runtime = "nodejs";

function reasonFromStatus(status: number): string {
  if (status === 429) return "saturado";
  if (status === 402) return "credito";
  if (status === 401 || status === 403) return "auth";
  return "fallo";
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const trimmed = (body.text ?? "").trim();
  if (!trimmed) return Response.json({ ok: false, reason: "fallo" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", user.id)
    .maybeSingle();
  const coupleId = profile?.couple_id;
  if (!coupleId) return new Response("Sin pareja", { status: 401 });

  // Read the key with the service role (never exposed to the client).
  const service = createServiceClient();
  const { data: cfgRows, error: cfgErr } = await service.rpc("get_couple_ai_key", {
    p_couple_id: coupleId,
  });
  if (cfgErr) return Response.json({ ok: false, reason: "fallo" });
  const cfg = cfgRows?.[0];
  if (!cfg?.api_key) return Response.json({ ok: false, reason: "sin-key" });
  const model = cfg.model || DEFAULT_AI_MODEL;

  // Context + recent history.
  const since = toInputDate(new Date(Date.now() - 7 * 86_400_000));
  const { data: moods } = await supabase
    .from("moods")
    .select("mood_emoji, mood_date")
    .gte("mood_date", since);
  const moodSummary = summarizeMoods(moods ?? []);
  const coupleContext = await buildCoupleContext(supabase, coupleId);
  const { data: recent } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("kind", "chat")
    .order("created_at", { ascending: false })
    .limit(10);
  const history = (recent ?? []).reverse();
  const messages: ChatMessage[] = [
    { role: "system", content: chatSystem(moodSummary, coupleContext) },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: trimmed },
  ];

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
      messages,
    }),
  });
  if (!upstream.ok || !upstream.body) {
    return Response.json({ ok: false, reason: reasonFromStatus(upstream.status) });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  let buffer = "";
  let full = "";

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      // Parse one SSE line: enqueue the delta text and accumulate it.
      const handleLine = (line: string) => {
        const t = line.trim();
        if (!t.startsWith("data:")) return;
        const payload = t.slice(5).trim();
        if (!payload || payload === "[DONE]") return;
        try {
          const obj = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = obj.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) {
            full += delta;
            controller.enqueue(encoder.encode(delta));
          }
        } catch {
          // ignore keep-alives / partial JSON
        }
      };

      try {
        const { done, value } = await reader.read();
        if (done) {
          // Flush the decoder + any trailing buffered line (chunk not ending in "\n").
          buffer += decoder.decode();
          if (buffer.trim()) handleLine(buffer);
          buffer = "";
          if (full.trim()) {
            await supabase.from("ai_messages").insert({
              couple_id: coupleId,
              role: "user",
              kind: "chat",
              content: trimmed,
              created_by: user.id,
            });
            await supabase.from("ai_messages").insert({
              couple_id: coupleId,
              role: "assistant",
              kind: "chat",
              content: full.trim(),
              created_by: null,
            });
          }
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      } catch (err) {
        reader.cancel().catch(() => {});
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
