# Diseño — Feedback de errores: toasts y error boundaries

**Fecha:** 2026-07-08 · **Rama:** `feat/error-feedback` · **Base:** `main` @ `472b204`

## Problema

Cuando algo falla, la app no dice nada.

Las 13 mutaciones lanzan (`throw error`) o se tragan el error. Un `throw` en una Server Action se **redacta
en producción** ("An error occurred in the Server Components render"), así que el cliente ni siquiera puede
saber qué pasó. Y el repo no tiene `error.tsx` ni `global-error.tsx`: si un Server Component revienta al
renderizar, el usuario ve la pantalla de error cruda de Next.

Esto último empeoró a propósito en `472b204`: `getActiveBudget` ahora **lanza** ante un fallo de query, en
vez de devolver `null` en silencio. Fue la decisión correcta — devolver `null` habría dejado borrar la salida
activa con su cascada de gastos — pero convierte un blip transitorio de Supabase en `/citas`, `/gastos` e
`/inicio` caídas. Esa decisión pide una red de seguridad, y esta entrega es la red.

## Estado actual: cuatro convenciones de fallo

| Convención | Dónde | Problema |
|---|---|---|
| `throw error` | 12 mutaciones | Mensaje redactado en prod; el cliente no puede reaccionar |
| `{ ok: boolean }` sin mensaje | `saveAboutUs` | Traga el error de Supabase en silencio |
| `{ ok, reason }` + `aiReasonMessage()` | `ai.ts` | **Correcta.** Copy cálido en español |
| `{ status: 'error', error }` | `onboarding.ts` | **Correcta.** Copy cálido en español |

No inventamos un patrón: extendemos el de `ai.ts` / `onboarding.ts` a las 13 mutaciones restantes.

## Dos superficies de fallo

- **(A) Una Server Action invocada desde el cliente falla.** El usuario tocó algo. Un toast encaja.
- **(B) Un Server Component revienta al renderizar.** Nadie tocó nada; la página entera cae. No hay cliente
  montado que muestre un toast: sólo lo atrapa un `error.tsx`.

Un toast **no puede** cubrir (B). Esta entrega hace las dos.

## Decisiones

1. **Las mutaciones devuelven un resultado**, no lanzan. Permite copy en español y distinguir "falló la red"
   de "esa cita ya no existe".
2. **Toasts de éxito *y* de error.** Decisión del usuario, tomada contra la recomendación de este documento
   (el ethos del diseño es "sin diálogos", y el éxito ya es visible: la fila se renombra, la cita desaparece).
   Se compensa con títulos cortos y duración breve en los de éxito.
3. **Librería: `sileo`**, elección del usuario. Verificada antes de adoptar: existe, MIT, 92 k descargas/mes,
   exporta `"use client"` (funciona en el App Router), ESM+CJS, tipos. Se fija a la **versión exacta `0.1.5`,
   sin `^`**: en `0.1.x` un patch puede romper la API. Arrastra `motion` como dependencia de runtime.
   Alternativa descartada por preferencia del usuario, no por técnica: `sonner` (190 M descargas/mes, cero
   dependencias).
4. **Boundary doble:** `(app)/error.tsx` (conserva header y tab bar, el usuario sigue dentro de la app) y
   `global-error.tsx` (red última si revienta el layout raíz).

## Alcance

**Dentro:** las 13 mutaciones que hoy lanzan o tragan el error, sus 5 call sites, el `<Toaster>`, y los dos
error boundaries.

Las 13: `addIdea`, `setFavorite`, `startDate`, `saveGeneratedIdea`, `renameOuting`, `deletePastDate`
(`citas.ts`) · `saveOuting`, `addExpense`, `removeExpense` (`gastos.ts`) · `setMood` (`comunicacion.ts`) ·
`addPendiente`, `togglePendiente` (`calendario.ts`) · `saveAboutUs` (`ajustes.ts`).

Los 5 call sites: `citas/citas-client.tsx`, `gastos/gastos-client.tsx`, `calendario/calendario-client.tsx`,
`comunicacion/comunicacion-client.tsx`, `ajustes/about-us-form.tsx`.

**Fuera:** `ai.ts` y `onboarding.ts` — ya tienen canal de error con copy en español (`aiReasonMessage`,
`friendlyAuthError`). Tocarlas sería refactor no pedido. Tampoco se toca `/login`, que muestra sus errores
en línea. Sin cambios de esquema, sin migraciones.

## Arquitectura

### 1. El contrato — `src/lib/action-result.ts` (nuevo)

Módulo plano. **No** lleva `"use server"`: en un archivo `"use server"` cada export es una Server Action
invocable desde el cliente, y `ok`/`fail` son helpers, no endpoints.

```ts
export type ActionResult = { ok: true } | { ok: false; message: string };

export const ok = (): ActionResult => ({ ok: true });
export const fail = (message: string): ActionResult => ({ ok: false, message });
```

Sin genéricos: ninguna de las 13 devuelve datos. `startDate` sólo necesita `ok` para decidir si redirige a
`/gastos`. YAGNI.

### 2. Las mutaciones

Cada una cambia su firma a `Promise<ActionResult>`, reemplaza `if (error) throw error` por
`if (error) return fail("<copy específico>")`, y termina en `return ok()` tras el `revalidatePath`.

El copy es **específico por acción**, no un genérico compartido: *"No pudimos borrar la cita. Inténtenlo de
nuevo."*, *"No pudimos guardar el gasto."* El texto exacto de cada una se fija en el plan.

Casos que no son errores y devuelven `ok()`:
- Entrada vacía ya filtrada en el cliente (`addIdea` con texto vacío, `renameOuting` con label vacío): no hay
  nada que hacer, no hay nada que reportar.

Casos que hoy son **no-ops mudos** y pasan a devolver `fail(...)`:
- El guard de `renameOuting` / `deletePastDate` rechaza (la cita ya no existe, no es una cita, o es la salida
  activa) → `fail("Esa cita ya no está en el historial.")`. Hoy son indistinguibles del éxito.
- `startDate` con una idea inexistente → `fail("Esa idea ya no existe.")`.

`requireCouple()` sigue haciendo `redirect("/login")`; eso no es un error a reportar.

### 3. Los toasts — (A)

En `src/app/(app)/layout.tsx`:

```tsx
import "sileo/styles.css";
import { Toaster } from "sileo";
// …
<Toaster theme="dark" position="top-center" offset={{ top: 72 }} />
```

El layout es un Server Component, pero `Toaster` trae su propio `"use client"`, así que puede renderizarse
directamente. El `offset` libra el `AppHeader`; el valor exacto se ajusta contra el navegador, no a ojo.

En cada call site:

```ts
startTransition(async () => {
  const r = await deletePastDate(d.id);
  if (r.ok) sileo.success({ title: "Cita borrada" });
  else sileo.error({ title: r.message });
});
```

El error usa `title: r.message` — sin `description`, que sólo repetiría. Los de éxito llevan título corto
("Cita borrada", "Gasto registrado") y `duration` breve.

### 4. Los boundaries — (B)

**`src/app/(app)/error.tsx`** — Client Component (obligatorio para `error.tsx`). Recibe
`{ error: Error & { digest?: string }, reset: () => void }`. Loguea `error` en un `useEffect` y muestra copy
cálido más un botón **Reintentar** que llama a `reset()`. Vive dentro del grupo `(app)`, así que conserva
`AppHeader` y `BottomNav`: el usuario no sale de la app.

**`src/app/global-error.tsx`** — red última. Reemplaza el layout raíz, así que debe renderizar sus propios
`<html>` y `<body>`. Copy mínimo y un botón de recarga.

## Verificación

El repo no tiene test runner (ni jest ni vitest). Ver el spec de la entrega anterior. La verificación es:

1. `NODE_OPTIONS=--use-system-ca corepack pnpm build` verde (incluye `tsc`).
2. **(A) con un fallo alcanzable de verdad, sin trucar el código:** borrar una cita pasada por SQL y luego
   pulsar `Eliminar` en la pestaña que aún la muestra. El guard devuelve `fail` → aparece el toast real.
   Lo mismo para `renameOuting`. También se comprueba un toast de éxito (renombrar, borrar).
3. **(B):** un `throw` temporal y **no commiteado** en `citas/page.tsx` para ver `(app)/error.tsx`, y
   comprobar que `Reintentar` recupera la pantalla al quitarlo.
4. Todo contra una pareja desechable creada por SQL y borrada al terminar: la BD de producción tiene una
   pareja real con datos. Recuentos antes y después.
5. Se mide el tamaño de `/citas` antes y después y se reporta el coste real de `motion` en el bundle.

## Riesgos

- **`sileo@0.1.5` es pre-1.0 y lo mantiene una persona.** Fijar la versión exacta acota el riesgo a "no
  recibimos arreglos", no a "una actualización nos rompe".
- **`motion` entra al bundle cliente.** La app hoy no tiene librería de animación. El coste se mide y se
  reporta; si resulta desproporcionado, cambiar a `sonner` es una edición de una línea por call site.
- **La entrega es ancha:** 13 acciones × 5 componentes + 3 archivos nuevos. Es mecánica, pero si a mitad
  resulta más enredada de lo previsto, se parte (citas primero, el resto después) volviendo a
  brainstorming → writing-plans, no improvisando.
- Cambiar 13 firmas de `Promise<void>` a `Promise<ActionResult>` rompe cualquier call site que se olvide;
  `tsc` los atrapa todos, así que el build es una red suficiente.
