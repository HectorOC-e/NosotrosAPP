# Diseño — Vertical de IA: Mediador + Vault + Ajustes

**Fecha:** 2026-07-07 · **App:** Nosotros (Next.js 15 App Router + Supabase) · **Estado backend:** ver `HANDOFF.md`

## Objetivo

Completar el "item 3" pendiente del handoff: conectar el **mediador IA** real (hoy un teaser
`PRÓXIMAMENTE` estático en Comunicación), con una pantalla de **Ajustes** donde el *creador* de la
pareja configura la IA, y su **API key guardada cifrada en Supabase Vault** (BYOK por pareja).

Cubre las 3 promesas del teaser:
- "Sugiere frases en el momento justo" → **chat** en tiempo real.
- "Resume los patrones de su semana" → **reflexión semanal** (botón).
- "Eventualmente, conversa con ustedes" → **chat** compartido y persistente.

## Decisiones tomadas (brainstorming)

| Decisión | Elección |
|---|---|
| Modelo de API key | **BYOK por pareja** — el creador entra su propia key (OpenRouter), cifrada en Vault. |
| Comportamiento | **Chat en tiempo real + botón de reflexión semanal.** |
| Persistencia del chat | **Hilo compartido persistente** — tabla nueva `ai_messages`, RLS couple-scoped. |
| Acceso seguro a la key | **Enfoque A** — service-role en el Server Action de Next; la key nunca llega al cliente. |
| Provider v1 | **OpenRouter** (default del esquema). Modelo configurable, default a un Claude vía OpenRouter. |
| Streaming | **No en v1** (respuesta completa, estado "pensando…"). Anotado como mejora futura. |

## Arquitectura de seguridad (Enfoque A)

El mediador debe funcionar para **ambos** miembros, pero `ai_settings` es RLS solo-creador y la key en
Vault jamás puede tocar el navegador.

- Lectura de la key: un RPC `get_couple_ai_key(couple_id)` `SECURITY DEFINER` con **`EXECUTE` revocado a
  `authenticated`/`anon`** y concedido **solo a `service_role`**.
- El Server Action valida sesión+pareja con el cliente normal (cookies), luego usa un **cliente
  service-role** (solo en el server de Next) para invocar ese RPC, llama a OpenRouter desde el server, y
  **solo el texto** de respuesta vuelve al cliente.
- La service-role key vive en `SUPABASE_SERVICE_ROLE_KEY` (env var server-only; nunca `NEXT_PUBLIC_`).

## Cambios de esquema (únicas adiciones)

### Tabla `ai_messages`

```
ai_messages
  id           uuid  pk  default gen_random_uuid()
  couple_id    uuid  not null  → couples.id
  role         text  not null  check in ('user','assistant')
  kind         text  not null  default 'chat'  check in ('chat','summary')
  content      text  not null
  created_by   uuid  null  → profiles.id      -- quién envió (null para el asistente)
  created_at   timestamptz  default now()
```

RLS (patrón existente):
- `SELECT`: `couple_id = get_my_couple_id()`
- `INSERT`: `with check couple_id = get_my_couple_id()`
- Sin `UPDATE`/`DELETE` (hilo append-only).

El resumen semanal se guarda como fila `role='assistant', kind='summary'` (reutiliza el hilo).

### Funciones SQL nuevas (ambas `SET search_path = public, vault, pg_temp`)

**`set_ai_config(p_provider text, p_model text, p_key text) returns void`** — `SECURITY DEFINER`,
`GRANT EXECUTE TO authenticated`.
- Adentro exige que `auth.uid()` sea `creador` de su pareja; si no, `raise exception`.
- Si `p_key` no es vacío: crea el secreto con `vault.create_secret` (o `vault.update_secret` si ya existe
  `api_key_secret_id`), guarda el `uuid` en `ai_settings.api_key_secret_id`. Si `p_key` es vacío/null,
  conserva la key existente (permite editar solo el modelo).
- `upsert` en `ai_settings` por `couple_id` (provider, model, updated_by = uid, updated_at = now()).

**`get_couple_ai_key(p_couple_id uuid) returns table(provider text, model text, api_key text)`** —
`SECURITY DEFINER`, **`REVOKE EXECUTE FROM authenticated, anon`**, **`GRANT EXECUTE TO service_role`**.
- Lee `ai_settings` de `p_couple_id` + descifra vía `vault.decrypted_secrets`.
- Devuelve la key en claro (solo alcanzable por service-role).

## Frontend

### Pantalla de Ajustes — `/ajustes` (grupo `(app)`)

- **Entrada:** ícono `Settings` (lucide) en `AppHeader`, junto al de cerrar sesión.
- **Gate:** la página lee `getSessionContext()`; si `partner_role === 'invitado'`, muestra estado suave
  ("Solo {creador} puede configurar el mediador") en vez del formulario.
- **Formulario (creador):** Server Component lee `ai_settings` (RLS creador-only) → pasa a un
  `AjustesClient`:
  - Provider: `OpenRouter` fijo (label informativo).
  - Modelo: dropdown curado (default Claude vía OpenRouter) + opción de escribir uno propio.
  - API key: campo `password`. Si `api_key_secret_id` existe → placeholder "•••• guardada — deja vacío
    para conservarla". La key nunca se devuelve al cliente; solo se expone el booleano "existe".
  - "Guardar" → Server Action `saveAiConfig` → RPC `set_ai_config` → `revalidatePath('/ajustes')` +
    `/comunicacion`.
  - Enlace de ayuda a openrouter.ai/keys.
- Estilo: `.glass`, `.field`, `.btn-*` existentes; estados de éxito/error cálidos.

### Mediador en Comunicación (reemplaza el teaser)

El bloque `PRÓXIMAMENTE` de `comunicacion-client.tsx` se sustituye por `MediatorPanel`. La página
`comunicacion/page.tsx` pasa además: `hasAiKey` (bool), `isCreador` (bool), `partnerName`, y el historial
`messages` (de `ai_messages`).

- **Sin key** → gate: creador ve "Activa el mediador en Ajustes" (link); invitado ve "Pídele a
  {creador} que active el mediador ✨".
- **Con key** → chat:
  - Historial del hilo (`kind='chat'` y `'summary'`) con las burbujas ya diseñadas (rosa = user,
    violeta/blanco = asistente; la reflexión se muestra destacada).
  - Input + enviar → Server Action `sendMediatorMessage(text)`:
    1. `requireCouple()` → inserta fila `user` (`created_by = uid`).
    2. Junta contexto: moods de los últimos 7 días + temas + últimos ~10 mensajes.
    3. Cliente service-role → `get_couple_ai_key(coupleId)` → llama OpenRouter con system prompt de
       "mediador cálido de pareja, es-HN, no terapeuta, sin diagnósticos".
    4. Inserta fila `assistant` → `revalidatePath('/comunicacion')`.
  - Botón "Generar reflexión de la semana ✨" → Server Action `generateWeeklyReflection()` → misma
    mecánica, guarda `role='assistant', kind='summary'`.
  - Errores cálidos: si OpenRouter falla / key inválida → mensaje suave y **no** se persiste fila de
    asistente vacía.

## Config nueva y archivos

- `SUPABASE_SERVICE_ROLE_KEY` — env var server-only (Vercel + `.env.local`). Agregar `.env.example`.
- `lib/supabase/service.ts` — `server-only`, cliente service-role; nunca importado desde cliente.
- `lib/actions/ai.ts` — `"use server"`: `saveAiConfig`, `sendMediatorMessage`, `generateWeeklyReflection`.
- `lib/ai/openrouter.ts` — `server-only`: helper de llamada a OpenRouter (URL, headers, parsing).
- `lib/ai/prompts.ts` — system prompts + armado de contexto (moods/temas/historial).
- `components/ajustes/ajustes-client.tsx`, `app/(app)/ajustes/page.tsx`.
- `components/comunicacion/mediator-panel.tsx` (nuevo; se integra en `comunicacion-client.tsx`).
- Actualizar `lib/database.types.ts` (regenerar tipos tras la migración).

## Manejo de errores

- `set_ai_config` por no-creador → excepción SQL → Server Action la traduce a mensaje cálido.
- `get_couple_ai_key` llamado por `authenticated` → denegado por grants (verificado en test).
- Sin `ai_settings`/key → gate en Comunicación (no se llama al LLM).
- Fallo de OpenRouter (red, 401, rate limit) → mensaje suave; no se guarda respuesta vacía.

## Pruebas (Playwright + SQL admin, patrón existente)

1. **Ajustes:** creador guarda key → `ai_settings` poblado + 1 secreto en Vault; el placeholder cambia a
   "guardada". Invitado ve el gate.
2. **Mediador:** con key sembrada, enviar mensaje persiste filas `user`+`assistant` en `ai_messages` y se
   renderizan; sin key, se ve el gate correcto por rol.
3. **Reflexión:** botón genera una fila `kind='summary'` visible en el hilo.
4. **Seguridad:** `get_couple_ai_key` rechaza al rol `authenticated`/`anon` (solo `service_role`); la key
   nunca aparece en el payload del cliente.

## Fuera de alcance (v1)

- Streaming de respuestas (mejora futura).
- Otros providers además de OpenRouter.
- Editar/borrar mensajes del hilo.
- Realtime (sigue por `revalidatePath`, como el resto de la app).
- Nombrar el espacio / cambiar contraseña (otros ítems de Ajustes, no este vertical).
