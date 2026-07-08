# ▶️ Retomar sesión — Nosotros (feature: editar/borrar historial de citas)

**Estado al 2026-07-07 · rama `main` @ `d912204` (desplegado en Vercel).**

## ✅ Ya hecho y desplegado (esta tanda)
- **3b — Historial de citas:** sección "CITAS PASADAS" en Citas (`budgets` con `date_idea_id`, excluyendo
  la salida activa, con gasto por salida); `generateDateIdea` evita re-sugerir citas ya iniciadas.
- **3c — Streaming del chat del mediador:** Route Handler `POST /api/mediator` (auth por cookies → key
  service-role → OpenRouter `stream:true` → `ReadableStream` de tokens; persiste user+assistant al
  terminar). `mediator-panel.tsx` transmite en vivo + `router.refresh()`. Se eliminó `sendMediatorMessage`.
  Hardening de streaming aplicado (try/catch en el `pull`, flush/buffer residual, guard `!res.ok`).
- **Deuda técnica:** `getActiveBudgetId` unificado en `lib/queries.ts` (coupleId opcional), reusado por
  `gastos` actions y `citas/page` → una sola definición de "salida activa". Behavior-preserving.

Merges relevantes: `8e90238` (3b+3c) y `d912204` (fix). Sin cambios de esquema en nada de lo anterior.
Prueba en vivo del streaming: hecha por el usuario. Todo lo anterior (login, cita↔salida, mediador IA,
contexto de pareja) ya estaba en `main`. Ver `HANDOFF.md`.

## 🔜 Siguiente feature: editar/borrar el historial de "Citas pasadas"
Hoy la sección "CITAS PASADAS" (3b) es **solo lectura**. Objetivo: permitir **renombrar** y **borrar**
citas del historial.

**Grounding ya verificado:**
- **Sin cambios de esquema / sin migración.** `budgets` y `expenses` ya tienen RLS couple-scoped completo
  (SELECT/INSERT/**UPDATE**/**DELETE**, `couple_id = get_my_couple_id()`): ambos miembros pueden editar/borrar.
- Falta confirmar en brainstorming: el `ON DELETE` de la FK `expenses.budget_id → budgets.id` (¿cascada al
  borrar el budget, o hay que borrar `expenses` primero con el cliente cookie?).

**Decisiones de diseño a cerrar (brainstorming):**
1. "Editar" = renombrar el `label` de la salida (el gasto es derivado, no editable). Confirmar alcance.
2. "Borrar" = `DELETE` del budget: ¿cascada de `expenses` (se pierde el gasto) o solo ocultar? Definir.
3. UX: reusar el patrón de las favoritas en `citas-client.tsx` (rename inline + botón borrar con
   confirmación). Server Actions nuevas en `lib/actions/citas.ts` (`renameOuting` / `deletePastDate`) +
   `revalidatePath("/citas")` (y `/gastos` si aplica).
4. Guard: solo las pasadas son editables/borrables; la salida activa no está en la lista y no se toca.

## 🧭 Flujo de trabajo (OBLIGATORIO)
Superpowers **ya está instalado** (`superpowers@superpowers-dev` v6.1.1, scope user, habilitado). Las skills
se cargan **al iniciar sesión** — por eso conviene retomar en sesión nueva.
1. `superpowers:brainstorming` para cerrar el diseño (puntos 1–4 arriba).
2. `superpowers:writing-plans` para escribir el plan (a `docs/superpowers/plans/`).
3. `superpowers:subagent-driven-development` para ejecutar tarea por tarea (implementador económico para
   transcripción, estándar para integración; revisor cuando aporte; revisión final con opus).
4. `superpowers:finishing-a-development-branch` para cerrar: merge `--no-ff` a `main`, borrar rama, push.
   Mantener el ledger en `.superpowers/sdd/`.

## ⚙️ Notas de entorno
- **Build:** `NODE_OPTIONS=--use-system-ca corepack pnpm build` (proxy TLS corporativo; `pnpm` no está en
  PATH → usar `corepack pnpm`). PowerShell: `$env:NODE_OPTIONS='--use-system-ca'`.
- **Rama de despliegue = `main`** (Vercel redespliega al pushear). `feat/nosotros-app` es un puntero VIEJO,
  detrás de `main`; ignorar que herramientas la sugieran como base.
- **Supabase MCP** (solo el controlador lo tiene): proyecto `iymibuwzwxzcpybcpkrp`. Migraciones/tipos por MCP.
- **Prueba en vivo del mediador:** cuenta de prueba `osoriohector89@gmail.com` (key OpenRouter
  `openai/gpt-4o-mini`) en `/comunicacion`. Evitar sembrar datos en cuentas reales.
