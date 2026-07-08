# Que la sesión falle ruidosamente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un fallo transitorio de red muestre "Algo se nos cayó" en vez de fingir que la sesión expiró y mandar al usuario a `/login`.

**Architecture:** Un discriminador compartido (`sessionIsMissing`) separa "no hay sesión" (4xx → `/login`) de
"no pudimos preguntar" (red o 5xx → error). El middleware lo usa para **fallar abierto** en vez de redirigir;
`getSessionContext()` lo usa para **lanzar** en vez de devolver `null`. Un `src/app/error.tsx` nuevo atrapa ese
throw, porque `(app)/error.tsx` no cubre el layout de su propio segmento.

**Tech Stack:** Next.js 15 App Router (middleware en Edge runtime, `error.tsx`), React 19, TypeScript,
`@supabase/ssr` + `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-07-08-session-fail-loudly-design.md`

## Global Constraints

- **No hay test runner en este repo.** No hay jest ni vitest; `playwright` está instalado pero no hay suite.
  **No se puede hacer TDD.** La verificación por tarea es build verde (incluye `tsc`); la prueba en navegador
  va al final. **No añadas un test runner. No escribas archivos de test.**
- **Comando de build (exacto):** `NODE_OPTIONS=--use-system-ca corepack pnpm build`
  (proxy TLS corporativo; `pnpm` no está en el PATH → hay que pasar por `corepack`).
- **Sin cambios de esquema, sin migraciones, sin dependencias nuevas.** Si crees que necesitas una, estás
  BLOCKED: pregunta.
- **El middleware nunca lanza.** Un throw en middleware produce un 500 crudo de Next, no un `error.tsx`.
- **La regla del discriminador, textual:** *4xx significa "tu sesión no vale"; red y 5xx significan "no pudimos
  preguntar".* `AuthRetryableFetchError` (fallo de red) trae `status: 0`.
- **Fallar abierto en el middleware es deliberado.** El middleware nunca fue la barrera de seguridad: la RLS lo
  es, y el layout revalida la sesión. No lo "arregles" volviendo a redirigir.
- **Copy de UI en español (es-HN)**, cálido y en plural ("Vuelvan a intentarlo"). Comentarios de código en inglés.
- El orden de las tareas importa: el boundary (Task 2) entra **antes** de que `getSessionContext` empiece a
  lanzar (Task 3). Ningún estado intermedio de la rama es peor que el actual.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/supabase/auth-error.ts` (nuevo) | El discriminador `sessionIsMissing`. Módulo plano, sin `"use server"`. |
| `src/lib/supabase/middleware.ts` | Falla abierto cuando no puede saber si hay usuario. |
| `src/app/error.tsx` (nuevo) | Boundary del segmento raíz. Atrapa el throw de `(app)/layout.tsx`, `/login`, `/bienvenida`, `/`. |
| `src/lib/queries.ts` | `getSessionContext()` lanza cuando no pudo preguntar. |

---

### Task 1: El discriminador y el middleware

**Files:**
- Create: `src/lib/supabase/auth-error.ts`
- Modify: `src/lib/supabase/middleware.ts`

**Interfaces:**
- Consumes: `isAuthApiError`, `isAuthSessionMissingError` de `@supabase/supabase-js` (ya instalado; ambos están
  reexportados — verificado).
- Produces (lo importa la Task 3):
  - `sessionIsMissing(error: unknown): boolean` desde `@/lib/supabase/auth-error`

**Comportamiento medido contra la API real** (no supuesto — se ejecutó `auth.getUser()` en los tres escenarios):

| Escenario | `error.name` | `status` | `isAuthSessionMissingError` | `isAuthApiError` | `sessionIsMissing` |
|---|---|---|---|---|---|
| Sin sesión | `AuthSessionMissingError` | 400 | `true` | **`false`** | `true` → `/login` |
| JWT inválido | `AuthApiError` | 403 | `false` | `true` | `true` → `/login` |
| Red caída | `AuthRetryableFetchError` | 0 | `false` | `false` | `false` → lanza |

Fíjate en la celda en negrita: **`AuthSessionMissingError` NO es un `AuthApiError`.** Por eso la primera
comprobación explícita no es redundante. Si la quitas "porque el 400 ya cae en el rango 4xx", el caso más común
—usuario deslogueado— se cae al `return false` y verá una pantalla de error en vez del login.

- [ ] **Step 1: Crear el discriminador**

Crea `src/lib/supabase/auth-error.ts` con exactamente esto:

```ts
import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";

/**
 * True when the error means "there is no valid session" — the user must log in.
 * False when it means "we could not ask": network down, DNS failure, Supabase 5xx.
 *
 * Callers must never treat the second case as a logged-out user. That is exactly
 * how a transient blip turns into an apparent forced logout.
 *
 * A 4xx from the auth API means the token is missing, malformed, expired or
 * rejected. Anything else — including AuthRetryableFetchError, which carries
 * status 0 — means the question never got answered.
 */
export function sessionIsMissing(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  if (isAuthApiError(error) && typeof error.status === "number") {
    return error.status >= 400 && error.status < 500;
  }
  return false;
}
```

- [ ] **Step 2: Hacer que el middleware falle abierto**

`src/lib/supabase/middleware.ts` termina hoy así:

```ts
  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

Reemplaza ese bloque por:

```ts
  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // A transient failure must not look like a logged-out user. When we could not
  // ask, fail open: let the request through. RLS is the real barrier, and the
  // (app) layout re-checks the session and surfaces a proper error screen.
  // Never throw here — a throw in middleware yields Next's raw 500, not error.tsx.
  if (error && !sessionIsMissing(error)) {
    console.error("middleware auth.getUser:", error);
    return supabaseResponse;
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

Y añade el import al bloque de imports del principio, justo después de la línea de `database.types`:

```ts
import { sessionIsMissing } from "@/lib/supabase/auth-error";
```

- [ ] **Step 3: Verificar que el build pasa**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm build`
Expected: exit 0, `tsc` limpio. En la tabla de rutas aparece una línea `ƒ Middleware` con su tamaño; **anótalo**
(antes de esta rama era `90.8 kB`). Importar dos type-guards no debería moverlo apenas; si se dispara, dilo.

El build emite `⚠ Compiled with warnings` por `process.version` de `@supabase/supabase-js` en el Edge runtime.
Es **preexistente y benigno** (documentado en `HANDOFF.md §6.8`). No intentes arreglarlo.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/auth-error.ts src/lib/supabase/middleware.ts
git commit -m "fix(auth): middleware fails open when it cannot determine the session"
```

---

### Task 2: El boundary del segmento raíz

**Files:**
- Create: `src/app/error.tsx`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: nada que otras tareas consuman en código. Pero la Task 3 **depende** de que este archivo exista: sin
  él, el throw nuevo de `getSessionContext` caería al `global-error.tsx` austero.

**Contexto:** en Next, un `error.tsx` establece el boundary de los *hijos* de su segmento, **no** del layout de
su propio segmento. Por eso `(app)/error.tsx` (que ya existe) no puede atrapar un throw de `(app)/layout.tsx`.
Este archivo vive un nivel más arriba y sí lo atrapa. De paso cubre `/login`, `/bienvenida` y `/`.

El layout raíz sobrevive (`src/app/layout.tsx` solo monta fuentes y `<body className="min-h-dvh bg-bg text-ink">`),
así que aquí sí se pueden usar las clases del design system — a diferencia de `global-error.tsx`, que lo reemplaza.

- [ ] **Step 1: Crear el boundary**

Crea `src/app/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";

/**
 * Catches render failures of the root segment's children — including a throw in
 * (app)/layout.tsx, which (app)/error.tsx cannot catch: in Next, an error.tsx
 * does not cover the layout of its own segment. Also covers /login, /bienvenida
 * and /. The root layout survives, so the design system's classes are available.
 */
export default function RootError({
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
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-[34px]" aria-hidden="true">
        🌧️
      </div>
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

El copy es **idéntico** al de `(app)/error.tsx` a propósito: el usuario no debe percibir dos errores distintos.
La única diferencia es el contenedor — aquí no hay `AppHeader` ni `BottomNav` que preservar, así que el bloque
se centra en la ventana con `min-h-dvh`.

No muestres `error.message` ni `error.digest` al usuario. El único sitio al que va el error es `console.error`.

- [ ] **Step 2: Verificar que el build pasa**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm build`
Expected: exit 0, `tsc` limpio.

- [ ] **Step 3: Commit**

```bash
git add src/app/error.tsx
git commit -m "feat: root-segment error boundary"
```

---

### Task 3: `getSessionContext()` deja de tragarse sus errores

**Files:**
- Modify: `src/lib/queries.ts` (el import y la función `getSessionContext`)

**Interfaces:**
- Consumes: `sessionIsMissing(error: unknown): boolean` de `@/lib/supabase/auth-error` (Task 1); el boundary
  `src/app/error.tsx` de la Task 2, que es lo que hace visible este cambio.
- Produces: `getSessionContext()` mantiene su firma `Promise<SessionContext | null>`, pero ahora **lanza**
  cuando no pudo determinar la sesión. Sus 8 llamadores (el layout de `(app)`, las 6 páginas y `/login`) no
  cambian: siguen tratando `null` como "no hay sesión".

- [ ] **Step 1: Añadir el import**

En `src/lib/queries.ts`, el bloque de imports actual es:

```ts
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Budget, Couple, Profile } from "@/lib/database.types";
import type { SupabaseServerClient as DB } from "@/lib/supabase/types";
```

Añade una línea al final del bloque:

```ts
import { sessionIsMissing } from "@/lib/supabase/auth-error";
```

- [ ] **Step 2: Reescribir el cuerpo de `getSessionContext`**

El cuerpo actual descarta cuatro `error` distintos: el de `auth.getUser()`, el de `profiles`, y los dos del
`Promise.all`. Reemplaza la función entera (deja su JSDoc y su `export const … = cache(` tal cual) por:

```ts
export const getSessionContext = cache(async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  // "There is no session" is a legitimate answer. "We could not ask" is a failure,
  // and returning null for it would look to every caller like a forced logout.
  if (authErr && !sessionIsMissing(authErr)) throw authErr;
  if (!user) return null;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) throw profileErr;

  let couple: Couple | null = null;
  let partner: Profile | null = null;

  if (profile?.couple_id) {
    const [
      { data: coupleRow, error: coupleErr },
      { data: partnerRow, error: partnerErr },
    ] = await Promise.all([
      supabase.from("couples").select("*").eq("id", profile.couple_id).maybeSingle(),
      supabase
        .from("profiles")
        .select("*")
        .eq("couple_id", profile.couple_id)
        .neq("id", user.id)
        .maybeSingle(),
    ]);
    if (coupleErr) throw coupleErr;
    if (partnerErr) throw partnerErr;
    couple = coupleRow;
    partner = partnerRow;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile ?? null,
    couple,
    partner,
  };
});
```

Notas para quien lo escribe:
- `.maybeSingle()` devuelve `data: null, error: null` cuando no hay fila. Lanzar ante `error` **no** rompe el
  caso legítimo "este usuario aún no tiene perfil" ni "la pareja no tiene segundo miembro".
- El `throw profileErr` cierra la otra puerta del mismo bug: hoy un fallo ahí deja `profile: null`, y el layout
  lo lee como "sin pareja" y también manda a `/login`.
- **No** envuelvas nada en try/catch. `redirect()` de Next funciona lanzando; un catch aquí lo tragaría.

- [ ] **Step 3: Verificar que el build pasa**

Run: `NODE_OPTIONS=--use-system-ca corepack pnpm build`
Expected: exit 0, `tsc` limpio, 15 rutas.

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries.ts
git commit -m "fix(auth): getSessionContext throws instead of faking a logged-out user"
```

---

### Task 4: Verificación en vivo (la ejecuta el controlador, no un subagente)

**Files:** ninguno. Es verificación, no código.

**Interfaces:**
- Consumes: la app construida por las Tasks 1-3.
- Produces: la evidencia que autoriza el merge.

**Regla de datos:** la BD de producción tiene **una pareja real con datos**. No sembrar ahí. Crear un usuario y
una pareja desechables por SQL (Supabase MCP) y borrarlos al terminar, comprobando recuentos antes y después.
Playwright: `chromium.launch({ channel: "chrome" })`. **Nunca correr `pnpm build` con `pnpm dev` levantado**:
sobrescribe `.next` y la app deja de hidratar.

Los casos 1 y 2 son inseparables. Un cambio que lanzara ante *cualquier* error pasaría el 1 y rompería el 2.
Si sólo se ejecuta uno de los dos, no se ha probado nada.

- [ ] **Step 1: Caso 3 (control) — la app funciona normal**

Con `.env.local` apuntando al Supabase real y una sesión iniciada, entrar a `/inicio` y `/citas`.
Expected: las pantallas renderizan con datos. Sin esto, los demás casos no significan nada.

- [ ] **Step 2: Caso 2 — sin cookies sigue yendo a `/login`**

Borrar las cookies del navegador (o usar un contexto nuevo) y entrar a `http://localhost:3000/inicio`.
Expected: redirige a `/login` y se ve el formulario. **El cierre de sesión sigue funcionando.**
Este es el caso que rompería un arreglo ingenuo.

- [ ] **Step 3: Caso 4 — cerrar sesión desde el header**

Con sesión, pulsar el icono de salir en el `AppHeader`.
Expected: redirige a `/login`.

- [ ] **Step 4: Caso 1 — el bug arreglado**

Parar el dev server. En `.env.local`, cambiar `NEXT_PUBLIC_SUPABASE_URL` a `http://127.0.0.1:9`
(puerto reservado, conexión rechazada → `AuthRetryableFetchError`). Arrancar el dev server. Con la sesión ya
iniciada del caso 3, entrar a `http://localhost:3000/inicio`.
Expected: se ve **"Algo se nos cayó"** con el botón `Reintentar`, y la URL sigue siendo `/inicio`.
**NO** debe redirigir a `/login`. Eso es exactamente el bug que esta rama arregla.

Comprobar también `http://localhost:3000/login` con la URL rota: debe verse la misma pantalla de error
(decisión 3 del spec), no un formulario que no podría funcionar.

- [ ] **Step 5: Restaurar el entorno**

Devolver `NEXT_PUBLIC_SUPABASE_URL` a su valor real en `.env.local`. Reiniciar el dev server. Confirmar que
`/inicio` vuelve a renderizar (el caso 3 otra vez). Sin esto, la máquina queda rota para la próxima sesión.

- [ ] **Step 6: Limpiar y anotar**

Borrar el usuario y la pareja de prueba. Comprobar que los recuentos de la BD vuelven exactamente a los de
antes. Escribir el resultado real —incluidos los fallos, si los hubo— en `.superpowers/sdd/progress.md`.

---

## Notas para el revisor

- **La línea más peligrosa es el discriminador.** Si `sessionIsMissing` devolviera `false` para
  `AuthSessionMissingError`, el usuario deslogueado vería una pantalla de error en vez del login. Si devolviera
  `true` para `AuthRetryableFetchError`, no habríamos arreglado nada. Compruébala en ambos sentidos.
- **El middleware no debe lanzar nunca.** Un throw ahí produce el 500 crudo de Next, no `error.tsx`.
- **Fallar abierto es una decisión de seguridad tomada con el humano**, documentada en la decisión 1 del spec.
  Eso no la hace correcta: si ves un camino de ataque concreto que la RLS y el guard del layout no cierren,
  descríbelo y que decida el humano.
- Los `throw` nuevos en `getSessionContext` no van dentro de ningún try/catch: `redirect()` de Next funciona
  lanzando y un catch lo tragaría.
- No se toca `getActiveBudget` (ya lanza), ni las 13 mutaciones (ya devuelven `ActionResult`), ni
  `(app)/error.tsx`, ni `global-error.tsx`.
