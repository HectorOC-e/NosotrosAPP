# ▶️ Retomar sesión — Nosotros

**Estado al 2026-07-08 · rama `main` @ `ffcc485` (desplegado en Vercel).**

## ✅ Ya hecho y desplegado
- **3b — Historial de citas:** sección "CITAS PASADAS" en Citas (`budgets` con `date_idea_id`, excluyendo
  la salida activa, con gasto por salida); `generateDateIdea` evita re-sugerir citas ya iniciadas.
- **3c — Streaming del chat del mediador:** Route Handler `POST /api/mediator` (auth por cookies → key
  service-role → OpenRouter `stream:true` → `ReadableStream`; persiste user+assistant al terminar).
- **Deuda técnica:** `getActiveBudgetId` unificado en `lib/queries.ts` → una sola definición de "salida activa".
- **Editar/borrar el historial de "Citas pasadas"** *(merge `ffcc485`)*: renombrar el `label` inline y borrar
  con confirmación de doble tap. Server Actions `renameOuting` / `deletePastDate` en `lib/actions/citas.ts`,
  con un guard privado que rechaza la salida activa y los budgets no-cita. **Borrar arrastra los `expenses`
  de esa cita** por la FK `ON DELETE CASCADE` — decisión de diseño explícita, irreversible.
  Sin migración. Spec y plan en `docs/superpowers/{specs,plans}/2026-07-07-edit-delete-past-dates*`.
  Se arregló de paso `getActiveBudgetId`, que se tragaba su `error` de Supabase (fail-open: un fallo
  transitorio habría dejado borrar la salida activa).

Verificado en vivo con Playwright contra una pareja de prueba desechable (17/17 aserciones + cascada
comprobada en BD). Todo lo anterior (login, cita↔salida, mediador IA, contexto de pareja) ya estaba en
`main`. Ver `HANDOFF.md`.

## 🔜 Siguiente: sin feature asignada
Backlog acumulado, en orden de valor (detalle en `.superpowers/sdd/progress.md`):
1. **Manejo de errores.** No hay `error.tsx` ni `global-error.tsx`, y ninguna Server Action captura su
   `throw`. Un fallo de red deja al usuario sin feedback. Merece una entrega propia.
2. **`gastos/page.tsx` e `inicio/page.tsx` duplican en línea la query de `getActiveBudgetId`** en vez de
   llamarla, pese a que su docstring dice ser la "single source of truth".
3. Pulido del historial: `type="button"` en los botones, `onBlur` que cierre el input de edición,
   pasar `coupleId` a `getActiveBudgetId` desde las server actions (defensa en profundidad).
4. **SMTP propio en Supabase** — el correo integrado tiene rate limit bajo y rompe el onboarding real.

## 🧭 Flujo de trabajo (OBLIGATORIO)
Superpowers instalado (`superpowers@superpowers-dev` v6.1.1, scope user). Las skills se cargan al iniciar
sesión — conviene retomar en sesión nueva.
1. `superpowers:brainstorming` → cerrar el diseño. 2. `superpowers:writing-plans` → `docs/superpowers/plans/`.
3. `superpowers:subagent-driven-development` → tarea por tarea, ledger en `.superpowers/sdd/`.
4. `superpowers:finishing-a-development-branch` → merge `--no-ff` a `main`, borrar rama, push.
Si hay que cambiar el plan a media ejecución: brainstorming → writing-plans. Nunca codear el cambio directo.

## ⚙️ Notas de entorno
- **Build:** `NODE_OPTIONS=--use-system-ca corepack pnpm build` (proxy TLS corporativo; `pnpm` no está en PATH).
- **Rama de despliegue = `main`.** `feat/nosotros-app` es un puntero VIEJO; ignorar que las herramientas la sugieran.
- **Supabase MCP** (solo el controlador): proyecto `iymibuwzwxzcpybcpkrp`. Migraciones/tipos por MCP.
- **`.env.local` no está versionado.** Si falta, basta con `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable, pública por diseño) para todo menos el mediador, que además
  necesita `SUPABASE_SERVICE_ROLE_KEY` (server-only; en Vercel ya está).
- **Pruebas en navegador:** la BD de producción tiene **una pareja real con datos**. Nunca sembrar ahí:
  crear un usuario + pareja desechables por SQL (MCP) y borrarlos al terminar. Playwright: los navegadores
  descargados están desfasados → lanzar con `chromium.launch({ channel: "chrome" })`. Los scripts `pw-*.mjs`
  en la raíz están gitignorados y deben vivir ahí (resolución de `node_modules`).
