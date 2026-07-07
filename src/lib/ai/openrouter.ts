import "server-only";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** Caps the reply length. Also bounds the credit OpenRouter reserves up front —
 * without it, OpenRouter reserves the model's full max output (e.g. 16k tokens)
 * and rejects small-balance accounts with a 402 even for a tiny reply. */
export const MAX_OUTPUT_TOKENS = 800;

/** Error that carries the OpenRouter HTTP status so callers can tailor messages
 * (429 = rate-limited, 402 = needs credits, 401/403 = bad key). */
export class OpenRouterError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
  }
}

/**
 * Calls OpenRouter's chat completions endpoint and returns the assistant text.
 * Throws on any non-2xx or empty response. Server-only: the apiKey must never
 * reach a client. Local dev requires NODE_OPTIONS=--use-system-ca (corporate proxy).
 */
export async function callOpenRouter(opts: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: opts.messages,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new OpenRouterError(res.status, detail.slice(0, 300));
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter: respuesta vacía");
  }
  return content.trim();
}

/**
 * Fetches the available model slugs from OpenRouter's public models endpoint
 * (no API key needed). Cached for 1h. Returns [] on any failure so callers can
 * fall back to a curated list. Used to populate the Ajustes model autocomplete.
 */
export async function fetchOpenRouterModels(): Promise<string[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id?: string }[] };
    return (data.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .sort();
  } catch {
    return [];
  }
}
