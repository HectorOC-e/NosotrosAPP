# Date History (3b) + Mediator Chat Streaming (3c) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show past dates ("Citas pasadas") in Citas and make the AI avoid re-suggesting them (3b); stream the mediator chat token-by-token via a Route Handler (3c). No schema change.

**Architecture:** 3b reuses `budgets` (with `date_idea_id`) as the history and joins their linked idea texts into the idea-generation `avoid` list. 3c adds `POST /api/mediator` that authenticates via cookies, reads the couple key with the service-role client, calls OpenRouter with `stream:true`, pipes token text through a `ReadableStream`, and persists the user+assistant messages on completion; `mediator-panel.tsx` reads the stream and shows tokens live.

**Tech Stack:** Next.js 15 App Router (Route Handlers, ReadableStream) · TypeScript · Supabase · OpenRouter · pnpm 11.1.1.

## Global Constraints

- **pnpm 11.1.1.** Build: `pnpm build`. Local build needs `NODE_OPTIONS=--use-system-ca` (corporate proxy); PowerShell: `$env:NODE_OPTIONS='--use-system-ca'; pnpm build`.
- **No schema change** — both features reuse existing tables (`budgets`, `expenses`, `date_ideas`, `ai_messages`).
- **Secret handling:** the decrypted key is read only server-side (Route Handler / actions) via the service-role client; it never reaches the browser. Only assistant text streams to the client.
- **Two task groups:** 3b (Tasks 1–2) is ship-able on its own; 3c (Tasks 3–4) after. If 3c proves too delicate, 3b can merge alone.
- **Copy:** Spanish es-HN, warm. Reuse DS classes (`.glass`, `.glass-subtle`, `.field`, `.btn-primary`, `.eyebrow`), accents rosa `#FF6F91` / violeta `#8B7CFF`.
- **`max_tokens: 800`** on the streaming call (same cap as the rest). Inject `buildCoupleContext` into the chat system prompt (same as non-stream chat).

---

## File Structure

**Create:**
- `src/app/api/mediator/route.ts` — streaming Route Handler for the chat.

**Modify:**
- `src/app/(app)/citas/page.tsx` — fetch `pastDates`.
- `src/components/citas/citas-client.tsx` — "CITAS PASADAS" section + `pastDates` prop + `PastDate` type.
- `src/lib/actions/ai.ts` — `generateDateIdea` merges started-date texts into `avoid`; remove `sendMediatorMessage`.
- `src/components/comunicacion/mediator-panel.tsx` — stream the chat; drop the Server Action for send.

---

## Task 1: 3b data — past dates + AI avoids started dates

**Files:**
- Modify: `src/app/(app)/citas/page.tsx`
- Modify: `src/lib/actions/ai.ts` (`generateDateIdea` only)

**Interfaces:**
- Produces: `PastDate = { id: string; name: string; whenLabel: string; spent: number }` (exported from `citas-client.tsx` in Task 2 — for THIS task, define it inline in the page import once Task 2 exists; sequence Task 2's type first OR export from page). To avoid a cross-file ordering issue, **define and export `PastDate` in `citas-client.tsx` as part of Task 2**, and in this task import it: `import { CitasClient, type IdeaView, type PastDate } from "@/components/citas/citas-client";`. (Implement Task 2 first if executing out of order.)

- [ ] **Step 1: Fetch past dates in `src/app/(app)/citas/page.tsx`**

Replace the file with:
```tsx
import { createClient } from "@/lib/supabase/server";
import { parseDbDate, relLabel, money } from "@/lib/format";
import {
  CitasClient,
  type IdeaView,
  type PastDate,
} from "@/components/citas/citas-client";

export default async function CitasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("date_ideas")
    .select("*")
    .order("created_at", { ascending: true });

  const ideas: IdeaView[] = (data ?? []).map((row) => ({
    id: row.id,
    text: row.text,
    tags: [row.cost, ...(row.vibe ? row.vibe.split(",") : [])]
      .map((t) => t?.trim())
      .filter((t): t is string => !!t),
    isFavorite: row.is_favorite,
  }));

  // Past dates = cita-budgets (date_idea_id set), excluding the currently active outing.
  const { data: activeRow } = await supabase
    .from("budgets")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const activeId = activeRow?.id ?? null;

  const { data: citaRows } = await supabase
    .from("budgets")
    .select("id, label, created_at")
    .not("date_idea_id", "is", null)
    .order("created_at", { ascending: false });
  const past = (citaRows ?? []).filter((b) => b.id !== activeId);

  let pastDates: PastDate[] = [];
  if (past.length) {
    const ids = past.map((b) => b.id);
    const { data: exp } = await supabase
      .from("expenses")
      .select("budget_id, amount")
      .in("budget_id", ids);
    const spentBy = new Map<string, number>();
    for (const e of exp ?? [])
      spentBy.set(e.budget_id, (spentBy.get(e.budget_id) ?? 0) + Number(e.amount));
    pastDates = past.map((b) => ({
      id: b.id,
      name: b.label,
      whenLabel: relLabel(parseDbDate(b.created_at.slice(0, 10))),
      spent: spentBy.get(b.id) ?? 0,
    }));
  }

  return <CitasClient ideas={ideas} pastDates={pastDates} />;
}
```
(`money` is imported for use in the client, not here — remove the `money` import if `pnpm lint` flags it as unused; it is used in Task 2's client, not the page. **Correction:** do NOT import `money` in the page; delete that import.)

Fix the import line to:
```tsx
import { parseDbDate, relLabel } from "@/lib/format";
```

- [ ] **Step 2: Make `generateDateIdea` avoid already-started dates**

In `src/lib/actions/ai.ts`, inside `generateDateIdea`, replace:
```ts
  const { data: existing } = await supabase.from("date_ideas").select("text").limit(15);
  const avoid = (existing ?? []).map((r) => r.text);
```
with:
```ts
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
```

- [ ] **Step 3: Build** — `pnpm build` exit 0, tsc clean. (Requires Task 2's `PastDate` export; if building this task alone, implement Task 2 Step 1 first.)

- [ ] **Step 4: Commit**
```bash
git add "src/app/(app)/citas/page.tsx" src/lib/actions/ai.ts
git commit -m "feat(citas): past-dates data + AI avoids already-started dates"
```

---

## Task 2: 3b UI — "Citas pasadas" section

**Files:** Modify `src/components/citas/citas-client.tsx`.

**Interfaces:**
- Produces: `export type PastDate = { id: string; name: string; whenLabel: string; spent: number }`; `CitasClient` accepts `pastDates: PastDate[]`.

- [ ] **Step 1: Add the type + prop**

At the top of `src/components/citas/citas-client.tsx`, add the `money` import:
```ts
import { money } from "@/lib/format";
```
Add the exported type near `IdeaView`:
```ts
export type PastDate = {
  id: string;
  name: string;
  whenLabel: string;
  spent: number;
};
```
Change the component signature from `export function CitasClient({ ideas }: { ideas: IdeaView[] })` to:
```ts
export function CitasClient({
  ideas,
  pastDates,
}: {
  ideas: IdeaView[];
  pastDates: PastDate[];
}) {
```

- [ ] **Step 2: Render the section at the end**

Immediately before the final closing `</div>` of the component's returned tree (after the "AGREGAR SU PROPIA IDEA" `glass-subtle` block), insert:
```tsx
      {/* Past dates */}
      <div className="mt-[22px]">
        <div className="eyebrow mb-2.5">CITAS PASADAS</div>
        {pastDates.length ? (
          <div className="flex flex-col gap-2">
            {pastDates.map((d) => (
              <div
                key={d.id}
                className="glass-subtle flex items-center gap-2.5 rounded-2xl px-3.5 py-3"
              >
                <span className="flex-1 text-[14px] text-ink">{d.name}</span>
                <span className="text-[12px] text-ink-tertiary">{d.whenLabel}</span>
                <span className="tnum text-[13px] text-ink-secondary">
                  L {money(d.spent)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[13.5px] text-ink-tertiary">
            Aún no han empezado ninguna cita.
          </div>
        )}
      </div>
```

- [ ] **Step 3: Build** — `pnpm build` exit 0, tsc clean.

- [ ] **Step 4: Commit**
```bash
git add src/components/citas/citas-client.tsx
git commit -m "feat(citas): Citas pasadas history section"
```

---

## Task 3: 3c — streaming Route Handler `POST /api/mediator`

**Files:** Create `src/app/api/mediator/route.ts`.

**Interfaces:**
- Consumes: `createClient` (server), `createServiceClient`, `chatSystem`/`summarizeMoods` (prompts), `buildCoupleContext`, `MAX_OUTPUT_TOKENS`/`ChatMessage` (openrouter), `DEFAULT_AI_MODEL`, `toInputDate`.
- Produces: `POST /api/mediator` — body `{ text: string }`; returns either `Response.json({ ok:false, reason })` or a `text/plain` token stream; persists `ai_messages` (user+assistant) on completion.

- [ ] **Step 1: Create the Route Handler**

`src/app/api/mediator/route.ts`:
```ts
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
      const { done, value } = await reader.read();
      if (done) {
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
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") continue;
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
```

- [ ] **Step 2: Build** — `pnpm build` exit 0, tsc clean, and `/api/mediator` appears in the route list.

- [ ] **Step 3: Commit**
```bash
git add src/app/api/mediator/route.ts
git commit -m "feat(api): streaming mediator chat route handler"
```

---

## Task 4: 3c — stream the chat in `mediator-panel.tsx`

**Files:** Modify `src/components/comunicacion/mediator-panel.tsx`; Modify `src/lib/actions/ai.ts` (remove `sendMediatorMessage`).

**Interfaces:** Consumes `POST /api/mediator` (Task 3), `generateWeeklyReflection` (kept), `useRouter`.

- [ ] **Step 1: Swap imports in `mediator-panel.tsx`**

Replace:
```ts
import { sendMediatorMessage, generateWeeklyReflection } from "@/lib/actions/ai";
```
with:
```ts
import { useRouter } from "next/navigation";
import { generateWeeklyReflection } from "@/lib/actions/ai";
```

- [ ] **Step 2: Add streaming state + rewrite `onSend`**

After `const [error, setError] = useState<string | null>(null);` add:
```ts
  const router = useRouter();
  const [streamingUser, setStreamingUser] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState("");
```
Replace the `onSend` function with:
```ts
  function onSend() {
    const t = text.trim();
    if (!t || pending) return;
    setError(null);
    setText("");
    setStreamingUser(t);
    setStreamingReply("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/mediator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: t }),
        });
        const ctype = res.headers.get("content-type") ?? "";
        if (ctype.includes("application/json") || !res.body) {
          const j = (await res.json().catch(() => null)) as { reason?: string } | null;
          setError(warm(j?.reason));
          setStreamingUser(null);
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setStreamingReply(acc);
        }
        // Persisted server-side; refresh to load the real thread, then clear transient bubbles.
        setStreamingUser(null);
        setStreamingReply("");
        router.refresh();
      } catch {
        setError(warm("fallo"));
        setStreamingUser(null);
      }
    });
  }
```

- [ ] **Step 3: Render the optimistic + streaming bubbles**

Replace the existing `{pending && ( … pensando… )}` block with:
```tsx
        {streamingUser && (
          <div className="max-w-[80%] self-end rounded-[14px_14px_4px_14px] bg-rosa/15 px-3.5 py-2.5 text-[13px] text-ink">
            {streamingUser}
          </div>
        )}
        {streamingUser && (
          <div className="max-w-[85%] self-start rounded-[14px_14px_14px_4px] bg-white/[0.08] px-3.5 py-2.5 text-[13px] text-ink">
            {streamingReply || "pensando…"}
          </div>
        )}
        {pending && !streamingUser && (
          <div className="max-w-[80%] self-start rounded-[14px] bg-white/[0.06] px-3.5 py-2.5 text-[13px] text-ink-tertiary">
            pensando…
          </div>
        )}
```

- [ ] **Step 4: Remove the now-unused `sendMediatorMessage` from `src/lib/actions/ai.ts`**

Delete the entire `sendMediatorMessage` exported function (the `export async function sendMediatorMessage(text: string) { … }` block). Leave `runMediator` and `generateWeeklyReflection` as-is (`generateWeeklyReflection` still calls `runMediator(ctx, "summary")`). Note: `runMediator`'s `"chat"` branch becomes unused — that is acceptable dead code for this task; do not refactor `runMediator` here.

- [ ] **Step 5: Build** — `pnpm build` exit 0, tsc clean (no unused-import errors; `sendMediatorMessage` no longer referenced anywhere).

- [ ] **Step 6: Commit**
```bash
git add src/components/comunicacion/mediator-panel.tsx src/lib/actions/ai.ts
git commit -m "feat(comunicacion): stream the mediator chat live"
```

---

## Task 5: Verification

**Files:** none committed.

- [ ] **Step 1:** `pnpm build` exit 0, tsc clean, and `/api/mediator` in the route list.
- [ ] **Step 2 (3b, SQL/manual):** With a couple that has ≥2 started dates (budgets with `date_idea_id`), Citas shows "CITAS PASADAS" listing all but the active outing, each with `nombre · hace X · L gastado`. Assert:
  ```sql
  select label, created_at from public.budgets where couple_id='<id>' and date_idea_id is not null order by created_at desc;
  ```
- [ ] **Step 3 (3b AI):** `generateDateIdea` no longer suggests an already-started date (the started texts are in `avoid`).
- [ ] **Step 4 (3c, manual, real key):** Send a chat message → the reply appears token-by-token; on completion the thread reloads persisted (refresh shows the user+assistant rows). Assert the two rows exist:
  ```sql
  select role, kind, content from public.ai_messages where couple_id='<id>' and kind='chat' order by created_at desc limit 2;
  ```
  With no key configured → the panel shows "El mediador aún no está activo." (JSON `{reason:"sin-key"}`). A forced 402/401 → the credito/auth warm message. The weekly reflection button still works (non-stream).

---

## Self-Review notes (author)

- **Spec coverage:** 3b data + AI avoid (Task 1), 3b UI (Task 2), streaming route (Task 3), streaming client + remove `sendMediatorMessage` (Task 4), verification (Task 5).
- **Sequencing caveat:** `PastDate` is defined in `citas-client.tsx` (Task 2) but imported by `citas/page.tsx` (Task 1). Implement Task 2's type/prop before building Task 1, or expect a red build until Task 2 lands — noted in Task 1 Step 3.
- **Key isolation:** the Route Handler reads the key with the service-role client and only streams assistant text; never sent to the browser.
- **SSE robustness:** the handler buffers partial lines across reads (`buffer`), tolerates keep-alives/`[DONE]`, and persists only a non-empty reply (no dangling user row on failure — failures return JSON before streaming).
- **Dead code note (for final review):** `runMediator`'s `"chat"` branch becomes unused after `sendMediatorMessage` removal; left intact to avoid touching the working summary path. Candidate for a later cleanup.
- **Out of scope (next):** streaming reflection/ideas/questions; post-date reflection; edit/delete history; realtime.
