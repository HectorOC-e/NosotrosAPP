# Diseño — Historial de citas (3b) + Streaming del chat (3c)

**Fecha:** 2026-07-07 · **App:** Nosotros (Next.js 15 App Router + Supabase)
Entregas 3b + 3c del roadmap ([[nosotros-roadmap]]), bundleadas. **Sin cambios de esquema** (ambas reusan lo existente).
Dos grupos de tareas: **3b primero** (ship-able), **3c** después.

## 3b — Historial de citas

### Objetivo
Mostrar las citas pasadas en Citas y que la IA las tome en cuenta para no repetir.

### Datos (ya existen)
Cada cita iniciada es un `budgets` con `date_idea_id` (ver [[nosotros-roadmap]] entrega 1). El historial =
esos budgets ordenados por `created_at` desc, **excluyendo el más reciente** (la salida activa). Por cada
uno: `label` (nombre), `created_at` (→ etiqueta relativa) y gasto total (suma de `expenses` de ese budget).

### Lectura
`src/app/(app)/citas/page.tsx` (Server Component) además de `date_ideas` consulta:
- `budgets` con `date_idea_id is not null`, orden `created_at` desc; el primero es el activo → se excluye,
  el resto es historial.
- `expenses (budget_id, amount)` de esos budgets → suma por budget en JS.
Arma `pastDates: { id: string; name: string; whenLabel: string; spent: number }[]` y lo pasa a `CitasClient`.
- `whenLabel` usa `relLabel(parseDbDate(...))` de `lib/format` (ya existe: "hoy"/"hace N días"…). Como
  `created_at` es timestamptz, se recorta a `YYYY-MM-DD` para `parseDbDate`.

### UI
Sección nueva **"CITAS PASADAS"** al final de `CitasClient` (después del form "agregar idea"):
- Lista de `pastDates`: `{name}` · `{whenLabel}` · `L {money(spent)}` con el estilo `.glass-subtle` de las
  favoritas. Empty state: "Aún no han empezado ninguna cita." cuando `pastDates` está vacío.

### IA evita citas hechas
`generateDateIdea` (`lib/actions/ai.ts`) amplía su `avoid`: además de las 15 ideas recientes, junta los
textos de las ideas **ya iniciadas** — `budgets` (date_idea_id not null) join `date_ideas.text` de la
pareja. Se deduplican y se cap­ean (~20 en total) antes de pasarlas al prompt. Así no re-sugiere citas hechas.

## 3c — Streaming del chat del mediador

### Objetivo
El chat del mediador responde token por token en vivo (mejor sensación de conversación). La reflexión
semanal, ideas y preguntas siguen como respuesta completa.

### Route Handler nuevo: `POST /api/mediator` (`src/app/api/mediator/route.ts`)
- `export const runtime = "nodejs"`.
- **Auth inline** (no `requireCouple`, que hace `redirect()` — inválido en route handler): `createClient()`
  (cookies) → `auth.getUser()`; si no hay user → `Response` 401. Lee `profiles.couple_id`+`id`; sin pareja
  → 401.
- Lee la config con el **cliente service-role** (`get_couple_ai_key`). Si no hay key o error de config →
  `Response.json({ ok: false, reason: "sin-key" | "fallo" })` (200; no es stream).
- Arma los `messages`: `chatSystem(moodSummary, coupleContext)` + historial (`ai_messages` kind='chat',
  últimos 10, cronológico) + `{ role:"user", content: text }`. Reusa `buildCoupleContext`, `summarizeMoods`.
- Llama a OpenRouter con `stream: true`, `max_tokens: 800`. Devuelve un `ReadableStream` que:
  - parsea el SSE de OpenRouter (`data: {json}\n\n`, hasta `data: [DONE]`), extrae
    `choices[0].delta.content`, y **encola solo el texto** (no el JSON).
  - acumula el reply completo.
  - al terminar el upstream: inserta la fila `user` (created_by = uid) y la fila `assistant`
    (created_by = null) en `ai_messages` con el cliente cookie (RLS couple-scoped) — **solo si** hubo
    respuesta no vacía; luego cierra el stream.
  - si OpenRouter responde no-2xx → mapea el status a razón y encola un marcador de error que el cliente
    reconoce (o, más simple: si el status no-ok se detecta antes de abrir el stream, devolver
    `Response.json({ ok:false, reason })`). Los 429/402/401-403 se detectan antes de empezar a leer.
- La respuesta streameada tiene `Content-Type: text/plain; charset=utf-8`.

### `mediator-panel.tsx`
- El envío del chat deja de llamar `sendMediatorMessage`; ahora hace `fetch("/api/mediator", { method:"POST", body: JSON.stringify({ text }) })`.
- Muestra el mensaje del usuario **optimista** de una, y una burbuja de asistente que se llena leyendo el
  `response.body` (reader + `TextDecoder`), token por token.
- Al terminar: `router.refresh()` para cargar el hilo persistido desde el server (y así descartar las
  burbujas transitorias, evitando duplicados).
- Si la respuesta es JSON (`content-type application/json`) con `{ok:false}` → muestra `aiReasonMessage(reason)`
  y no deja el mensaje optimista pegado.
- El botón "Reflexión de la semana ✨" sigue usando `generateWeeklyReflection` (Server Action, no-stream).
- `sendMediatorMessage` (Server Action) queda **sin uso desde la UI**; se elimina para no dejar código muerto.

### middleware
`middleware.ts` ya matchea `/api/...` (auth). Refresca sesión y devuelve `NextResponse.next()` — no
bufferiza el body streameado del route handler. No requiere cambios.

## Manejo de errores
- 3b: si no hay budgets/expenses → historial vacío (empty state). Nunca rompe.
- 3c: sin key → JSON `{reason:"sin-key"}` → "Activa el mediador en Ajustes". Fallo/red/parse → razón cálida;
  el mensaje optimista se descarta y no se persiste fila de asistente vacía.

## Pruebas
- **Build:** `pnpm build` exit 0, `tsc` limpio.
- **3b (SQL/manual):** con budgets sembrados (date_idea_id), la sección lista las pasadas (no la activa) con
  su gasto; `generateDateIdea` no re-sugiere una cita ya iniciada.
- **3c (manual, key real):** enviar un mensaje al mediador → aparece token por token; al terminar el hilo
  queda persistido (recarga muestra user+assistant). Sin key → mensaje de Ajustes. Un segundo dispositivo
  ve el mensaje tras refrescar.

## Fuera de alcance (siguiente)
- Streaming de reflexión / ideas / preguntas.
- Reflexión post-cita; editar/borrar el historial.
- Realtime (el hilo sigue por `router.refresh()`/`revalidatePath`).
