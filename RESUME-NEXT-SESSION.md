# ▶️ Retomar sesión — Nosotros

**Estado al 2026-07-08 · rama `main` @ `a5e53dc` (desplegado en Vercel).**

## ✅ Ya hecho y desplegado
- **3b — Historial de citas** y **3c — Streaming del chat del mediador**.
- **`getActiveBudgetId` unificado** en `lib/queries.ts` → una sola definición de "salida activa".
- **Editar/borrar el historial de "Citas pasadas"** *(merge `ffcc485`)*: renombrar inline y borrar con doble tap.
  Borrar arrastra los `expenses` de esa cita (FK `ON DELETE CASCADE`) — decisión explícita, irreversible.
- **Pulido del historial** *(merge `472b204`)*: `type="button"`, `onBlur` que cancela la edición, y
  `getActiveBudget()` como fuente única de "salida activa" (las páginas de gastos e inicio ya no copian la query).
- **Feedback de errores** *(merge `a5e53dc`)*: las 13 mutaciones devuelven
  `ActionResult = {ok:true} | {ok:false, message}` en vez de lanzar (un `throw` en Server Action se **redacta en
  producción**, el cliente nunca sabía qué falló). Toasts de éxito y error con **`sileo`** en los 14 call sites.
  Nuevos `(app)/error.tsx` y `global-error.tsx`. Los fallos de servidor se loguean con `console.error` antes de
  `return fail(...)`, para que convertir `throw`→`return` no dejara ciego al operador.
  Spec y plan: `docs/superpowers/{specs,plans}/2026-07-08-error-feedback*`.

Verificado en navegador contra parejas de prueba desechables, borradas al terminar. Ver `HANDOFF.md`.

## 🔜 Siguiente: sin feature asignada
Backlog, en orden de valor (detalle y razonamiento en `.superpowers/sdd/progress.md`):

1. **`getSessionContext()` se traga sus errores de Supabase** (`lib/queries.ts`). Un fallo transitorio devuelve
   `null` → `(app)/layout.tsx` hace `redirect("/login")`. Es decir: **un blip de red desloguea visualmente al
   usuario**. Es el mismo antipatrón que ya corregimos en `getActiveBudgetId`. Arreglarlo (que lance) exige
   además un `src/app/error.tsx`, porque `error.tsx` no atrapa el throw del layout de su propio segmento.
   Es la entrega de manejo de errores que queda pendiente, y la más valiosa.
2. **`addExpense` no es transaccional**: si el insert del budget "Salida" tiene éxito y el del gasto falla, queda
   un budget huérfano de límite 0. Arreglarlo bien pide una RPC → cambio de esquema.
3. **SMTP propio en Supabase** — el correo integrado tiene rate limit bajo y rompe el onboarding real.
4. Pulido: `sileo` renderiza la píldora **clara** con `theme="dark"` (confirmar si es el look querido);
   pasar `coupleId` a `getActiveBudgetId` desde las server actions (defensa en profundidad).

## ⚠️ Costes y decisiones asumidas
- **`sileo@0.1.5`** (pin exacto, pre-1.0, un mantenedor) arrastra `motion`: **+46,8 kB gzip en todas las
  pantallas autenticadas** (`/citas` First Load: 113 kB → 160 kB). Medido, presentado y aceptado por el usuario
  frente a `sonner` (~5 kB). No reabrir sin datos nuevos.
- `sileo` capitaliza cada palabra del título (`text-transform: capitalize`). Lo anulamos en `globals.css` con
  `[data-sileo-title][data-sileo-title]` — **el selector duplicado es a propósito**: su CSS lo importa el layout
  `(app)`, carga después de `globals.css`, y a igual especificidad ganaba él. No "simplificar" ese selector.

## 🧭 Flujo de trabajo (OBLIGATORIO)
Superpowers instalado (`superpowers@superpowers-dev` v6.1.1). Las skills se cargan al iniciar sesión.
1. `superpowers:brainstorming` → cerrar el diseño. 2. `superpowers:writing-plans` → `docs/superpowers/plans/`.
3. `superpowers:subagent-driven-development` → tarea por tarea, ledger en `.superpowers/sdd/progress.md`.
4. `superpowers:finishing-a-development-branch` → merge `--no-ff` a `main`, borrar rama, push.
Si hay que cambiar el plan a media ejecución: brainstorming → writing-plans. Nunca codear el cambio directo.

## ⚙️ Notas de entorno
- **Build:** `NODE_OPTIONS=--use-system-ca corepack pnpm build` (proxy TLS; `pnpm` no está en PATH).
- **Rama de despliegue = `main`.** `feat/nosotros-app` es un puntero VIEJO; ignorar que las herramientas la sugieran.
- **Supabase MCP** (solo el controlador): proyecto `iymibuwzwxzcpybcpkrp`.
- **`.env.local` no está versionado.** Si falta, bastan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  para todo menos el mediador, que además necesita `SUPABASE_SERVICE_ROLE_KEY` (en Vercel ya está).
- **Pruebas en navegador:** la BD de producción tiene **una pareja real con datos**. Nunca sembrar ahí: crear
  usuario + pareja desechables por SQL (MCP) y borrarlos al terminar, comprobando recuentos antes y después.
  Playwright: los navegadores descargados están desfasados → `chromium.launch({ channel: "chrome" })`.
  Los scripts `pw-*.mjs` viven en la raíz (resolución de `node_modules`) y están gitignorados.
- **NUNCA correr `pnpm build` con `pnpm dev` levantado**: sobrescribe `.next` y la app deja de hidratar (404 en
  los chunks). Cuesta media hora de depuración fantasma.
- `pkill -f "next dev"` **mata el propio shell** (exit 144): su línea de comando contiene el patrón.
- El build emite `⚠ Compiled with warnings` — es el `process.version` de `@supabase/supabase-js` en el Edge
  runtime del middleware. Benigno y preexistente (`HANDOFF.md §6.8`).
