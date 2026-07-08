# Feedback de errores (toasts + error boundaries) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la app diga algo cuando falla: toasts para las Server Actions y error boundaries para los fallos de render.

**Architecture:** Las 13 mutaciones dejan de lanzar y devuelven `ActionResult` (`{ok:true} | {ok:false,message}`)
con copy cálido en español. Los 5 client components leen ese resultado y muestran un toast de `sileo`.
Dos error boundaries (`(app)/error.tsx` y `global-error.tsx`) atrapan lo que un toast no puede: los Server
Components que revientan al renderizar.

**Tech Stack:** Next.js 15 App Router (Server Actions, `error.tsx`, `global-error.tsx`), React 19
(`useTransition`), TypeScript, Supabase SSR, `sileo@0.1.5` (toasts), Tailwind + tokens del design system.

**Spec:** `docs/superpowers/specs/2026-07-08-error-feedback-design.md`

## Global Constraints

- **No hay test runner en este repo.** `package.json` no tiene jest ni vitest; `playwright` está instalado pero
  no hay suite. **No se puede hacer TDD.** La verificación de cada tarea es build verde (incluye `tsc`); la
  prueba en navegador va al final. **No añadas un test runner. No escribas archivos de test.**
- **Comando de build (exacto):** `NODE_OPTIONS=--use-system-ca corepack pnpm build`
  (proxy TLS corporativo; `pnpm` no está en el PATH → hay que pasar por `corepack`).
- **Instalación de paquetes:** `NODE_OPTIONS=--use-system-ca corepack pnpm add sileo@0.1.5 --save-exact`.
  **Versión exacta, sin `^`** — `sileo` está en `0.1.x` y un patch puede romper la API.
- **Sin cambios de esquema.** Cero migraciones, cero SQL. Si crees que necesitas una, estás BLOCKED: pregunta.
- **Regla del repo:** en un archivo `"use server"`, **todo export es una Server Action invocable desde el
  cliente**. Los helpers y los tipos NO se exportan desde ahí; viven en módulos planos.
- **Idioma:** todo el copy de UI en español (es-HN), con el tono cálido y en plural del resto de la app
  ("Inténtenlo de nuevo", no "Inténtalo de nuevo"). Comentarios de código en inglés.
- **Sin render optimista.** El patrón es `startTransition(async () => { const r = await action(); … })` y dejar
  que `revalidatePath` refresque el Server Component.
- **No toques `src/lib/actions/ai.ts` ni `src/lib/actions/onboarding.ts`.** Ya tienen su propio canal de error
  con copy en español (`aiReasonMessage`, `friendlyAuthError`). Están fuera de alcance.
- **`requireCouple()` hace `redirect("/login")`.** Eso no es un error a reportar; no lo envuelvas en try/catch.
- **Toasts de éxito Y de error.** Decisión explícita del usuario. Los de éxito llevan título corto y
  `duration: 2000`. Los de error usan `title: r.message` y **no** llevan `description` (repetiría).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/action-result.ts` (nuevo) | El tipo `ActionResult` y los helpers `ok()` / `fail()`. Módulo plano, sin `"use server"`. |
| `src/app/(app)/layout.tsx` | Monta `<Toaster>` y carga `sileo/styles.css`. |
| `src/app/(app)/error.tsx` (nuevo) | Boundary de las 6 pantallas autenticadas. Conserva header y tab bar. |
| `src/app/global-error.tsx` (nuevo) | Red última si revienta el layout raíz. Renderiza su propio `<html>`. |
| `src/lib/actions/{citas,gastos,calendario,comunicacion,ajustes}.ts` | Devuelven `ActionResult`. |
| `src/components/{citas,gastos,calendario,comunicacion,ajustes}/*` | Leen el resultado y lanzan el toast. |

---

### Task 1: `ActionResult` + instalar sileo + montar el `<Toaster>`

**Files:**
- Create: `src/lib/action-result.ts`
- Modify: `package.json` (vía `pnpm add`), `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: nada.
- Produces (lo importan todas las tareas siguientes):
  - `type ActionResult = { ok: true } | { ok: false; message: string }` desde `@/lib/action-result`
  - `ok(): ActionResult`
  - `fail(message: string): ActionResult`
  - Un `<Toaster>` montado, de modo que `sileo.success(...)` / `sileo.error(...)` funcionen desde cualquier
    Client Component bajo `(app)`.

- [ ] **Step 1: Instalar sileo con versión exacta**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm add sileo@0.1.5 --save-exact`
Expected: exit 0. Comprueba que en `package.json` la línea sea `"sileo": "0.1.5"` — **sin** `^`. Si tiene `^`,
edítala a mano y vuelve a correr `corepack pnpm install`.

- [ ] **Step 2: Crear el módulo del contrato**

Crea `src/lib/action-result.ts` con exactamente esto:

```ts
/**
 * What every mutation Server Action returns. Actions never throw for expected
 * failures: a thrown error is redacted in production ("An error occurred in the
 * Server Components render"), so the client could never tell the user what went
 * wrong. `message` is warm, specific, user-facing Spanish.
 *
 * This module is deliberately NOT "use server": in such a file every export
 * becomes a client-invocable Server Action, and these are plain helpers.
 */
export type ActionResult = { ok: true } | { ok: false; message: string };

export const ok = (): ActionResult => ({ ok: true });
export const fail = (message: string): ActionResult => ({ ok: false, message });
```

- [ ] **Step 3: Montar el Toaster en el layout autenticado**

`src/app/(app)/layout.tsx` es un Server Component, pero `Toaster` trae su propio `"use client"`, así que puede
renderizarse directamente. El bloque de imports actual es:

```tsx
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/queries";
import { derivePartners } from "@/lib/partners";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
```

Añade al final del bloque:

```tsx
import { Toaster } from "sileo";
import "sileo/styles.css";
```

Y en el JSX, el `return` actual es:

```tsx
  return (
    <div className="flex justify-center">
      <div className="app-panel">
        <AppHeader initialA={personA.initial} initialB={personB.initial} />
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-5">{children}</div>
        <BottomNav />
      </div>
    </div>
  );
```

Reemplázalo por:

```tsx
  return (
    <div className="flex justify-center">
      <div className="app-panel">
        <AppHeader initialA={personA.initial} initialB={personB.initial} />
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-5">{children}</div>
        <BottomNav />
      </div>
      {/* offset clears the AppHeader; tuned against the browser, not by eye. */}
      <Toaster theme="dark" position="top-center" offset={{ top: 72 }} />
    </div>
  );
```

- [ ] **Step 4: Verificar que el build pasa**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm build`
Expected: exit 0, `tsc` limpio. **Anota el tamaño de `/citas`** que imprime la tabla de rutas (antes de esta
rama era `4.98 kB`); lo necesitamos para reportar el coste real de `motion` en el bundle.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/action-result.ts "src/app/(app)/layout.tsx"
git commit -m "feat: ActionResult contract and sileo Toaster"
```

---

### Task 2: Los error boundaries

**Files:**
- Create: `src/app/(app)/error.tsx`
- Create: `src/app/global-error.tsx`

**Interfaces:**
- Consumes: nada de tareas anteriores. (No usa `sileo`: un toast necesita un cliente montado, y aquí el
  árbol ya se cayó.)
- Produces: nada que otras tareas consuman.

**Contexto:** Next pasa a `error.tsx` las props `{ error: Error & { digest?: string }, reset: () => void }`.
`reset()` reintenta renderizar el segmento. Ambos archivos **deben** ser Client Components.

- [ ] **Step 1: El boundary del grupo autenticado**

Crea `src/app/(app)/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";

/**
 * Catches render failures of the six authenticated screens. It lives inside the
 * (app) group, so AppHeader and BottomNav survive: the user stays in the app.
 * A toast cannot cover this — by the time this renders, no client component of
 * the failed screen is mounted.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 text-[34px]">🌧️</div>
      <h2 className="mb-2 font-serif text-[20px] text-ink">Algo se nos cayó</h2>
      <p className="mb-6 max-w-[260px] text-[13.5px] leading-[1.5] text-ink-tertiary">
        No fue culpa de ustedes. Vuelvan a intentarlo en un momento.
      </p>
      <button onClick={reset} className="btn-primary px-8">
        Reintentar
      </button>
    </div>
  );
}
```

- [ ] **Step 2: La red última**

`global-error.tsx` reemplaza el layout raíz cuando este revienta, así que **debe** renderizar sus propios
`<html>` y `<body>`. No puede usar las clases del design system (`globals.css` puede no haber cargado), así
que lleva estilos en línea.

Crea `src/app/global-error.tsx`:

```tsx
"use client";

import { useEffect } from "react";

/**
 * Last resort: the root layout itself failed. This replaces it, so it must render
 * its own <html> and <body>, and cannot rely on globals.css having loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#12101A",
          color: "#EDE9F5",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h2 style={{ fontSize: 20, margin: 0 }}>Algo se nos cayó</h2>
        <p style={{ fontSize: 14, opacity: 0.7, margin: 0, maxWidth: 280 }}>
          No fue culpa de ustedes. Vuelvan a intentarlo en un momento.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            padding: "12px 32px",
            borderRadius: 999,
            border: "none",
            background: "#FF6F91",
            color: "#12101A",
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verificar que el build pasa**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm build`
Expected: exit 0, `tsc` limpio.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/error.tsx" src/app/global-error.tsx
git commit -m "feat: error boundaries for the app group and the root layout"
```

---

### Task 3: `citas.ts` y `citas-client.tsx`

**Files:**
- Modify: `src/lib/actions/citas.ts` (imports; el guard; las 6 acciones)
- Modify: `src/components/citas/citas-client.tsx` (imports; 6 call sites)

**Interfaces:**
- Consumes: `ActionResult`, `ok()`, `fail()` de `@/lib/action-result`; el `<Toaster>` montado en la Task 1.
- Produces (firmas nuevas, las usa `citas-client.tsx`):
  - `addIdea(input: { text: string; cost: CostCat }): Promise<ActionResult>`
  - `setFavorite(id: string, value: boolean): Promise<ActionResult>`
  - `startDate(dateIdeaId: string): Promise<ActionResult>`
  - `saveGeneratedIdea(input: { text: string; cost: CostCat; vibes: string[] }): Promise<ActionResult>`
  - `renameOuting(budgetId: string, label: string): Promise<ActionResult>`
  - `deletePastDate(budgetId: string): Promise<ActionResult>`

> **Ojo con `startDate`:** hoy devuelve `{ ok: boolean }`. Su nuevo tipo es `ActionResult`, que también tiene
> `.ok`, así que `if (r.ok) router.push("/gastos")` sigue compilando. No es un accidente: es el mismo campo.

- [ ] **Step 1: Añadir el import del contrato**

En `src/lib/actions/citas.ts`, tras la línea `import type { SupabaseServerClient } from "@/lib/supabase/types";`
añade:

```ts
import { ok, fail, type ActionResult } from "@/lib/action-result";
```

- [ ] **Step 2: Convertir el guard**

El guard `isEditablePastDate` hoy devuelve `boolean` y **lanza** si la query falla. Ahora debe devolver un
`ActionResult` para que la acción pueda distinguir "rechazado" de "se cayó la red" — y, crucialmente, debe
**fallar cerrado**: si no puede comprobar cuál es la salida activa, no autoriza la mutación.

Reemplaza la función `isEditablePastDate` entera (su JSDoc incluido) por:

```ts
/**
 * Guards the two history mutations below. Returns ok() only when the budget is a
 * past date the couple may edit: it exists and is visible under RLS, it is a cita
 * (`date_idea_id` set), and it is not the active outing. The UI never offers the
 * active outing, but Server Actions are client-invocable endpoints, so the server
 * checks too. Fails closed: if we cannot determine the active outing, we refuse
 * rather than risk deleting it and cascading its expenses away.
 */
async function checkEditablePastDate(
  supabase: SupabaseServerClient,
  budgetId: string,
): Promise<ActionResult> {
  const { data: budget, error } = await supabase
    .from("budgets")
    .select("id, date_idea_id")
    .eq("id", budgetId)
    .maybeSingle();
  if (error) return fail("No pudimos verificar la cita. Revisen su conexión.");
  if (!budget?.date_idea_id) return fail("Esa cita ya no está en el historial.");

  // getActiveBudgetId throws on a query failure — that must not become "no active outing".
  let activeId: string | null;
  try {
    activeId = await getActiveBudgetId(supabase);
  } catch {
    return fail("No pudimos verificar la cita. Revisen su conexión.");
  }
  if (budget.id === activeId) return fail("Esa cita ya no está en el historial.");
  return ok();
}
```

- [ ] **Step 3: Convertir `renameOuting` y `deletePastDate`**

Reemplaza ambas funciones por:

```ts
/** Renames a past outing. The spend shown next to it is derived, not editable. */
export async function renameOuting(
  budgetId: string,
  label: string,
): Promise<ActionResult> {
  const { supabase } = await requireCouple();
  const next = label.slice(0, 60).trim();
  if (!next) return ok(); // client already prevents this; nothing to do, nothing to report

  const guard = await checkEditablePastDate(supabase, budgetId);
  if (!guard.ok) return guard;

  const { error } = await supabase
    .from("budgets")
    .update({ label: next })
    .eq("id", budgetId);
  if (error) return fail("No pudimos renombrar la cita. Inténtenlo de nuevo.");
  revalidatePath("/citas");
  return ok();
}

/**
 * Deletes a past outing. Its expenses go with it: the FK
 * `expenses.budget_id -> budgets.id` is ON DELETE CASCADE, so Postgres removes the
 * child rows. Irreversible; the UI confirms with a two-tap before calling this.
 */
export async function deletePastDate(budgetId: string): Promise<ActionResult> {
  const { supabase } = await requireCouple();

  const guard = await checkEditablePastDate(supabase, budgetId);
  if (!guard.ok) return guard;

  const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (error) return fail("No pudimos borrar la cita. Inténtenlo de nuevo.");
  revalidatePath("/citas");
  return ok();
}
```

- [ ] **Step 4: Convertir `addIdea`, `setFavorite`, `startDate`, `saveGeneratedIdea`**

Reemplaza `addIdea` por:

```ts
export async function addIdea(input: {
  text: string;
  cost: CostCat;
}): Promise<ActionResult> {
  const { supabase, coupleId, userId } = await requireCouple();
  const text = input.text.trim();
  if (!text) return ok(); // client already prevents this

  const { error } = await supabase.from("date_ideas").insert({
    couple_id: coupleId,
    created_by: userId,
    text,
    cost: input.cost,
    vibe: null,
    is_favorite: false,
  });
  if (error) return fail("No pudimos guardar la idea. Inténtenlo de nuevo.");
  revalidatePath("/citas");
  return ok();
}
```

Reemplaza `setFavorite` por:

```ts
export async function setFavorite(id: string, value: boolean): Promise<ActionResult> {
  const { supabase } = await requireCouple();
  const { error } = await supabase
    .from("date_ideas")
    .update({ is_favorite: value })
    .eq("id", id);
  if (error) return fail("No pudimos actualizar la favorita. Inténtenlo de nuevo.");
  revalidatePath("/citas");
  return ok();
}
```

Reemplaza `startDate` por (mantén su JSDoc actual, que empieza con "Starts a date:"):

```ts
export async function startDate(dateIdeaId: string): Promise<ActionResult> {
  const { supabase, coupleId } = await requireCouple();

  const { data: idea, error: readErr } = await supabase
    .from("date_ideas")
    .select("text")
    .eq("id", dateIdeaId)
    .maybeSingle();
  if (readErr) return fail("No pudimos empezar la cita. Inténtenlo de nuevo.");
  if (!idea) return fail("Esa idea ya no existe.");

  const { error } = await supabase.from("budgets").insert({
    couple_id: coupleId,
    label: shortDateName(idea.text),
    limit_amount: 0,
    date_idea_id: dateIdeaId,
  });
  if (error) return fail("No pudimos empezar la cita. Inténtenlo de nuevo.");

  revalidatePath("/citas");
  revalidatePath("/gastos");
  revalidatePath("/inicio");
  return ok();
}
```

Reemplaza `saveGeneratedIdea` por (mantén su JSDoc actual):

```ts
export async function saveGeneratedIdea(input: {
  text: string;
  cost: CostCat;
  vibes: string[];
}): Promise<ActionResult> {
  const { supabase, coupleId, userId } = await requireCouple();
  const text = input.text.trim();
  if (!text) return ok(); // client already prevents this
  const { error } = await supabase.from("date_ideas").insert({
    couple_id: coupleId,
    created_by: userId,
    text,
    cost: input.cost,
    vibe: input.vibes.length ? input.vibes.join(",") : null,
    is_favorite: true,
  });
  if (error) return fail("No pudimos guardar la idea. Inténtenlo de nuevo.");
  revalidatePath("/citas");
  return ok();
}
```

- [ ] **Step 5: Los call sites de `citas-client.tsx`**

Añade el import de sileo tras la línea `import { money } from "@/lib/format";`:

```ts
import { sileo } from "sileo";
```

Ahora las seis llamadas. **(a)** `toggleFavorite` (hoy `startTransition(() => setFavorite(target.id, !target.isFavorite));`):

```tsx
  function toggleFavorite() {
    if (!displayIdea) return;
    const target = displayIdea;
    const next = !target.isFavorite;
    startTransition(async () => {
      const r = await setFavorite(target.id, next);
      if (r.ok) sileo.success({ title: next ? "Guardada" : "Quitada", duration: 2000 });
      else sileo.error({ title: r.message });
    });
  }
```

**(b)** `beginDate`:

```tsx
  function beginDate(id: string) {
    startTransition(async () => {
      const r = await startDate(id);
      if (r.ok) router.push("/gastos");
      else sileo.error({ title: r.message });
    });
  }
```

**(c)** El botón `Eliminar` de las favoritas — hoy
`onClick={() => startTransition(() => setFavorite(fav.id, false))}`. Reemplaza el `onClick` por:

```tsx
                  onClick={() =>
                    startTransition(async () => {
                      const r = await setFavorite(fav.id, false);
                      if (r.ok) sileo.success({ title: "Quitada", duration: 2000 });
                      else sileo.error({ title: r.message });
                    })
                  }
```

**(d)** La rama `try/catch` de `saveGeneratedIdea` (líneas ~166-173). Hoy es:

```tsx
    startTransition(async () => {
      try {
        await saveGeneratedIdea(idea);
        setAiIdea(null);
      } catch {
        setAiError(aiReasonMessage("fallo"));
      }
    });
```

Ya no lanza, así que el `try/catch` sobra. Reemplázalo por:

```tsx
    startTransition(async () => {
      const r = await saveGeneratedIdea(idea);
      if (r.ok) {
        setAiIdea(null);
        sileo.success({ title: "Idea guardada", duration: 2000 });
      } else {
        sileo.error({ title: r.message });
      }
    });
```

**(e)** `submitIdea` (hoy `await addIdea({ text, cost: newIdeaCost }); setNewIdeaText("");`):

```tsx
    startTransition(async () => {
      const r = await addIdea({ text, cost: newIdeaCost });
      if (r.ok) {
        setNewIdeaText("");
        sileo.success({ title: "Idea agregada", duration: 2000 });
      } else {
        sileo.error({ title: r.message });
      }
    });
```

**(f)** `commitRename` y `confirmDelete`:

```tsx
  function commitRename(d: PastDate) {
    const next = draft.trim();
    setEditingId(null);
    if (!next || next === d.name) return;
    startTransition(async () => {
      const r = await renameOuting(d.id, next);
      if (r.ok) sileo.success({ title: "Cita renombrada", duration: 2000 });
      else sileo.error({ title: r.message });
    });
  }

  function confirmDelete(id: string) {
    disarmDelete();
    startTransition(async () => {
      const r = await deletePastDate(id);
      if (r.ok) sileo.success({ title: "Cita borrada", duration: 2000 });
      else sileo.error({ title: r.message });
    });
  }
```

- [ ] **Step 6: Verificar que el build pasa**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm build`
Expected: exit 0, `tsc` limpio. Si `tsc` se queja de que `aiReasonMessage` ya no se usa, **no lo borres**:
sigue usándose en la rama de error de `generateAi`. Comprueba antes de tocar nada.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/citas.ts src/components/citas/citas-client.tsx
git commit -m "feat(citas): actions return ActionResult; toasts on success and failure"
```

---

### Task 4: `gastos.ts` y `gastos-client.tsx`

**Files:**
- Modify: `src/lib/actions/gastos.ts` (imports; las 3 acciones)
- Modify: `src/components/gastos/gastos-client.tsx` (imports; 3 call sites)

**Interfaces:**
- Consumes: `ActionResult`, `ok()`, `fail()` de `@/lib/action-result`; el `<Toaster>` de la Task 1.
- Produces:
  - `saveOuting(input: { name: string; limit: number }): Promise<ActionResult>`
  - `addExpense(input: { desc: string; monto: number; profileId: string }): Promise<ActionResult>`
  - `removeExpense(id: string): Promise<ActionResult>`

> `getActiveBudgetId` **lanza** si su query falla (es deliberado: devolver `null` haría que `addExpense`
> creara un budget "Salida" duplicado). Aquí lo envolvemos en try/catch y lo convertimos en `fail(...)`.

- [ ] **Step 1: Imports**

En `src/lib/actions/gastos.ts`, tras `import { getActiveBudgetId } from "@/lib/queries";` añade:

```ts
import { ok, fail, type ActionResult } from "@/lib/action-result";
```

- [ ] **Step 2: Convertir las tres acciones**

Reemplaza las tres funciones del archivo por:

```ts
export async function saveOuting(input: {
  name: string;
  limit: number;
}): Promise<ActionResult> {
  const { supabase, coupleId } = await requireCouple();
  const name = input.name.trim();
  if (!name || !Number.isFinite(input.limit) || input.limit <= 0) return ok();

  let activeId: string | null;
  try {
    activeId = await getActiveBudgetId(supabase, coupleId);
  } catch {
    return fail("No pudimos guardar la salida. Revisen su conexión.");
  }

  if (activeId) {
    const { error } = await supabase
      .from("budgets")
      .update({ label: name, limit_amount: input.limit })
      .eq("id", activeId);
    if (error) return fail("No pudimos guardar la salida. Inténtenlo de nuevo.");
  } else {
    const { error } = await supabase.from("budgets").insert({
      couple_id: coupleId,
      label: name,
      limit_amount: input.limit,
    });
    if (error) return fail("No pudimos guardar la salida. Inténtenlo de nuevo.");
  }
  revalidatePath("/gastos");
  revalidatePath("/inicio");
  return ok();
}

export async function addExpense(input: {
  desc: string;
  monto: number;
  profileId: string;
}): Promise<ActionResult> {
  const { supabase, coupleId } = await requireCouple();
  const desc = input.desc.trim();
  if (!desc || !Number.isFinite(input.monto) || input.monto <= 0) return ok();

  // Ensure there's an active outing to attach the expense to. A failed lookup must
  // not read as "no active outing" — that would silently create a duplicate budget.
  let budgetId: string | null;
  try {
    budgetId = await getActiveBudgetId(supabase, coupleId);
  } catch {
    return fail("No pudimos registrar el gasto. Revisen su conexión.");
  }

  if (!budgetId) {
    const { data, error } = await supabase
      .from("budgets")
      .insert({ couple_id: coupleId, label: "Salida", limit_amount: 0 })
      .select("id")
      .single();
    if (error) return fail("No pudimos registrar el gasto. Inténtenlo de nuevo.");
    budgetId = data.id;
  }

  const { error } = await supabase.from("expenses").insert({
    couple_id: coupleId,
    budget_id: budgetId,
    profile_id: input.profileId,
    description: desc,
    amount: input.monto,
  });
  if (error) return fail("No pudimos registrar el gasto. Inténtenlo de nuevo.");
  revalidatePath("/gastos");
  revalidatePath("/inicio");
  return ok();
}

export async function removeExpense(id: string): Promise<ActionResult> {
  const { supabase } = await requireCouple();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return fail("No pudimos borrar el gasto. Inténtenlo de nuevo.");
  revalidatePath("/gastos");
  revalidatePath("/inicio");
  return ok();
}
```

- [ ] **Step 3: Los call sites de `gastos-client.tsx`**

Añade tras `import { saveOuting, addExpense, removeExpense } from "@/lib/actions/gastos";`:

```ts
import { sileo } from "sileo";
```

Reemplaza `submitOuting` y `submitExpense` por:

```tsx
  function submitOuting(e: React.FormEvent) {
    e.preventDefault();
    const limit = parseFloat(outingLimit);
    if (!outingName.trim() || isNaN(limit) || limit <= 0) return;
    startTransition(async () => {
      const r = await saveOuting({ name: outingName.trim(), limit });
      if (r.ok) sileo.success({ title: "Salida guardada", duration: 2000 });
      else sileo.error({ title: r.message });
    });
  }

  function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(monto);
    if (!desc.trim() || isNaN(amount) || amount <= 0 || !quienId) return;
    startTransition(async () => {
      const r = await addExpense({ desc: desc.trim(), monto: amount, profileId: quienId });
      if (r.ok) {
        setDesc("");
        setMonto("");
        sileo.success({ title: "Gasto registrado", duration: 2000 });
      } else {
        sileo.error({ title: r.message });
      }
    });
  }
```

Y el botón `✕` de cada gasto — hoy `onClick={() => startTransition(() => removeExpense(ex.id))}`:

```tsx
              onClick={() =>
                startTransition(async () => {
                  const r = await removeExpense(ex.id);
                  if (r.ok) sileo.success({ title: "Gasto borrado", duration: 2000 });
                  else sileo.error({ title: r.message });
                })
              }
```

- [ ] **Step 4: Verificar que el build pasa**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm build`
Expected: exit 0, `tsc` limpio.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/gastos.ts src/components/gastos/gastos-client.tsx
git commit -m "feat(gastos): actions return ActionResult; toasts on success and failure"
```

---

### Task 5: `calendario`, `comunicacion` y `ajustes`

**Files:**
- Modify: `src/lib/actions/calendario.ts`, `src/lib/actions/comunicacion.ts`, `src/lib/actions/ajustes.ts`
- Modify: `src/components/calendario/calendario-client.tsx`,
  `src/components/comunicacion/comunicacion-client.tsx`, `src/components/ajustes/about-us-form.tsx`

**Interfaces:**
- Consumes: `ActionResult`, `ok()`, `fail()` de `@/lib/action-result`; el `<Toaster>` de la Task 1.
- Produces:
  - `addPendiente(input: { text: string; fecha: string }): Promise<ActionResult>`
  - `togglePendiente(id: string, done: boolean): Promise<ActionResult>`
  - `setMood(emoji: string): Promise<ActionResult>`
  - `saveAboutUs(input: { location: string; typicalBudget: string; togetherSince: string; hasKids: boolean; about: string }): Promise<ActionResult>`

> **`saveAboutUs` es distinta a las demás.** Hoy ya devuelve `{ ok: boolean }` (sin mensaje: se traga el error
> de Supabase) y `about-us-form.tsx` ya muestra un mensaje en línea bajo el botón. Pasa a `ActionResult` y su
> feedback se mueve al toast: **borra** el estado `msg` y su bloque de render. Dos canales de feedback para la
> misma acción sería peor que uno.

- [ ] **Step 1: `calendario.ts`**

Tras `import { requireCouple } from "@/lib/actions/context";` añade:

```ts
import { ok, fail, type ActionResult } from "@/lib/action-result";
```

Reemplaza ambas funciones por:

```ts
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
```

- [ ] **Step 2: `comunicacion.ts`**

Tras `import { toInputDate } from "@/lib/format";` añade:

```ts
import { ok, fail, type ActionResult } from "@/lib/action-result";
```

Reemplaza `setMood` por (mantén su JSDoc actual):

```ts
export async function setMood(emoji: string): Promise<ActionResult> {
  const { supabase, coupleId, userId } = await requireCouple();
  const today = toInputDate(new Date());

  const { data: existing, error: readErr } = await supabase
    .from("moods")
    .select("id")
    .eq("couple_id", coupleId)
    .eq("profile_id", userId)
    .eq("mood_date", today)
    .maybeSingle();
  if (readErr) return fail("No pudimos guardar tu ánimo. Revisen su conexión.");

  if (existing) {
    const { error } = await supabase
      .from("moods")
      .update({ mood_emoji: emoji })
      .eq("id", existing.id);
    if (error) return fail("No pudimos guardar tu ánimo. Inténtenlo de nuevo.");
  } else {
    const { error } = await supabase.from("moods").insert({
      couple_id: coupleId,
      profile_id: userId,
      mood_date: today,
      mood_emoji: emoji,
    });
    if (error) return fail("No pudimos guardar tu ánimo. Inténtenlo de nuevo.");
  }
  revalidatePath("/comunicacion");
  revalidatePath("/inicio");
  return ok();
}
```

- [ ] **Step 3: `ajustes.ts`**

Tras `import { requireCouple } from "@/lib/actions/context";` añade:

```ts
import { ok, fail, type ActionResult } from "@/lib/action-result";
```

Reemplaza la firma y los tres `return` de `saveAboutUs` (el resto del cuerpo no cambia):

```ts
export async function saveAboutUs(input: {
  location: string;
  typicalBudget: string;
  togetherSince: string;
  hasKids: boolean;
  about: string;
}): Promise<ActionResult> {
```

```ts
  if (cErr) return fail("No pudimos guardar. Inténtenlo de nuevo.");
```

```ts
  if (pErr) return fail("No pudimos guardar. Inténtenlo de nuevo.");
```

```ts
  revalidatePath("/comunicacion");
  return ok();
}
```

- [ ] **Step 4: `calendario-client.tsx`**

Añade tras `import { addPendiente, togglePendiente } from "@/lib/actions/calendario";`:

```ts
import { sileo } from "sileo";
```

Reemplaza `submit` por:

```tsx
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !fecha) return;
    startTransition(async () => {
      const r = await addPendiente({ text, fecha });
      if (r.ok) {
        setText("");
        setFecha("");
        sileo.success({ title: "Pendiente agregado", duration: 2000 });
      } else {
        sileo.error({ title: r.message });
      }
    });
  }
```

Y el checkbox — hoy `onClick={() => startTransition(() => togglePendiente(p.id, !p.done))}`:

```tsx
              onClick={() =>
                startTransition(async () => {
                  const r = await togglePendiente(p.id, !p.done);
                  if (!r.ok) sileo.error({ title: r.message });
                })
              }
```

> El toggle **no** lleva toast de éxito: el checkbox ya se marca. Un toast por cada tap de checkbox sería
> insoportable. Esta es la única excepción a "éxito y error", y es deliberada.

- [ ] **Step 5: `comunicacion-client.tsx`**

Añade tras `import { setMood } from "@/lib/actions/comunicacion";`:

```ts
import { sileo } from "sileo";
```

El único call site es el `onClick` de los emojis de ánimo — hoy
`onClick={() => row.isMe && startTransition(() => setMood(em))}`. Reemplázalo por:

```tsx
                      onClick={() =>
                        row.isMe &&
                        startTransition(async () => {
                          const r = await setMood(em);
                          if (!r.ok) sileo.error({ title: r.message });
                        })
                      }
```

> Tampoco lleva toast de éxito: el emoji seleccionado se resalta al instante. Misma razón que el checkbox.

- [ ] **Step 6: `about-us-form.tsx`**

Añade tras `import { saveAboutUs } from "@/lib/actions/ajustes";`:

```ts
import { sileo } from "sileo";
```

Borra la línea del estado `msg`:

```ts
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
```

Reemplaza `onSave` por:

```tsx
  function onSave() {
    startTransition(async () => {
      const r = await saveAboutUs({
        location,
        typicalBudget: budget,
        togetherSince,
        hasKids,
        about,
      });
      if (r.ok) sileo.success({ title: "Guardado ✨ La IA los conocerá mejor.", duration: 2600 });
      else sileo.error({ title: r.message });
    });
  }
```

Y borra el bloque de render del mensaje en línea, que hoy va justo después del botón `Guardar`:

```tsx
      {msg && (
        <div className="mt-3 text-[13px]" style={{ color: msg.ok ? "#3ED6B5" : "#FF6B6B" }}>
          {msg.text}
        </div>
      )}
```

Si tras borrarlo `useState` queda sin usar en el archivo, **compruébalo antes de quitar el import**: el
formulario usa `useState` para todos sus campos, así que casi seguro sigue haciendo falta.

- [ ] **Step 7: Verificar que el build pasa**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm build`
Expected: exit 0, `tsc` limpio. `tsc` es la red que atrapa cualquier call site que se nos haya olvidado
convertir: si alguno sigue tratando el retorno como `void`, aquí salta.

- [ ] **Step 8: Commit**

```bash
git add src/lib/actions/calendario.ts src/lib/actions/comunicacion.ts src/lib/actions/ajustes.ts \
        src/components/calendario/calendario-client.tsx \
        src/components/comunicacion/comunicacion-client.tsx \
        src/components/ajustes/about-us-form.tsx
git commit -m "feat: calendario, comunicacion and ajustes actions return ActionResult"
```

---

### Task 6: Verificación en vivo (la ejecuta el controlador, no un subagente)

**Files:** ninguno. Es verificación, no código.

**Interfaces:**
- Consumes: la app construida por las Tasks 1-5.
- Produces: la evidencia que autoriza el merge.

**Regla de datos:** la BD de producción tiene **una pareja real con datos**. No sembrar ahí. Crear un usuario
y una pareja desechables por SQL (Supabase MCP), y borrarlos al terminar comprobando los recuentos antes y
después. Playwright: `chromium.launch({ channel: "chrome" })` (los navegadores descargados están desfasados).

- [ ] **Step 1: Levantar la app**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm dev`
Expected: `http://localhost:3000` responde. La primera petición a cada ruta compila en frío y puede tardar
varios segundos: si un selector agota su timeout en la primera pasada, reintenta con el servidor caliente
antes de sospechar del código.

- [ ] **Step 2: El `<Toaster>` no tapa el header**

Entrar a `/citas` y renombrar una cita pasada. Comprobar visualmente que el toast de éxito ("Cita renombrada")
aparece **debajo** del `AppHeader`, no encima. Si lo tapa, ajustar el `offset={{ top: 72 }}` del layout al
valor real medido, no a ojo.

- [ ] **Step 3: (A) — un fallo alcanzable de verdad, sin trucar el código**

Con la cita pasada visible en el navegador, **borrar esa fila por SQL** (Supabase MCP). Sin recargar la
página, pulsar `Eliminar` → `¿Seguro?`. El guard `checkEditablePastDate` no la encontrará y devolverá
`fail("Esa cita ya no está en el historial.")`.
Expected: aparece un toast de **error** con ese texto exacto. Nada de pantalla en blanco, nada de silencio.

Repetir la misma maniobra con `Editar` → escribir → `Enter`. Mismo toast de error.

- [ ] **Step 4: (A) — los toasts de éxito**

Con datos consistentes: renombrar (toast "Cita renombrada"), borrar (toast "Cita borrada"), agregar una idea
(toast "Idea agregada"), registrar un gasto en `/gastos` (toast "Gasto registrado").
Comprobar que marcar un pendiente en `/calendario` y elegir un ánimo en `/comunicacion` **no** lanzan toast de
éxito (excepciones deliberadas).

- [ ] **Step 5: (B) — el error boundary**

Añadir **temporalmente y sin commitear** un `throw new Error("boom")` al principio de
`src/app/(app)/citas/page.tsx`. Recargar `/citas`.
Expected: se ve `(app)/error.tsx` — el 🌧️, "Algo se nos cayó", y el botón `Reintentar` — **conservando el
AppHeader y la BottomNav**. No la pantalla de error cruda de Next.

Quitar el `throw`, pulsar `Reintentar`.
Expected: la pantalla se recupera y `/citas` renderiza normal.

Confirmar con `git status` que `citas/page.tsx` **no** quedó modificado.

- [ ] **Step 6: Medir el coste de `motion` en el bundle**

Comparar el tamaño de `/citas` en la tabla de rutas del build contra el valor previo a esta rama (`4.98 kB`),
y también el `First Load JS shared by all` (antes: `102 kB`). Reportar el número real. Si el aumento parece
desproporcionado, decirlo — cambiar a `sonner` es una edición de una línea por call site.

- [ ] **Step 7: Limpiar y anotar**

Borrar el usuario y la pareja de prueba. Comprobar que los recuentos de la BD vuelven exactamente a los de
antes. Escribir el resultado real —incluidos los fallos, si los hubo— en `.superpowers/sdd/progress.md`.

---

## Notas para el revisor

- **El guard `checkEditablePastDate` debe fallar cerrado.** Si `getActiveBudgetId` lanza y el `catch` devolviera
  `ok()` en vez de `fail(...)`, `deletePastDate` podría borrar la salida activa y llevarse sus gastos por la
  cascada de la FK. Es la línea más peligrosa del diff: verifícala.
- Los `return ok()` ante entrada vacía (`addIdea`, `renameOuting`, `saveGeneratedIdea`, `saveOuting`,
  `addExpense`, `addPendiente`) **no son errores tragados**: el cliente ya impide esos casos, no hay nada que
  hacer y no hay nada que reportar. Son distintos de los `fail(...)`.
- `togglePendiente` y `setMood` no llevan toast de éxito. Es deliberado y está justificado en el plan (el
  checkbox y el emoji ya dan feedback inmediato); no es un olvido.
- `about-us-form.tsx` pierde su mensaje en línea a cambio del toast. Es un cambio de UI intencional: un solo
  canal de feedback.
- No se toca `ai.ts` ni `onboarding.ts`. Sus canales de error propios están fuera de alcance por decisión del
  spec, no por descuido.
