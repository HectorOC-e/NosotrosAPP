# Diseño — Vincular cita ↔ salida

**Fecha:** 2026-07-07 · **App:** Nosotros (Next.js 15 App Router + Supabase)
Primera feature de un roadmap más grande (ver §Contexto). Siguientes en cola: IA para ideas/preguntas,
simplificar Ajustes (presets), unificar conceptos.

## Objetivo

Conectar tres pantallas hoy desconectadas — **Citas** (ideas de cita), **Gastos** (salida activa =
presupuesto) e **Inicio**. Al **"Empezar esta cita"** desde Citas, esa cita se vuelve la **salida activa**
de Gastos, y en **Inicio** la pareja ve **en qué cita están** (nombre + presupuesto + gasto).

## Decisiones (brainstorming)

| Decisión | Elección |
|---|---|
| Al empezar una cita con salida activa existente | **Crear una salida NUEVA** (la anterior queda como historial; no se mezclan gastos). |
| Nombre de la salida | **Nombre corto automático** derivado de la idea, **editable** en Gastos; la idea completa queda vinculada. |
| A dónde va tras empezar | **A Gastos** (donde ya aparece la salida activa lista para registrar). |

## Modelo actual (para contexto)

- `date_ideas` (id, couple_id, text, cost, vibe, is_favorite) — el pool de ideas de cita.
- `budgets` (id, couple_id, label, limit_amount, created_at) — la "salida activa" = el budget más reciente.
- `expenses` (budget_id, …) — gastos colgados de una salida.
- `Inicio` muestra "PRESUPUESTO ACTIVO" = el budget más reciente con barra de progreso.
- `saveOuting` (gastos.ts) edita el budget activo (nombre + límite); `addExpense` crea uno si no hay.

## Cambios de esquema (única adición)

```sql
alter table public.budgets
  add column date_idea_id uuid references public.date_ideas(id) on delete set null;
```

Nullable. Vincula cada salida con la idea de la que nació. `on delete set null`: si borran la idea, la
salida sobrevive sin el vínculo. Sin cambios de RLS (la política couple-scoped de `budgets` ya cubre la
columna nueva).

## Server Action: `startDate(dateIdeaId)`

Archivo: `src/lib/actions/citas.ts` (junto a `addIdea`/`setFavorite`).

- `requireCouple()`.
- Lee la idea: `select text from date_ideas where id = dateIdeaId` (RLS garantiza que sea de la pareja).
  Si no existe → return sin efecto.
- Deriva el nombre corto (`shortDateName`, ver abajo).
- **Inserta un budget nuevo** (pasa a ser la salida activa por `created_at`):
  `{ couple_id, label: shortName, limit_amount: 0, date_idea_id: dateIdeaId }`.
- `revalidatePath("/citas")`, `"/gastos"`, `"/inicio")`.
- Devuelve `{ ok: true }`; el cliente navega a `/gastos`.

**`shortDateName(text: string): string`** (helper local o en `lib/format.ts`):
- Trim; si `length <= 32`, devuelve tal cual (sin puntuación final).
- Si no, corta en el último espacio antes de 32 chars y agrega `…`.
- Ejemplo: `"Vean el atardecer desde la azotea con café y sin celulares"` → `"Vean el atardecer desde la…"`.
- No busca ser perfecto: es editable en Gastos.

## UI

### Citas (`/citas` → `CitasClient`)
Botón **"Empezar esta cita →"** en: la idea central, el resultado de "Sorpréndenos", y cada favorita.
- `onClick` → `startTransition(async () => { const r = await startDate(idea.id); if (r.ok) router.push("/gastos"); })`.
- Estilo: usa `.btn-primary` o un botón acorde al DS; el botón vive junto a la acción de favorito.

### Inicio (`/inicio`)
La tarjeta de presupuesto se vuelve consciente de la cita. La query del budget activo suma
`date_idea_id`; si está presente, se hace un segundo fetch del `text` de la idea.
- **Con `date_idea_id`:** eyebrow **"CITA ACTUAL"**; muestra `budget.label` (nombre corto) grande, la
  frase completa de la idea en `text-ink-tertiary` chica debajo, y la barra de presupuesto existente
  (%, `L gastado de L límite`).
- **Sin `date_idea_id` (salida creada directo en Gastos):** eyebrow "PRESUPUESTO ACTIVO", como hoy.
- **Sin salida:** empty state actual.

### Gastos (`/gastos`)
Sin cambios estructurales: la salida activa *es* la cita; "definir salida" ya permite renombrar y poner
límite (vía de edición del nombre). *(Opcional menor, no v1: mostrar la frase completa de la idea como
subtítulo de la salida.)*

## Manejo de errores
- `startDate` con id inexistente / ajeno → RLS no devuelve la idea → return sin efecto (no crea salida).
- Sin sesión/pareja → `requireCouple` redirige a `/login`.

## Pruebas
- **SQL:** tras `startDate`, existe un budget nuevo con `date_idea_id` seteado y es el más reciente.
- **Build:** `pnpm build` exit 0, `tsc` limpio.
- **E2E (Playwright + sesión inyectada):** en `/citas`, "Empezar esta cita" → navega a `/gastos` con la
  salida activa nombrada; `/inicio` muestra "CITA ACTUAL" con el nombre + la frase de la idea + la barra.
  Empezar una segunda cita crea otra salida activa y la primera queda en historial (sus gastos intactos).

## Fuera de alcance (v1)
- "Terminar cita" explícito (empezar otra la reemplaza; la anterior queda como historial).
- Pantalla de historial de citas.
- Reflexión post-cita.
- Mostrar la idea completa dentro de Gastos (detalle menor).
