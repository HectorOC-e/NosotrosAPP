# AI Ideas + Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-generated date ideas ("Sorpréndenos con IA" + save) in Citas and AI-generated guiding questions ("Nueva pregunta ✨") in Comunicación, reusing the mediator's AI plumbing.

**Architecture:** A shared `callCoupleAI(coupleId, messages)` helper reads the couple's key via the service-role RPC, calls OpenRouter, and maps errors to warm reasons. Two new one-shot Server Actions use it. The date idea is returned as defensively-parsed JSON `{cost,text}`; saving persists it to `date_ideas` as a favorite. No schema change.

**Tech Stack:** Next.js 15 App Router · TypeScript · Supabase · OpenRouter · pnpm 11.1.1.

## Global Constraints

- **Package manager:** pnpm 11.1.1. Build: `pnpm build`. Local build needs `NODE_OPTIONS=--use-system-ca` (corporate proxy); PowerShell: `$env:NODE_OPTIONS='--use-system-ca'; pnpm build`.
- **BYOK gate:** these features only work if the couple configured the mediator (same key in Vault). No key → reason `"sin-key"` → warm message inviting Ajustes.
- **Reason type (unchanged):** `type Reason = "sin-key" | "fallo" | "saturado" | "credito" | "auth"` (already defined in `src/lib/actions/ai.ts`).
- **Secret handling:** the decrypted key is read only server-side via `createServiceClient()` + `get_couple_ai_key`; never crosses to the client. Only generated text crosses.
- **Cost categories:** `CostCat = "Gratis" | "Económica" | "Especial"` (from `@/lib/constants`, `COST_CATS`).
- **Copy:** Spanish, es-HN, warm, non-clinical. Reuse DS classes (`.glass`, `.field`, `Button` component, `.eyebrow`), accents rosa `#FF6F91` / violeta `#8B7CFF`.
- **Do NOT modify `runMediator`** — it works; only ADD the shared helper alongside it.

---

## File Structure

**Create:**
- `src/lib/ai/reason-messages.ts` — client-safe `aiReasonMessage(reason?)` mapping.

**Modify:**
- `src/lib/ai/prompts.ts` — add `dateIdeaMessages`, `guidingQuestionMessages`, `parseDateIdea`.
- `src/lib/actions/ai.ts` — add `callCoupleAI`, `generateDateIdea`, `generateGuidingQuestion`.
- `src/lib/actions/citas.ts` — add `saveGeneratedIdea`.
- `src/components/citas/citas-client.tsx` — AI idea generation/save UI.
- `src/components/comunicacion/comunicacion-client.tsx` — "Nueva pregunta ✨" UI.

---

## Task 1: Prompts + defensive idea parsing

**Files:**
- Modify: `src/lib/ai/prompts.ts`

**Interfaces:**
- Consumes: `MEDIATOR_SYSTEM` (already in prompts.ts), `ChatMessage` (from `@/lib/ai/openrouter`), `COST_CATS`/`CostCat` (from `@/lib/constants`).
- Produces:
  - `dateIdeaMessages(opts: { costFilter?: string; avoid: string[] }): ChatMessage[]`
  - `guidingQuestionMessages(opts: { moodSummary: string }): ChatMessage[]`
  - `parseDateIdea(raw: string, costFilter?: string): { text: string; cost: CostCat }`

- [ ] **Step 1: Add imports at the top of `src/lib/ai/prompts.ts`**

Add below the existing `import "server-only";`:
```ts
import type { ChatMessage } from "@/lib/ai/openrouter";
import { COST_CATS, type CostCat } from "@/lib/constants";
```

- [ ] **Step 2: Append the three functions to `src/lib/ai/prompts.ts`**

```ts
/** Messages to generate ONE fresh date idea as strict JSON {cost,text}. */
export function dateIdeaMessages(opts: {
  costFilter?: string;
  avoid: string[];
}): ChatMessage[] {
  const costLine = opts.costFilter
    ? `La idea debe ser de categoría de costo "${opts.costFilter}".`
    : "";
  const avoidLine = opts.avoid.length
    ? `Evita repetir estas ideas que ya tienen:\n- ${opts.avoid.slice(0, 15).join("\n- ")}`
    : "";
  return [
    {
      role: "system",
      content: `${MEDIATOR_SYSTEM}\n\nGeneras ideas de cita concretas y realistas para una pareja en Honduras.`,
    },
    {
      role: "user",
      content: [
        "Propón UNA sola idea de cita fresca, cálida y específica (una o dos frases).",
        costLine,
        avoidLine,
        'Responde SOLO con JSON válido, sin texto adicional, con esta forma exacta: {"cost":"Gratis|Económica|Especial","text":"..."}.',
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

/** Messages to generate ONE gentle guiding question (plain text). */
export function guidingQuestionMessages(opts: {
  moodSummary: string;
}): ChatMessage[] {
  return [
    { role: "system", content: MEDIATOR_SYSTEM },
    {
      role: "user",
      content: [
        "Propón UNA sola pregunta guía, suave y abierta, para que la pareja converse con calma.",
        "En español (es-HN), cálida, sin tono clínico ni de terapia.",
        `Contexto (úsalo con delicadeza, no lo menciones literalmente): ${opts.moodSummary}`,
        "Responde SOLO con la pregunta, sin comillas ni texto adicional.",
      ].join("\n"),
    },
  ];
}

/** Defensively parses the model's JSON date idea; never throws. */
export function parseDateIdea(
  raw: string,
  costFilter?: string,
): { text: string; cost: CostCat } {
  const isCost = (v: unknown): v is CostCat =>
    typeof v === "string" && (COST_CATS as readonly string[]).includes(v);
  const fallbackCost: CostCat = isCost(costFilter) ? costFilter : "Económica";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]) as { text?: unknown; cost?: unknown };
      const text = typeof obj.text === "string" ? obj.text.trim() : "";
      if (text) return { text, cost: isCost(obj.cost) ? obj.cost : fallbackCost };
    }
  } catch {
    // fall through to raw-text fallback
  }
  const text = raw.trim().slice(0, 200) || "Una cita especial, ustedes dos";
  return { text, cost: fallbackCost };
}
```

- [ ] **Step 3: Unit-test `parseDateIdea` (Node, replicating the logic)**

Create a throwaway script in the scratchpad `…/scratchpad/parse-idea.mjs` mirroring the function body and assert:
```js
// valid JSON
parse('{"cost":"Gratis","text":"Picnic al amanecer"}') // => {text:"Picnic al amanecer", cost:"Gratis"}
// JSON embedded in prose
parse('Aquí va: {"cost":"Especial","text":"Cena sorpresa"} ¡disfruten!') // => cost "Especial"
// invalid cost => fallback
parse('{"cost":"Barato","text":"Caminata"}', "Relax") // cost "Económica" (Relax is not a CostCat)
// non-JSON => raw text + fallback cost
parse('Vayan al cine', "Gratis") // {text:"Vayan al cine", cost:"Gratis"}
```
Run: `node …/scratchpad/parse-idea.mjs`
Expected: all four assertions pass (print `OK`). This validates the algorithm before it ships.

- [ ] **Step 4: Verify the build**

Run: `pnpm build`
Expected: exit 0, `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/prompts.ts
git commit -m "feat(ai): prompts for date ideas + guiding questions, defensive JSON parse"
```

---

## Task 2: Shared `callCoupleAI` + generation actions + save + reason messages

**Files:**
- Create: `src/lib/ai/reason-messages.ts`
- Modify: `src/lib/actions/ai.ts`
- Modify: `src/lib/actions/citas.ts`

**Interfaces:**
- Consumes: `requireCouple`, `createServiceClient`, `callOpenRouter`/`OpenRouterError`/`ChatMessage`, `DEFAULT_AI_MODEL`, `summarizeMoods`, `toInputDate`, and Task 1's `dateIdeaMessages`/`guidingQuestionMessages`/`parseDateIdea`; `CostCat` from constants.
- Produces:
  - `aiReasonMessage(reason?: string): string`
  - `generateDateIdea(input: { costFilter?: string }): Promise<{ ok: boolean; idea?: { text: string; cost: CostCat }; reason?: Reason }>`
  - `generateGuidingQuestion(): Promise<{ ok: boolean; question?: string; reason?: Reason }>`
  - `saveGeneratedIdea(input: { text: string; cost: CostCat }): Promise<void>`

- [ ] **Step 1: Create `src/lib/ai/reason-messages.ts`**

```ts
/** Warm, user-facing message for an AI failure reason. Client-safe (no secrets). */
export function aiReasonMessage(reason?: string): string {
  switch (reason) {
    case "sin-key":
      return "Activa el mediador en Ajustes para usar la IA ✨";
    case "saturado":
      return "El modelo está saturado ahora mismo (suele pasar con los modelos gratuitos). Prueben de nuevo en un momento, o elijan otro modelo en Ajustes.";
    case "credito":
      return "Tu cuenta de OpenRouter necesita más créditos para este modelo. Agrégalos, o elige un modelo más económico en Ajustes.";
    case "auth":
      return "Hay un problema con la API key de OpenRouter. Revísala en Ajustes.";
    default:
      return "La IA no pudo responder ahora, intenten de nuevo.";
  }
}
```

- [ ] **Step 2: Add `callCoupleAI` + the two actions to `src/lib/actions/ai.ts`**

Extend the prompts import to include the new builders and the parser:
```ts
import {
  chatSystem,
  reflectionUserPrompt,
  summarizeMoods,
  dateIdeaMessages,
  guidingQuestionMessages,
  parseDateIdea,
} from "@/lib/ai/prompts";
```
Add `CostCat` to the constants import:
```ts
import { TOPICS, DEFAULT_AI_MODEL, type CostCat } from "@/lib/constants";
```
Append at the end of the file:
```ts
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

/** Generates one fresh AI date idea, respecting the cost filter and avoiding existing ideas. */
export async function generateDateIdea(input: {
  costFilter?: string;
}): Promise<{ ok: boolean; idea?: { text: string; cost: CostCat }; reason?: Reason }> {
  const { supabase, coupleId } = await requireCouple();
  const { data: existing } = await supabase
    .from("date_ideas")
    .select("text")
    .limit(15);
  const avoid = (existing ?? []).map((r) => r.text);
  const res = await callCoupleAI(
    coupleId,
    dateIdeaMessages({ costFilter: input.costFilter, avoid }),
  );
  if (!res.ok || !res.text) return { ok: false, reason: res.reason ?? "fallo" };
  return { ok: true, idea: parseDateIdea(res.text, input.costFilter) };
}

/** Generates one fresh guiding question, informed by the week's moods. Ephemeral. */
export async function generateGuidingQuestion(): Promise<{
  ok: boolean;
  question?: string;
  reason?: Reason;
}> {
  const { supabase, coupleId } = await requireCouple();
  const since = toInputDate(new Date(Date.now() - 7 * 86_400_000));
  const { data: moods } = await supabase
    .from("moods")
    .select("mood_emoji, mood_date")
    .gte("mood_date", since);
  const moodSummary = summarizeMoods(moods ?? []);
  const res = await callCoupleAI(coupleId, guidingQuestionMessages({ moodSummary }));
  if (!res.ok || !res.text) return { ok: false, reason: res.reason ?? "fallo" };
  return { ok: true, question: res.text };
}
```

- [ ] **Step 3: Add `saveGeneratedIdea` to `src/lib/actions/citas.ts`**

Append:
```ts
/** Persists an AI-generated idea to the couple's favorites. */
export async function saveGeneratedIdea(input: {
  text: string;
  cost: CostCat;
}): Promise<void> {
  const { supabase, coupleId, userId } = await requireCouple();
  const text = input.text.trim();
  if (!text) return;
  const { error } = await supabase.from("date_ideas").insert({
    couple_id: coupleId,
    created_by: userId,
    text,
    cost: input.cost,
    vibe: null,
    is_favorite: true,
  });
  if (error) throw error;
  revalidatePath("/citas");
}
```
(`CostCat`, `requireCouple`, `revalidatePath` are already imported in this file.)

- [ ] **Step 4: Verify the build**

Run: `pnpm build`
Expected: exit 0, `tsc` clean (validates the shared helper + RPC types + parser wiring).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/reason-messages.ts src/lib/actions/ai.ts src/lib/actions/citas.ts
git commit -m "feat(ai): callCoupleAI helper + generateDateIdea/generateGuidingQuestion + saveGeneratedIdea"
```

---

## Task 3: AI idea UI in Citas

**Files:**
- Modify: `src/components/citas/citas-client.tsx`

**Interfaces:**
- Consumes: `generateDateIdea`, `saveGeneratedIdea` (add to imports), `aiReasonMessage`, `COST_CATS`/`CostCat`.

- [ ] **Step 1: Extend imports**

Add `saveGeneratedIdea` and `generateDateIdea`:
```ts
import { addIdea, setFavorite, startDate, saveGeneratedIdea } from "@/lib/actions/citas";
import { generateDateIdea } from "@/lib/actions/ai";
import { aiReasonMessage } from "@/lib/ai/reason-messages";
```
Add `COST_CATS` to the constants import (keep `type CostCat` too):
```ts
import {
  FILTER_CATS,
  COST_CATS,
  COST_COLOR,
  type CostCat,
} from "@/lib/constants";
```

- [ ] **Step 2: Add AI state + handlers**

After the existing `beginDate` function, add:
```ts
  const [aiIdea, setAiIdea] = useState<{ text: string; cost: CostCat } | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const costFilter = selectedFilters.find((f) =>
    (COST_CATS as readonly string[]).includes(f),
  );

  function generateAi() {
    setAiError(null);
    setAiGenerating(true);
    startTransition(async () => {
      const r = await generateDateIdea({ costFilter });
      setAiGenerating(false);
      if (r.ok && r.idea) setAiIdea(r.idea);
      else setAiError(aiReasonMessage(r.reason));
    });
  }

  function saveAi() {
    if (!aiIdea) return;
    const idea = aiIdea;
    startTransition(async () => {
      await saveGeneratedIdea(idea);
      setAiIdea(null);
    });
  }

  function backToPool() {
    setAiIdea(null);
    setAiError(null);
  }
```

- [ ] **Step 3: Replace the central idea card body to support AI mode**

Replace the whole central card `<div className="glass mb-4 ...">…</div>` block with:
```tsx
      {/* Central idea card */}
      <div className="glass mb-4 flex min-h-[150px] flex-col justify-center rounded-[26px] p-[26px_22px]">
        {aiGenerating ? (
          <div className="text-center text-[14.5px] text-ink-secondary">
            Pensando una idea… ✨
          </div>
        ) : aiIdea ? (
          <>
            <div className="mb-3.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-violeta/20 px-2.5 py-1 text-[11px] text-violeta">
                ✨ Sugerencia de IA · sin guardar
              </span>
              <span className="rounded-full bg-violeta/15 px-2.5 py-1 text-[11px] text-violeta">
                {aiIdea.cost}
              </span>
            </div>
            <div className="mb-5 font-serif text-[21px] font-medium italic leading-[1.4] text-ink">
              {aiIdea.text}
            </div>
            <div className="flex gap-2.5">
              <Button size="md" onClick={saveAi} disabled={pending} className="flex-1 py-[13px]">
                ♡ Guardar
              </Button>
              <Button variant="ghost" size="md" onClick={generateAi} disabled={pending} className="px-4 py-[13px]">
                Otra ✨
              </Button>
              <Button variant="ghost" size="md" onClick={backToPool} disabled={pending} className="px-4 py-[13px]">
                Volver
              </Button>
            </div>
          </>
        ) : displayIdea ? (
          <>
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {displayIdea.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-violeta/15 px-2.5 py-1 text-[11px] text-violeta"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mb-5 font-serif text-[21px] font-medium italic leading-[1.4] text-ink">
              {displayIdea.text}
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-2.5">
                <Button size="md" onClick={surprise} className="flex-1 py-[13px]">
                  Sorpréndenos
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={toggleFavorite}
                  disabled={pending}
                  className="px-4 py-[13px]"
                >
                  {displayIdea.isFavorite ? "Guardada ✓" : "Guardar como favorita"}
                </Button>
              </div>
              <Button
                size="md"
                onClick={() => beginDate(displayIdea.id)}
                disabled={pending}
                className="w-full py-[13px]"
              >
                Empezar esta cita →
              </Button>
              <Button
                variant="ghost"
                size="md"
                onClick={generateAi}
                disabled={pending}
                className="w-full py-[13px]"
              >
                Sorpréndenos con IA ✨
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center text-[14.5px] text-ink-secondary">
              No hay ideas con esos filtros — agreguen una abajo 👇
            </div>
            <Button size="md" onClick={generateAi} disabled={pending} className="w-full py-[13px]">
              Sorpréndenos con IA ✨
            </Button>
          </div>
        )}
        {aiError && (
          <div className="mt-3 text-center text-[13px]" style={{ color: "#FF6B6B" }}>
            {aiError}
          </div>
        )}
      </div>
```

- [ ] **Step 4: Verify the build**

Run: `pnpm build`
Expected: exit 0, `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/citas/citas-client.tsx
git commit -m "feat(citas): Sorpréndenos con IA — generate, save, regenerate"
```

---

## Task 4: "Nueva pregunta ✨" UI in Comunicación

**Files:**
- Modify: `src/components/comunicacion/comunicacion-client.tsx`

**Interfaces:**
- Consumes: `generateGuidingQuestion` (Task 2), `aiReasonMessage`.

- [ ] **Step 1: Extend imports**

Add:
```ts
import { generateGuidingQuestion } from "@/lib/actions/ai";
import { aiReasonMessage } from "@/lib/ai/reason-messages";
```

- [ ] **Step 2: Add state + handler**

After `const [revealed, setRevealed] = useState<Record<string, boolean>>({});`, add:
```ts
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [aiQPending, setAiQPending] = useState(false);
  const [aiQError, setAiQError] = useState<string | null>(null);

  function newQuestion() {
    setAiQError(null);
    setAiQPending(true);
    startTransition(async () => {
      const r = await generateGuidingQuestion();
      setAiQPending(false);
      if (r.ok && r.question) setAiQuestion(r.question);
      else setAiQError(aiReasonMessage(r.reason));
    });
  }
```

- [ ] **Step 3: Add the "Nueva pregunta" block after the topics grid**

Immediately after the topics grid `</div>` (the `grid grid-cols-2` block) and BEFORE `<MediatorPanel …>`, insert:
```tsx
      {/* AI guiding question */}
      <div className="glass-subtle mb-5 rounded-[18px] p-[15px]">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex-1 text-[13px] font-semibold text-ink">
            Pregunta guía con IA
          </span>
          <button
            onClick={newQuestion}
            disabled={pending}
            className="rounded-full bg-violeta/20 px-2.5 py-1 text-[11px] text-violeta disabled:opacity-60"
          >
            {aiQuestion ? "Otra ✨" : "Nueva pregunta ✨"}
          </button>
        </div>
        {aiQPending ? (
          <span className="text-[12px] text-ink-tertiary">Pensando… ✨</span>
        ) : aiQuestion ? (
          <span className="font-serif text-[14px] italic leading-[1.4] text-ink-secondary">
            {aiQuestion}
          </span>
        ) : (
          <span className="text-[12px] text-ink-tertiary">
            Toca para que la IA les proponga una pregunta.
          </span>
        )}
        {aiQError && (
          <div className="mt-2 text-[12.5px]" style={{ color: "#FF6B6B" }}>
            {aiQError}
          </div>
        )}
      </div>
```

- [ ] **Step 4: Verify the build**

Run: `pnpm build`
Expected: exit 0, `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/comunicacion/comunicacion-client.tsx
git commit -m "feat(comunicacion): Nueva pregunta con IA (guiding question)"
```

---

## Task 5: Verification

**Files:** none committed.

- [ ] **Step 1: Confirm the parse unit test still passes** (from Task 1 Step 3 script) — `node …/scratchpad/parse-idea.mjs` prints all `OK`.
- [ ] **Step 2: Final build** — `pnpm build` exit 0, `tsc` clean, 14 routes.
- [ ] **Step 3: Live smoke (optional, needs the couple's real key + credits):** In Citas, "Sorpréndenos con IA ✨" shows an AI idea with the "sin guardar" badge; "♡ Guardar" makes it appear in Favoritas and inserts a `date_ideas` row with `is_favorite=true`. In Comunicación, "Nueva pregunta ✨" shows a question. With no key configured, both show the "Activa el mediador en Ajustes" message. (Assert the saved idea via SQL: `select text, cost, is_favorite from date_ideas order by created_at desc limit 1;`.)

---

## Self-Review notes (author)

- **Spec coverage:** shared helper (Task 2 `callCoupleAI`), AI ideas + parse (Tasks 1–2), Citas UI + save (Tasks 2–3), guiding questions (Tasks 2, 4), warm error mapping (`aiReasonMessage`, Task 2), gate via `sin-key` reason. No schema change (matches spec).
- **runMediator untouched** — the shared helper is added alongside; the mediator keeps its own inline error mapping (protected working code), a small accepted duplication noted for the final review.
- **Out of scope (per spec):** Inicio mini-suggestion, "Empezar" directly from an unsaved AI idea, amount-aware ideas, per-topic questions, streaming.
- **Type consistency:** `generateDateIdea` returns `{ idea?: { text; cost: CostCat } }`; `saveGeneratedIdea` consumes `{ text; cost: CostCat }`; `aiReasonMessage(reason?)` used by both new clients.
