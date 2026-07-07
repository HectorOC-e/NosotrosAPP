# Diseño — IA para ideas y preguntas

**Fecha:** 2026-07-07 · **App:** Nosotros (Next.js 15 App Router + Supabase)
Feature #2 del roadmap (ver [[nosotros-roadmap]]). Reusa la infra de IA del mediador ([[nosotros-ai-mediator]]).

## Objetivo

Dar variedad generada por IA a dos superficies del app:
1. **Ideas de cita** — un botón "Sorpréndenos con IA" en Citas genera una idea fresca (no del pool fijo),
   con guardar-a-favoritas de 1 toque.
2. **Preguntas de conversación** — un botón "Nueva pregunta con IA" en Comunicación genera una pregunta
   guía fresca, informada por el ánimo de la semana.

BYOK: ambas requieren que la pareja ya haya configurado el mediador (misma key en Vault); mismo gate.

## Decisiones (brainstorming)

| Decisión | Elección |
|---|---|
| Alcance v1 | Ideas + preguntas + guardar. **Mini-sugerencia en Inicio queda fuera** (iteración futura). |
| Formato de ideas IA | **Una idea fresca en la tarjeta central** (como "Sorpréndenos"); "Otra ✨" regenera. |
| Guardar | "♡ Guardar" persiste la idea de IA a `date_ideas` con `is_favorite:true`. |
| Sin cambios de esquema | Correcto — reusa `date_ideas`. |

## Infra compartida

Nuevo helper en `src/lib/actions/ai.ts`:

```
callCoupleAI(messages: ChatMessage[]): Promise<{ ok: boolean; text?: string; reason?: Reason }>
```

- Usa el cliente service-role → `get_couple_ai_key(coupleId)`; si no hay key → `{ ok:false, reason:"sin-key" }`.
- Llama `callOpenRouter({ apiKey, model, messages })` (model = `cfg.model || DEFAULT_AI_MODEL`).
- Mapea errores con el mismo criterio que `runMediator`: `OpenRouterError.status` → `saturado` (429) /
  `credito` (402) / `auth` (401/403) / `fallo` (else).
- Reutilizado por las dos acciones nuevas. **No** se modifica `runMediator` (ya funciona).

`Reason` se mantiene: `"sin-key" | "fallo" | "saturado" | "credito" | "auth"`.

## 1. Ideas de cita por IA

**Prompt** (`lib/ai/prompts.ts` → `dateIdeaMessages({ costFilter, avoid })`):
- System: mediador cálido de pareja (es-HN); pide UNA idea de cita concreta y realista para Honduras.
- Instrucción: responder **solo** con JSON `{"cost":"Gratis"|"Económica"|"Especial","text":"..."}`.
  Respetar `costFilter` si se pasó; evitar las ideas listadas en `avoid` (hasta ~15 textos existentes).

**Server Action** (`lib/actions/ai.ts` → `generateDateIdea`):
```
generateDateIdea(input: { costFilter?: string }):
  Promise<{ ok: boolean; idea?: { text: string; cost: "Gratis"|"Económica"|"Especial" }; reason?: Reason }>
```
- `requireCouple()`; lee hasta 15 textos de `date_ideas` de la pareja para `avoid`.
- `callCoupleAI(dateIdeaMessages(...))`; si `!ok` → propaga `reason`.
- Parseo defensivo del JSON: si falla o `cost` inválido → `cost = costFilter válido ?? "Económica"`,
  `text = texto crudo recortado`. Devuelve `{ ok:true, idea }`.

**Guardar** (`lib/actions/citas.ts` → `saveGeneratedIdea`):
```
saveGeneratedIdea(input: { text: string; cost: "Gratis"|"Económica"|"Especial" }): Promise<void>
```
- Inserta en `date_ideas` `{ couple_id, created_by, text, cost, vibe:null, is_favorite:true }`;
  `revalidatePath("/citas")`.

**UI** (`components/citas/citas-client.tsx`):
- Estado nuevo: `aiIdea: { text; cost } | null`, `aiError: string | null`, más el `pending` existente.
- Botón **"Sorpréndenos con IA ✨"** (junto a "Sorpréndenos"). onClick → `generateDateIdea({ costFilter })`
  (costFilter = primer filtro de costo seleccionado, si hay) → setea `aiIdea` o `aiError` (mensaje cálido
  por `reason`).
- Cuando `aiIdea` está presente, la tarjeta central muestra la idea de IA con badge
  **"✨ Sugerencia de IA · sin guardar"** y su tag de costo; botones: **"♡ Guardar"**
  (`saveGeneratedIdea` → limpia `aiIdea`), **"Otra ✨"** (regenera). "Sorpréndenos" (pool) limpia `aiIdea`
  y vuelve al modo pool.
- Mientras genera: la tarjeta muestra "Pensando una idea… ✨".
- `aiError` se muestra en texto cálido debajo de los botones (ej. `sin-key` → "Activa el mediador en
  Ajustes para ideas con IA ✨").

## 2. Preguntas de conversación por IA

**Prompt** (`lib/ai/prompts.ts` → `guidingQuestionMessages({ moodSummary })`):
- System: mediador cálido; pide UNA sola pregunta guía suave para que la pareja converse, es-HN,
  no clínica; puede considerar `moodSummary`. Responder solo con la pregunta (texto plano).

**Server Action** (`lib/actions/ai.ts` → `generateGuidingQuestion`):
```
generateGuidingQuestion(): Promise<{ ok: boolean; question?: string; reason?: Reason }>
```
- `requireCouple()`; junta moods de 7 días → `summarizeMoods`; `callCoupleAI(...)`; devuelve
  `{ ok, question: text }` o `reason`. No persiste nada.

**UI** (`components/comunicacion/comunicacion-client.tsx`):
- Botón **"Nueva pregunta ✨"** cerca de la grilla "PARA CONVERSAR CON SUAVIDAD".
- Estado: `aiQuestion: string | null`, `aiQPending`, `aiQError`. Muestra la pregunta en una tarjetita con
  **"Otra ✨"**; error cálido por `reason`.

## Manejo de errores
- Sin key → `reason:"sin-key"` → mensaje que invita a Ajustes.
- Fallo de OpenRouter → `saturado`/`credito`/`auth`/`fallo` con los mismos textos cálidos del mediador.
- Parseo de idea fallido → fallback a texto crudo + costo por defecto (nunca rompe).

## Pruebas
- **Unit:** el parseo defensivo del JSON de idea (JSON válido, JSON inválido, `cost` inválido) devuelve
  siempre un `{ text, cost }` válido.
- **Build:** `pnpm build` exit 0, `tsc` limpio.
- **E2E (con key real, opcional/manual):** en Citas, "Sorpréndenos con IA" muestra una idea, "♡ Guardar"
  la agrega a favoritas (aparece en la lista y persiste en `date_ideas` con `is_favorite=true`); en
  Comunicación, "Nueva pregunta ✨" muestra una pregunta. Sin key → mensaje de Ajustes.

## Fuera de alcance (v1)
- Mini-sugerencia de IA en Inicio.
- "Empezar esta cita" directo desde una idea de IA sin guardar (primero se guarda; luego Empezar desde favoritas).
- Ideas conscientes del monto del presupuesto (solo respeta la categoría de costo).
- Preguntas por-tema (la pregunta de IA es general).
- Streaming.
