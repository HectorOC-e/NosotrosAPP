# Diseño — Que la sesión falle ruidosamente

**Fecha:** 2026-07-08 · **Rama:** `fix/session-fail-loudly` · **Base:** `main` @ `79469ea`

## Problema

Un fallo transitorio de red **desloguea visualmente al usuario**. La app no dice "no pude conectar": lo manda
a `/login`, como si la sesión hubiera expirado.

Es el último resto del antipatrón que ya corregimos dos veces en este repo: en `getActiveBudgetId` (que ahora
lanza) y en las 13 mutaciones (que ahora devuelven `ActionResult`). Aquí sobrevive en la ruta de sesión.

## La causa raíz NO es la que apuntaba el backlog

El backlog culpaba a `getSessionContext()`. Es cierto que se traga sus errores, pero **no es lo que produce el
síntoma**. El middleware corre *antes* que el layout:

`src/lib/supabase/middleware.ts:33-35` llama a `auth.getUser()`, **descarta el `error`**, y en
`:41-45` redirige a `/login` cuando `!user`. En un blip de red la redirección ya ocurrió y
`getSessionContext()` ni siquiera se ejecuta.

Arreglar sólo `queries.ts` no habría cambiado nada visible. Hay que arreglar ambos.

## No todo `error` es un fallo

`auth.getUser()` sin cookie devuelve `error: AuthSessionMissingError`. Eso **es** "no hay sesión", no un
fallo. Si lanzáramos ante cualquier `error`, romperíamos el cierre de sesión: el usuario deslogueado vería una
pantalla de error en vez del login.

Verificado: `@supabase/supabase-js` reexporta `isAuthSessionMissingError`, `isAuthApiError` e
`isAuthRetryableFetchError`. `AuthRetryableFetchError` (fallo de red) trae `status: 0`.

**La regla:**

| Qué pasó | `error` | Qué significa | Qué hacemos |
|---|---|---|---|
| No hay cookie | `AuthSessionMissingError` | No hay sesión | `/login` |
| JWT inválido, expirado o usuario baneado | `AuthApiError` 4xx | La sesión no vale | `/login` |
| Red caída, DNS, conexión rechazada | `AuthRetryableFetchError` (status 0) | **No pudimos preguntar** | error |
| Supabase devuelve 5xx | `AuthApiError` 5xx | **No pudimos preguntar** | error |

En una frase: **4xx significa "tu sesión no vale"; red y 5xx significan "no pudimos preguntar".**

## Decisiones

1. **El middleware falla abierto.** Cuando no puede saber si hay usuario, deja pasar la petición en vez de
   redirigir. No es un agujero de seguridad: el middleware nunca fue la barrera —la RLS lo es— y el layout
   vuelve a comprobar la sesión. Si el fallo era transitorio, el usuario ni se entera. Es una decisión de
   seguridad consciente, no un descuido.
2. **`getSessionContext()` lanza** cuando no pudo preguntar, y sigue devolviendo `null` cuando genuinamente no
   hay sesión.
3. **Las páginas públicas muestran la misma pantalla de error — cuando hay algo que preguntar.** Sin código
   extra: el `src/app/error.tsx` nuevo ya las cubre.

   **Corregido tras la verificación en vivo.** Este punto tiene un matiz que el diseño original no vio:
   - `/login` **con** cookie de sesión y Supabase caído → pantalla de error. El cliente intenta validar el
     token, la red falla, `getSessionContext` lanza. ✔ verificado.
   - `/login` **sin** cookie y Supabase caído → **el formulario**, no la pantalla de error. Y es correcto: sin
     token que validar, `auth.getUser()` corta en seco con `AuthSessionMissingError` **sin tocar la red**. No
     hay caída que detectar. El visitante ve el login, lo intenta, y `signIn` le devuelve su mensaje cálido ya
     existente.

   No es un defecto: es que un visitante anónimo no puede enterarse de una caída que nunca consulta.
4. **Un solo discriminador compartido.** Middleware y `getSessionContext` no pueden discrepar sobre qué es "no
   hay sesión". Mismo patrón que `getActiveBudget` como fuente única de "salida activa".

## Alcance

Dentro: `middleware.ts`, `getSessionContext()` en `queries.ts`, un módulo nuevo con el discriminador, y un
`src/app/error.tsx` nuevo.

Fuera: `getActiveBudget` (ya lanza), las 13 mutaciones (ya devuelven `ActionResult`), `(app)/error.tsx` y
`global-error.tsx` (ya existen y funcionan). Sin cambios de esquema, sin migraciones, sin dependencias nuevas.

## Arquitectura

### 1. `src/lib/supabase/auth-error.ts` (nuevo)

```ts
/**
 * True when the error means "there is no valid session" — the user must log in.
 * False when it means "we could not ask" (network down, Supabase 5xx): the caller
 * must surface a failure, not pretend the user is logged out.
 */
export function sessionIsMissing(error: unknown): boolean
```

Implementación: `isAuthSessionMissingError(error)` → `true`. `isAuthApiError(error)` con
`status >= 400 && status < 500` → `true`. Todo lo demás → `false`.

Módulo plano, sin `"use server"`. Lo importan el middleware (Edge runtime) y `queries.ts` (Node).

### 2. `src/lib/supabase/middleware.ts`

Captura el `error` de `auth.getUser()`. Redirige a `/login` sólo cuando la ruta es privada **y** o bien no hay
error y no hay usuario, o bien `sessionIsMissing(error)`. Cuando hay un error que *no* es de sesión ausente,
**no redirige**: devuelve `supabaseResponse` y deja que la petición continúe.

Nunca lanza. Un throw en middleware produce un 500 crudo de Next, no un `error.tsx`.

### 3. `src/lib/queries.ts` → `getSessionContext()`

- `auth.getUser()`: si hay `error` y `sessionIsMissing(error)` → `return null`. Si hay `error` y no lo es →
  `throw error`. Si no hay error y no hay `user` → `return null`.
- Las tres consultas PostgREST (`profiles`, `couples`, el perfil del partner) pasan de descartar su `error` a
  `if (error) throw error`. Hoy un fallo ahí deja `profile: null`, que el layout lee como "sin pareja" y
  también manda a `/login`. Es la misma puerta por otro lado.

### 4. `src/app/error.tsx` (nuevo)

`(app)/error.tsx` **no** atrapa un throw de `(app)/layout.tsx`: en Next, un `error.tsx` no cubre el layout de
su propio segmento. Este boundary vive un nivel más arriba, así que sí lo atrapa — y de paso cubre `/login`,
`/bienvenida` y `/`.

El layout raíz sobrevive, así que puede usar las clases del design system. Copy idéntico al de
`(app)/error.tsx` ("Algo se nos cayó" + `Reintentar`), sin `AppHeader` ni `BottomNav`, que viven en `(app)`.

Loguea el error en un `useEffect` con `console.error`, como los otros dos boundaries. No muestra `message` ni
`digest` al usuario.

## Verificación

El repo no tiene test runner. El fallo se simula de verdad, sin tocar el código: apuntar
`NEXT_PUBLIC_SUPABASE_URL` a `http://127.0.0.1:9` en `.env.local` (conexión rechazada → `AuthRetryableFetchError`).

Los cuatro casos, contra una pareja desechable que se borra al terminar:

1. **Con sesión y URL rota** → sale "Algo se nos cayó", **no** `/login`. Es el bug arreglado.
2. **Con URL buena y sin cookies** → sale `/login`. El cierre de sesión sigue funcionando.
3. **Con URL buena y sesión** → la app funciona normal.
4. **Cerrar sesión desde el header** → `/login`.

Los casos 1 y 2 son los que demuestran que el discriminador funciona. Sin ambos no se ha probado nada: un
cambio que lance ante *cualquier* error pasaría el 1 y fallaría el 2.

**El host de la simulación importa.** No usar `http://127.0.0.1:9`: la cookie de sesión se llama
`sb-<ref>-auth-token` y `<ref>` sale del primer segmento del hostname
(`new URL(url).hostname.split(".")[0]`). Con `127.0.0.1` el cliente buscaría `sb-127-auth-token`, no encontraría
sesión, devolvería `AuthSessionMissingError` y redirigiría a `/login` — se estaría probando "usuario
deslogueado", no "red caída", y se concluiría que el arreglo no funciona. El host
`https://iymibuwzwxzcpybcpkrp.supabase.invalid` conserva el ref y falla en el DNS (`.invalid` no resuelve
nunca, RFC 2606).

Más: `NODE_OPTIONS=--use-system-ca corepack pnpm build` verde, y comprobar que el tamaño del middleware
(hoy 90.8 kB en la tabla de rutas) no se dispara al importar los type-guards.

## Riesgos

- **Fallar abierto en el middleware es una decisión de seguridad.** Se sostiene porque el middleware nunca fue
  la barrera (la RLS lo es) y el layout revalida. Pero es explícito, no accidental.
- **Cambio visible de comportamiento.** Si Supabase se cae, antes parecía "me deslogueó" y ahora parece "la app
  está caída". Lo segundo es la verdad, pero es la primera vez que el usuario ve esa pantalla.
- El discriminador clasifica un `AuthApiError` 4xx como "sesión inválida". Si Supabase devolviera alguna vez un
  400 por una razón no relacionada con el token, mandaríamos al usuario a `/login` — exactamente lo que hace
  hoy en todos los casos. No es una regresión.
