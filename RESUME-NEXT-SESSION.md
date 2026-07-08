# ▶️ Retomar sesión — Nosotros

**Estado al 2026-07-08 · rama `main` @ `c31ba9c` (desplegado en Vercel).**

## ✅ Ya hecho y desplegado
- **3b — Historial de citas** y **3c — Streaming del chat del mediador**.
- **Editar/borrar el historial de "Citas pasadas"** *(`ffcc485`)*: renombrar inline y borrar con doble tap.
  Borrar arrastra los `expenses` de esa cita (FK `ON DELETE CASCADE`) — decisión explícita, irreversible.
- **Pulido del historial** *(`472b204`)*: `type="button"`, `onBlur` que cancela la edición, y `getActiveBudget()`
  como fuente única de "salida activa".
- **Feedback de errores** *(`a5e53dc`)*: las 13 mutaciones devuelven `ActionResult` en vez de lanzar (un `throw`
  en Server Action se **redacta en producción**). Toasts de éxito y error con **`sileo`**. Nuevos
  `(app)/error.tsx` y `global-error.tsx`. Los fallos de servidor se loguean con `console.error`.
- **Que la sesión falle ruidosamente** *(`c31ba9c`)*: un blip de red ya **no finge un cierre de sesión**.
  `sessionIsMissing()` (`lib/supabase/auth-error.ts`) discrimina: **4xx = "tu sesión no vale"** → `/login`;
  **red, 5xx, 408 y 429 = "no pudimos preguntar"** → pantalla de error. El middleware **falla abierto** cuando no
  puede saberlo; `getSessionContext()` y `requireCouple()` **lanzan** en vez de fingir. Nuevo `src/app/error.tsx`
  (el de `(app)` no atrapa el throw del layout de su propio segmento). Y **`Reintentar` por fin reintenta**.

Todo verificado en navegador contra parejas desechables, borradas al terminar. Ver `HANDOFF.md` (⚠️ desfasado).

## 🔜 Siguiente: sin feature asignada
Backlog, en orden de valor (razonamiento completo en `.superpowers/sdd/progress-*.md`):

1. **SMTP propio en Supabase.** El correo integrado tiene rate limit bajo: **el onboarding de un usuario real
   falla de forma intermitente**, y el happy-path del enlace de confirmación nunca se ejecutó de punta a punta.
   No es código: es configuración (Resend/SendGrid) + dominio verificado. **No lo puede hacer el agente**: el MCP
   de Supabase no expone la configuración de Auth, y las credenciales del proveedor son del usuario.
2. **Realtime.** No existe. Si ambos están en la app a la vez, no ven los cambios del otro hasta refrescar.
   Es la diferencia entre "compartido" y "compartido en vivo". La feature más vistosa y la más cara.
3. **Unificar el canal de error de las mutaciones.** Hoy, si una mutación falla por red, `requireCouple()` lanza y
   el usuario ve la pantalla completa "Algo se nos cayó", no un toast. Es honesto, pero inconsistente con el resto
   del feedback. Exigiría que `requireCouple` devolviera `ActionResult` y que las 13 acciones lo propagaran.
4. **`/api/mediator`** descarta el `error` de `getUser()` igual que hacía todo lo demás. Falla cerrado a un `401`,
   así que no finge un logout — pero es la última puerta del mismo antipatrón.
5. **`/auth/confirm`** manda a `/login?error=enlace` ("tu enlace no vale") cuando `verifyOtp` falla **por red**.
6. **`addExpense` no es transaccional**: si el insert del budget "Salida" tiene éxito y el del gasto falla, queda
   un budget huérfano de límite 0. Arreglarlo bien pide una RPC → cambio de esquema.
7. Pulido: `sileo` renderiza la píldora **clara** con `theme="dark"` (¿es el look querido?); nombrar el espacio
   (`couples.name` siempre `null`); confirmación suave al cerrar sesión.

## ⚠️ Costes y decisiones asumidas (no reabrir sin datos nuevos)
- **`sileo@0.1.5`** (pin exacto, pre-1.0, un mantenedor) arrastra `motion`: **+46,8 kB gzip en todas las pantallas
  autenticadas** (`/citas` First Load: 113 kB → 160 kB). Medido, presentado y aceptado frente a `sonner` (~5 kB).
- `sileo` capitaliza cada palabra del título. Lo anulamos en `globals.css` con `[data-sileo-title][data-sileo-title]`
  — **el selector duplicado es a propósito**: su CSS lo importa el layout `(app)`, carga después de `globals.css`,
  y a igual especificidad ganaba él. No "simplificar" ese selector.
- **El middleware falla abierto.** Decisión de seguridad consciente: nunca fue la barrera (la RLS lo es), cada
  superficie revalida, y un atacante sin cookie no alcanza esa rama (`getUser()` responde `AuthSessionMissingError`
  sin tocar la red). No lo "arregles" volviendo a redirigir.
- **Toasts de éxito en las 13 acciones**, incluidos checkbox y emoji. Decisión del usuario contra la recomendación.

## 🧭 Flujo de trabajo (OBLIGATORIO)
Superpowers instalado (v6.1.1). Las skills se cargan al iniciar sesión.
1. `superpowers:brainstorming` → cerrar el diseño. 2. `superpowers:writing-plans` → `docs/superpowers/plans/`.
3. `superpowers:subagent-driven-development` → tarea por tarea, ledger en `.superpowers/sdd/progress.md`.
4. `superpowers:finishing-a-development-branch` → merge `--no-ff` a `main`, borrar rama, push.
Si hay que cambiar el plan a media ejecución: **enmienda spec y plan primero**. Nunca codees el cambio directo.

## ⚙️ Notas de entorno (leer antes de perder media hora)
- **Build:** `NODE_OPTIONS=--use-system-ca corepack pnpm build` (proxy TLS; `pnpm` no está en PATH).
- **Rama de despliegue = `main`.** `feat/nosotros-app` es un puntero VIEJO.
- **NUNCA correr `pnpm build` con `pnpm dev` levantado**: sobrescribe `.next` y la app deja de hidratar (404 en
  los chunks). Y **nunca `rm -rf .next` en el mismo comando que arranca `pnpm dev`**: da
  `Cannot find the middleware module` (500 en todo). Secuenciar.
- `pkill -f "next dev"` **mata el propio shell** (exit 144): su línea de comando contiene el patrón. Usar
  `pgrep -f next-server` + `kill -9` por PID.
- **Pruebas en navegador:** la BD tiene **una pareja real con datos**. Nunca sembrar ahí: crear usuario + pareja
  desechables por SQL (MCP) y borrarlos al terminar, comprobando recuentos antes y después.
  Playwright: `chromium.launch({ channel: "chrome" })`. Los scripts `pw-*.mjs` viven en la raíz (resolución de
  `node_modules`) y están gitignorados.
- **Para simular una caída de Supabase**, no cambies el host a `127.0.0.1`: la cookie se llama
  `sb-<ref>-auth-token` y el `<ref>` sale del hostname, así que estarías probando "deslogueado", no "red caída".
  Usa `https://<ref>.supabase.invalid` (DNS falla) o un proxy en `http://<ref>.localhost:9999` que puedas
  conmutar sin reiniciar el dev server (imprescindible: reiniciarlo mete HMR y contamina la prueba).
- El build emite `⚠ Compiled with warnings` — `process.version` de `@supabase/supabase-js` en el Edge runtime.
  Benigno y preexistente (`HANDOFF.md §6.8`).
