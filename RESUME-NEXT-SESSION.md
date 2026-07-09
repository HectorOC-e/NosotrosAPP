# ▶️ Retomar sesión — Nosotros

**Estado al 2026-07-08 · rama `main` @ `f785ac0` (desplegado en Vercel).**

## ✅ Ya hecho y desplegado
- **3b — Historial de citas** · **3c — Streaming del chat del mediador**.
- **Editar/borrar el historial de "Citas pasadas"** *(`ffcc485`)*: renombrar inline + borrar con doble tap
  (cascada de gastos, irreversible). **Pulido** *(`472b204`)*: `type=button`, `onBlur` cancela, `getActiveBudget()`.
- **Feedback de errores** *(`a5e53dc`)*: las 13 mutaciones devuelven `ActionResult` en vez de lanzar; toasts con
  **`sileo`**; `(app)/error.tsx` + `global-error.tsx`; `console.error` en los fallos de servidor.
- **Que la sesión falle ruidosamente** *(`c31ba9c`)*: un blip de red ya no finge un logout. `sessionIsMissing()`
  discrimina 4xx (→`/login`) de red/5xx/408/429 (→ error). Middleware falla abierto; `getSessionContext()` y
  `requireCouple()` lanzan; nuevo `src/app/error.tsx`; `Reintentar` reintenta de verdad (`router.refresh()` +
  `reset()` en una transición).
- **Realtime** *(`f785ac0`)*: **los dos miembros ven los cambios del otro en vivo**, sin refrescar. Un trigger en
  las 6 tablas compartidas emite a un canal **privado por pareja** (`couple:<id>`) vía `realtime.send(...,
  private)`. Una policy en `realtime.messages` es el control de acceso. El navegador no lee el payload: solo
  `router.refresh()`. El cliente de Realtime se carga en diferido (`realtime-gate.tsx`) para no pagar +64 kB gzip
  en cada pantalla. **Migración `20260708_realtime_couple_broadcast.sql` ya aplicada a producción** (con rollback
  comentado dentro).

Todo verificado en navegador contra parejas desechables, borradas al terminar. Ver `HANDOFF.md` (⚠️ desfasado).

## 🔜 Siguiente: sin feature asignada
Backlog, en orden de valor (razonamiento en `.superpowers/sdd/progress-*.md`):

1. **SMTP propio en Supabase.** El correo integrado tiene rate limit bajo: **el onboarding de un usuario real
   falla intermitentemente**, y el happy-path del enlace de confirmación nunca se ejecutó de punta a punta.
   **No lo puede hacer el agente**: el MCP de Supabase no expone la config de Auth, y la API key del proveedor
   (Resend/SendGrid) + el dominio verificado son del usuario. Mirar *Authentication → Emails → SMTP Settings*.
2. **Unificar el canal de error de las mutaciones.** Si una mutación falla por red, `requireCouple()` lanza y el
   usuario ve la pantalla completa "Algo se nos cayó", no un toast. Honesto, pero inconsistente. Exigiría que
   `requireCouple` devolviera `ActionResult` y las 13 acciones lo propagaran.
3. **`/api/mediator`** y **`/auth/confirm`**: las dos últimas puertas del antipatrón de "tragarse el error".
4. **`addExpense` no es transaccional** (budget "Salida" huérfano si el insert del gasto falla → RPC → esquema).
5. Pulido: `sileo` renderiza la píldora **clara** con `theme="dark"` (¿es el look querido?); nombrar el espacio
   (`couples.name` siempre `null`); confirmación suave al cerrar sesión.

## ⚠️ Costes y decisiones asumidas (no reabrir sin datos nuevos)
- El layout `(app)` pesa **~161 kB gzip**: subió de 112,5 kB (antes de estas features) por `sileo` (+46,8) y, en
  menor medida, Realtime (+1,1 tras diferirlo; eran +64 sin diferir).
- **`sileo@0.1.5`** (pin exacto, pre-1.0) arrastra `motion`. Su título va en `text-transform: capitalize`, anulado
  en `globals.css` con `[data-sileo-title][data-sileo-title]` (**selector duplicado a propósito**: su CSS carga
  después de `globals.css` y ganaba por orden). No simplificar.
- **El middleware falla abierto** ante un error que no sea de sesión ausente. Decisión de seguridad consciente:
  nunca fue la barrera (RLS lo es), cada superficie revalida, y un atacante sin cookie no alcanza esa rama.
- **Realtime: la policy de `realtime.messages` ES el control de acceso.** Antes había 0 policies (denegaba a
  todos). No la relajes a `using(true)`: filtraría todos los canales a todos. La prueba de seguridad (una tercera
  pareja no recibe nada) es inseparable de la funcional.
- **Realtime emite desde triggers, no Postgres Changes**, porque los `DELETE` del WAL no respetan RLS. No añadas
  las tablas a la publicación `supabase_realtime`.

## 🧭 Flujo de trabajo (OBLIGATORIO)
Superpowers v6.1.1. Las skills se cargan al iniciar sesión.
1. `superpowers:brainstorming`. 2. `superpowers:writing-plans` → `docs/superpowers/plans/`.
3. `superpowers:subagent-driven-development` → ledger en `.superpowers/sdd/progress.md`.
4. `superpowers:finishing-a-development-branch` → merge `--no-ff` a `main`, borrar rama, push.
Si hay que cambiar el plan a media ejecución: **enmienda spec y plan primero**. Nunca codees el cambio directo.

## ⚙️ Notas de entorno (leer antes de perder media hora)
- **Build:** `NODE_OPTIONS=--use-system-ca corepack pnpm build` (proxy TLS; `pnpm` no está en PATH).
- **Migraciones:** solo el controlador (Supabase MCP, proyecto `iymibuwzwxzcpybcpkrp`). Guardar el .sql en
  `supabase/migrations/` con su rollback comentado.
- **Medir el bundle:** la tabla de rutas de Next **NO atribuye a la página los chunks del layout**. Componentes en
  el layout (`Toaster`, `RealtimeGate`) no salen en el `First Load JS` de la página. Fuente real:
  `.next/app-build-manifest.json`, entrada `/(app)/layout`.
- **NUNCA `pnpm build` con `pnpm dev` levantado** (rompe la hidratación), ni `rm -rf .next` en el mismo comando
  que arranca `pnpm dev` (`Cannot find the middleware module`). Secuenciar.
- `pkill -f "next dev"` mata el propio shell (exit 144). Usar `pgrep -f next-server` + `kill -9` por PID.
- **Pruebas en navegador:** la BD tiene **una pareja real con datos**. Nunca sembrar ahí: crear parejas
  desechables por SQL (MCP) y borrarlas al terminar, comprobando recuentos. Playwright:
  `chromium.launch({ channel: "chrome" })`. `pw-*.mjs` en la raíz, gitignorados.
- **Realtime necesita DOS perfiles en la misma pareja** para probarse; contar los refrescos interceptando
  peticiones con header `RSC: 1`. Para simular caída de Supabase: `https://<ref>.supabase.invalid` o un proxy en
  `http://<ref>.localhost:9999` (conserva el ref → la cookie `sb-<ref>-auth-token` sigue siendo la buena).
- El build emite `⚠ Compiled with warnings` — `process.version` de `@supabase/supabase-js` en el Edge runtime.
  Benigno y preexistente (`HANDOFF.md §6.8`).
