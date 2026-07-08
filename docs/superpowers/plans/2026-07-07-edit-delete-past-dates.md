# Editar y borrar "Citas pasadas" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir renombrar y borrar citas del historial "CITAS PASADAS" en `/citas`.

**Architecture:** Dos Server Actions nuevas en `src/lib/actions/citas.ts` (`renameOuting`, `deletePastDate`)
protegidas por un guard privado que rechaza la salida activa y los budgets que no son citas. La UI de
`src/components/citas/citas-client.tsx` gana edición inline (input en la fila) y borrado con confirmación
de doble tap. Sin migración: la FK `expenses.budget_id → budgets.id` es `ON DELETE CASCADE` y la RLS de
`budgets`/`expenses` ya permite UPDATE/DELETE a ambos miembros de la pareja.

**Tech Stack:** Next.js 15 App Router (Server Actions, `revalidatePath`), React 19 (`useTransition`,
`useState`, `useRef`, `useEffect`), TypeScript, Supabase SSR client, Tailwind + tokens del design system.

**Spec:** `docs/superpowers/specs/2026-07-07-edit-delete-past-dates-design.md`

## Global Constraints

- **No hay test runner en este repo.** `package.json` no tiene jest/vitest; `playwright` está instalado pero
  no hay suite. **No se puede hacer TDD.** La verificación de cada tarea es: build verde (incluye `tsc`) y,
  al final, prueba en vivo en el navegador. No inventes un test runner ni añadas dependencias.
- **Comando de build (obligatorio, exacto):** `NODE_OPTIONS=--use-system-ca corepack pnpm build`
  (proxy TLS corporativo; `pnpm` no está en el PATH → hay que pasar por `corepack`).
- **Sin cambios de esquema.** Cero migraciones, cero SQL. Si crees que necesitas una, estás BLOCKED: pregunta.
- **Regla del repo:** en un archivo `"use server"`, **todo export es una Server Action invocable desde el
  cliente**. Los helpers compartidos NO se exportan.
- **Idioma:** todo el texto de UI en español (es-HN). Comentarios de código en inglés, como el resto del repo.
- **Sin render optimista.** El patrón del archivo es `startTransition(() => serverAction(...))` y dejar que
  `revalidatePath` refresque el Server Component. No introduzcas `useOptimistic`.
- **Longitud máxima del label: 60 caracteres**, tanto en el `maxLength` del input como en el `slice(0, 60)`
  del servidor.

---

### Task 1: Server Actions `renameOuting` y `deletePastDate`

**Files:**
- Modify: `src/lib/actions/citas.ts` (añadir imports al principio; añadir el guard y las dos acciones al final)

**Interfaces:**
- Consumes: `requireCouple()` de `@/lib/actions/context` (ya importado en el archivo);
  `getActiveBudgetId(supabase: SupabaseServerClient, coupleId?: string): Promise<string | null>` de
  `@/lib/queries`; `SupabaseServerClient` de `@/lib/supabase/types`.
- Produces (la Task 2 los importa desde `@/lib/actions/citas`):
  - `renameOuting(budgetId: string, label: string): Promise<void>`
  - `deletePastDate(budgetId: string): Promise<void>`

- [ ] **Step 1: Añadir los imports que faltan**

En `src/lib/actions/citas.ts`, el bloque de imports actual es:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireCouple } from "@/lib/actions/context";
import { shortDateName } from "@/lib/format";
import type { CostCat } from "@/lib/constants";
```

Déjalo exactamente así, pero añade dos líneas al final del bloque:

```ts
import { getActiveBudgetId } from "@/lib/queries";
import type { SupabaseServerClient } from "@/lib/supabase/types";
```

- [ ] **Step 2: Añadir el guard privado al final del archivo**

Pégalo al final de `src/lib/actions/citas.ts`, después de `saveGeneratedIdea`. **No lo exportes** (ver
Global Constraints: en un archivo `"use server"` cada export es un endpoint público).

```ts
/**
 * Guards the two history mutations below. Returns true only when the budget is a
 * past date the couple may edit: it exists and is visible under RLS, it is a cita
 * (`date_idea_id` set), and it is not the active outing. The UI never offers the
 * active outing, but Server Actions are client-invocable endpoints, so the server
 * checks too. Callers no-op on false — these states are unreachable from the UI
 * and a thrown error would tell the user nothing useful.
 */
async function isEditablePastDate(
  supabase: SupabaseServerClient,
  budgetId: string,
): Promise<boolean> {
  const { data: budget } = await supabase
    .from("budgets")
    .select("id, date_idea_id")
    .eq("id", budgetId)
    .maybeSingle();
  if (!budget?.date_idea_id) return false;
  return budget.id !== (await getActiveBudgetId(supabase));
}
```

- [ ] **Step 3: Añadir `renameOuting`**

Justo después del guard:

```ts
/** Renames a past outing. The spend shown next to it is derived, not editable. */
export async function renameOuting(budgetId: string, label: string): Promise<void> {
  const { supabase } = await requireCouple();
  const next = label.trim().slice(0, 60);
  if (!next) return;
  if (!(await isEditablePastDate(supabase, budgetId))) return;

  const { error } = await supabase
    .from("budgets")
    .update({ label: next })
    .eq("id", budgetId);
  if (error) throw error;
  revalidatePath("/citas");
}
```

- [ ] **Step 4: Añadir `deletePastDate`**

Justo después de `renameOuting`:

```ts
/**
 * Deletes a past outing. Its expenses go with it: the FK
 * `expenses.budget_id -> budgets.id` is ON DELETE CASCADE, so Postgres removes the
 * child rows. Irreversible; the UI confirms with a two-tap before calling this.
 */
export async function deletePastDate(budgetId: string): Promise<void> {
  const { supabase } = await requireCouple();
  if (!(await isEditablePastDate(supabase, budgetId))) return;

  const { error } = await supabase.from("budgets").delete().eq("id", budgetId);
  if (error) throw error;
  revalidatePath("/citas");
}
```

> **Por qué solo `revalidatePath("/citas")`:** `/gastos` e `/inicio` solo leen el budget *activo*, que el
> guard garantiza intacto. Revalidarlos sería trabajo muerto. No los añadas.

- [ ] **Step 5: Verificar que el build pasa**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm build`
Expected: exit 0, sin errores de TypeScript. (Las dos funciones aún no tienen consumidores; eso está bien,
son exports de un módulo, no variables locales — `tsc` no se queja.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/citas.ts
git commit -m "feat(citas): server actions to rename and delete past dates"
```

---

### Task 2: UI — editar inline y borrar con doble tap

**Files:**
- Modify: `src/components/citas/citas-client.tsx` (imports; estado y handlers dentro de `CitasClient`;
  la sección `{/* Past dates */}` cerca del final del JSX)

**Interfaces:**
- Consumes: `renameOuting(budgetId, label)` y `deletePastDate(budgetId)` de la Task 1;
  el tipo `PastDate = { id: string; name: string; whenLabel: string; spent: number }` ya definido y
  exportado en este mismo archivo; `pending` / `startTransition` del `useTransition()` ya presente en
  `CitasClient`; `money()` de `@/lib/format`, ya importado.
- Produces: nada que otras tareas consuman.

- [ ] **Step 1: Ampliar los imports de React y de las acciones**

Línea 3 actual:

```ts
import { useMemo, useState, useTransition } from "react";
```

Reemplázala por:

```ts
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
```

Línea 12 actual:

```ts
import { addIdea, setFavorite, startDate, saveGeneratedIdea } from "@/lib/actions/citas";
```

Reemplázala por:

```ts
import {
  addIdea,
  setFavorite,
  startDate,
  saveGeneratedIdea,
  renameOuting,
  deletePastDate,
} from "@/lib/actions/citas";
```

- [ ] **Step 2: Añadir el estado y los handlers del historial**

Dentro de `CitasClient`, inmediatamente después de la función `beginDate` (que termina con `}` justo antes
de `const [aiIdea, setAiIdea] = ...`), inserta:

```tsx
  // --- Past-dates history: inline rename + two-tap delete ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Disarming is time-based, so the timer must not outlive the component or the row.
  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  function disarmDelete() {
    if (confirmTimer.current) {
      clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
    setConfirmingId(null);
  }

  function beginEdit(d: PastDate) {
    disarmDelete();
    setDraft(d.name);
    setEditingId(d.id);
  }

  function commitRename(d: PastDate) {
    const next = draft.trim();
    setEditingId(null);
    if (!next || next === d.name) return;
    startTransition(() => renameOuting(d.id, next));
  }

  function armDelete(id: string) {
    setEditingId(null);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingId(id);
    confirmTimer.current = setTimeout(() => {
      confirmTimer.current = null;
      setConfirmingId(null);
    }, 4000);
  }

  function confirmDelete(id: string) {
    disarmDelete();
    startTransition(() => deletePastDate(id));
  }
```

Nota: `editingId` y `confirmingId` son mutuamente excluyentes — `beginEdit` desarma el borrado y `armDelete`
cierra la edición. Solo una fila puede estar en cada modo.

- [ ] **Step 3: Reescribir la fila de "Citas pasadas"**

Localiza el bloque `{/* Past dates */}` (cerca del final del JSX). Su contenido actual es:

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

Reemplázalo íntegro por:

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
                {editingId === d.id ? (
                  <>
                    <input
                      autoFocus
                      value={draft}
                      maxLength={60}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename(d);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingId(null);
                        }
                      }}
                      aria-label="Nuevo nombre de la cita"
                      className="field !rounded-xl !py-2 flex-1 text-[14px]"
                    />
                    <button
                      onClick={() => commitRename(d)}
                      disabled={pending}
                      className="p-1 text-[13px] text-rosa transition hover:brightness-110"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={pending}
                      className="p-1 text-[13px] text-ink-secondary transition hover:text-ink"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-[14px] text-ink">{d.name}</span>
                    <span className="text-[12px] text-ink-tertiary">{d.whenLabel}</span>
                    <span className="tnum text-[13px] text-ink-secondary">
                      L {money(d.spent)}
                    </span>
                    <button
                      onClick={() => beginEdit(d)}
                      disabled={pending}
                      className="p-1 text-[13px] text-ink-secondary transition hover:text-ink"
                    >
                      Editar
                    </button>
                    {confirmingId === d.id ? (
                      <button
                        onClick={() => confirmDelete(d.id)}
                        disabled={pending}
                        className="p-1 text-[13px] text-alert transition hover:brightness-110"
                      >
                        ¿Seguro?
                      </button>
                    ) : (
                      <button
                        onClick={() => armDelete(d.id)}
                        disabled={pending}
                        className="p-1 text-[13px] text-ink-secondary transition hover:text-alert"
                      >
                        Eliminar
                      </button>
                    )}
                  </>
                )}
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

Las clases usadas ya existen en el proyecto: `field`, `tnum`, `text-rosa`, `text-alert`, `text-ink`,
`text-ink-secondary`, `text-ink-tertiary`, `glass-subtle`. No añadas CSS nuevo.

- [ ] **Step 4: Verificar que el build pasa**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm build`
Expected: exit 0, `tsc` limpio, `/citas` en la lista de rutas. (Es normal que el tamaño de `/citas` suba
unos cientos de bytes.)

- [ ] **Step 5: Commit**

```bash
git add src/components/citas/citas-client.tsx
git commit -m "feat(citas): inline rename and two-tap delete for past dates"
```

---

### Task 3: Verificación en vivo (la ejecuta el controlador, no un subagente)

**Files:** ninguno. Es una tarea de verificación, no de código.

**Interfaces:**
- Consumes: la app construida por las Tasks 1 y 2.
- Produces: la evidencia que autoriza el merge.

- [ ] **Step 1: Levantar la app**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm dev`
Expected: `http://localhost:3000` responde.

- [ ] **Step 2: Sembrar una cita pasada con el propio flujo (sin SQL)**

Entrar con la cuenta de prueba `osoriohector89@gmail.com`. En `/citas`, pulsar `Empezar` en una idea
favorita; la app redirige a `/gastos` (ahora esa es la salida activa). Volver a `/citas` y pulsar `Empezar`
en **otra** idea. La primera cae al historial: aparece bajo "CITAS PASADAS".
No sembrar datos por SQL en cuentas reales.

- [ ] **Step 3: Renombrar**

En la fila del historial: `Editar` → cambiar el texto → `Enter`. Verificar:
- El nombre cambia en la lista.
- Recargar la página (`F5`): el nombre nuevo persiste.
- `Editar` → `Esc` no guarda nada.
- `Editar` → borrar todo el texto → `Guardar`: no guarda un label vacío (la fila conserva su nombre).

- [ ] **Step 4: Verificar el guard del doble tap**

En la fila del historial: un tap en `Eliminar` → el botón dice `¿Seguro?` en rojo. Esperar ~5 segundos sin
tocar nada → vuelve a decir `Eliminar` (el timeout lo desarmó). La fila sigue ahí.

- [ ] **Step 5: Borrar**

`Eliminar` → `¿Seguro?` → la fila desaparece. Recargar: sigue sin aparecer.

- [ ] **Step 6: Verificar que la salida activa no se tocó**

Ir a `/gastos`. La salida activa sigue siendo la segunda cita, con su límite y sus gastos intactos.

- [ ] **Step 7: Anotar la evidencia en el ledger**

Escribir el resultado real (incluidos los fallos, si los hubo) en `.superpowers/sdd/ledger.md`.

---

## Notas para el revisor

- **El borrado es irreversible** y se lleva los `expenses` de esa cita por la FK `ON DELETE CASCADE`. Es la
  decisión consciente del spec (§Decisiones, punto 2), no un descuido. El único mitigante es el doble tap.
- El guard `isEditablePastDate` hace **dos** round-trips (el budget + `getActiveBudgetId`) por mutación. Es
  aceptable: son mutaciones raras y de una fila. No lo optimices a una sola query.
- `getActiveBudgetId` define "activa" como el budget **más reciente** (`created_at desc limit 1`). Es la
  definición compartida del código (`lib/queries.ts`), la misma que usan `citas/page.tsx` y `gastos`. No la
  cambies aquí.
