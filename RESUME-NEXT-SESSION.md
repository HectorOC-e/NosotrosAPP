# ▶️ Retomar sesión — Nosotros (entregas 3b + 3c)

**Estado al 2026-07-07:** el plan de implementación de **3b (Historial de citas)** + **3c (Streaming del chat
del mediador)** está **escrito y SIN EJECUTAR**, en la rama **`feat/history-streaming`** (spec + plan
commiteados y pusheados). La ejecución quedó pendiente para la próxima sesión (posiblemente en otra PC).

Todo lo anterior (mediador IA, login, cita↔salida, IA de ideas/preguntas, contexto de pareja) ya está en
`main` y desplegado en Vercel. Ver `HANDOFF.md` y la memoria del proyecto.

---

## 📋 PROMPT PARA LA PRÓXIMA SESIÓN (cópialo tal cual)

> Retomamos la app **Nosotros**. Hay un plan de implementación listo y **sin ejecutar** para las entregas
> **3b (historial de citas)** + **3c (streaming del chat del mediador)**, en la rama
> **`feat/history-streaming`**.
>
> **OBLIGATORIO — usa las skills de _superpowers_, tal como se venía trabajando. No implementes nada a mano
> fuera de este flujo:**
> 1. Carga contexto primero: `git fetch && git checkout feat/history-streaming`; lee el plan
>    `docs/superpowers/plans/2026-07-07-history-streaming.md` (fuente de verdad) y el spec
>    `docs/superpowers/specs/2026-07-07-history-streaming-design.md`; revisa `MEMORY.md` (roadmap,
>    arquitectura, gotchas de OpenRouter/proxy).
> 2. Invoca **`superpowers:subagent-driven-development`** y ejecuta el plan **tarea por tarea**: un
>    subagente implementador por tarea (modelo económico para transcripción, estándar para integración),
>    **revisor por tarea** cuando aporte (Tareas 3–4 de streaming lo ameritan) y una **revisión final de
>    rama con el modelo más capaz (opus)** antes de mergear. Mantén el ledger en `.superpowers/sdd/`.
> 3. Si hubiera que cambiar el plan, primero **`superpowers:brainstorming`** → **`superpowers:writing-plans`**;
>    nunca codees el cambio directo.
> 4. Al terminar, usa **`superpowers:finishing-a-development-branch`**: `git merge --no-ff` a `main`, borra
>    la rama y `git push origin main` (Vercel redespliega). **Estas entregas NO tocan el esquema.**
>
> **Notas de entorno / ejecución:**
> - Build local: `NODE_OPTIONS=--use-system-ca` (proxy corporativo TLS). En PowerShell:
>   `$env:NODE_OPTIONS='--use-system-ca'; pnpm build`.
> - Sin cambios de esquema en 3b/3c (reusan `budgets`/`expenses`/`date_ideas`/`ai_messages`). Si por algo
>   necesitaras migrar/regenerar tipos, es vía **Supabase MCP**, proyecto `iymibuwzwxzcpybcpkrp` (los
>   subagentes no tienen MCP → esos pasos los hace el controlador).
> - Secreto: `SUPABASE_SERVICE_ROLE_KEY` ya está en Vercel; en local `.env.local` es un **placeholder**
>   (reemplázalo con el valor real solo si vas a probar el streaming en vivo local).
> - Prueba en vivo del streaming: requiere una API key de OpenRouter configurada en Ajustes. La pareja de
>   prueba `osoriohector89@gmail.com` ya tiene una (modelo `openai/gpt-4o-mini`). Evita sembrar datos en
>   cuentas reales; prueba en `/comunicacion` con esa cuenta.
> - El plan tiene un caveat de secuencia: `PastDate` se define en `citas-client.tsx` (Tarea 2) pero lo
>   importa `citas/page.tsx` (Tarea 1) → implementa la Tarea 2 antes de buildear la Tarea 1, o espera build
>   rojo hasta que aterrice la 2.
>
> Empieza cargando el plan + ledger y arranca la ejecución subagent-driven. No pidas confirmación entre
> tareas; ejecuta todo el plan y solo detente si quedas BLOCKED o al terminar.

---

## Resumen del plan (5 tareas)

**Grupo 3b — Historial de citas (ship-able solo):**
- **Tarea 1:** `citas/page.tsx` consulta las citas pasadas (`budgets` con `date_idea_id`, excluyendo la
  activa) + gasto por salida; `generateDateIdea` junta los textos de citas ya iniciadas al `avoid`.
- **Tarea 2:** sección **"CITAS PASADAS"** en `CitasClient` (+ tipo/prop `PastDate`).

**Grupo 3c — Streaming del chat:**
- **Tarea 3:** Route Handler `POST /api/mediator` (auth por cookies → key service-role → OpenRouter
  `stream:true` → `ReadableStream` de tokens; persiste user+assistant al terminar).
- **Tarea 4:** `mediator-panel.tsx` transmite el chat en vivo (`router.refresh()` al terminar); elimina
  `sendMediatorMessage`.
- **Tarea 5:** verificación (build, 3b por SQL/UI, 3c en vivo con key real).

**Fuera de alcance (siguiente):** streaming de reflexión/ideas/preguntas; reflexión post-cita;
editar/borrar historial; realtime.
