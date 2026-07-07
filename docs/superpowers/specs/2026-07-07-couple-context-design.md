# Diseño — Contexto de la pareja + refinamiento de IA (entrega 3a)

**Fecha:** 2026-07-07 · **App:** Nosotros (Next.js 15 App Router + Supabase)
Entrega 3a del roadmap ([[nosotros-roadmap]]). Entregas siguientes en cola: **3b historial de citas**, **3c streaming**.

## Objetivo

La IA no conoce a la pareja y sugiere planes de ciudades lejanas. Esta entrega:
1. **Contexto de la pareja** persistido en la BD (ubicación, presupuesto típico, tiempo juntos, hijos, y
   "sobre cada persona"), inyectado en **todos** los prompts de IA (mediador, ideas, preguntas).
2. **Refinamiento** de la fase 2: las ideas consideran todos los filtros (costo + vibras); un solo botón
   "Sorpréndenos" que usa IA; las preguntas se anclan a los 6 temas + el ánimo.

## Decisiones (brainstorming)

| Decisión | Elección |
|---|---|
| Granularidad del contexto | **Por persona** (`profiles.about`) **+ compartido** (`couples.*`). |
| Campos estructurados | Ubicación, presupuesto típico, desde-cuándo (fecha), ¿hijos? (bool), + about por persona. |
| Botón Sorpréndenos | **Uno solo = IA**; sin key → cae al pool aleatorio; otros errores → mensaje cálido. |
| Preguntas | Ancladas a los 6 temas + ánimo; UI muestra "Sobre {tema}". |
| Secuencia | 3a ahora; historial (3b) y streaming (3c) son entregas separadas. |

## Cambios de esquema (aditivos, seguros en prod)

```sql
alter table public.profiles add column if not exists about text;

alter table public.couples add column if not exists location text;
alter table public.couples add column if not exists typical_budget numeric;
alter table public.couples add column if not exists together_since date;
alter table public.couples add column if not exists has_kids boolean;

-- Both partners can edit the shared couple context (couples had no UPDATE policy).
create policy update_own_couple on public.couples
  for update using (id = public.get_my_couple_id());
```

- `profiles.about` se edita con la política existente `update_own_profile` (cada quien el suyo).
- La nueva política `update_own_couple` permite a **ambos** miembros editar los campos compartidos de
  `couples`. (No expone campos sensibles: `invite_code` sigue solo-lectura por no tener por qué cambiarse
  desde la UI.)

## Contexto → prompts

Helper server-only `buildCoupleContext(supabase, coupleId): Promise<string>` en `src/lib/ai/context.ts`:
- Lee `couples` (location, typical_budget, together_since, has_kids) y ambos `profiles`
  (display_name, about, partner_role) vía el cliente RLS.
- Arma un bloque en español, omitiendo líneas sin dato; devuelve `""` si no hay nada:
  ```
  Contexto de la pareja (tenlo muy en cuenta al sugerir):
  - Ubicación: Marcala, La Paz, Honduras. Sugiere planes cercanos y realistas para esa zona.
  - Presupuesto típico de salida: L 300.
  - Llevan juntos: ~2 años.
  - Tienen hijos.
  - {NombreA}: {about A}
  - {NombreB}: {about B}
  ```
  ("Llevan juntos" se deriva de `together_since`; "Tienen hijos" solo si `has_kids = true`.)
- Se **antepone al system prompt** en: `chatSystem` (mediador chat y reflexión), `dateIdeaMessages`,
  `guidingQuestionMessages`. Los builders reciben un `coupleContext?: string` opcional que, si viene no
  vacío, se concatena al inicio del contenido `system`.

**`runMediator` se modifica** (ahora legítimo) para construir el contexto y pasarlo a `chatSystem`.

## Ajustes reorganizado (`/ajustes`)

Hoy: creador ve el form de IA; invitado ve solo un gate. Nuevo layout, **dos secciones**:

1. **"Sobre nosotros"** — visible y editable por **ambos**:
   - Ubicación (texto, compartido), Presupuesto típico (número L, compartido), Desde cuándo
     (`<input type="date">`, compartido), ¿Tienen hijos? (toggle, compartido).
   - "Tú" (tu `about`, textarea) — editable solo por ti.
   - El `about` de tu pareja se muestra en solo lectura (si existe).
   - Botón Guardar → Server Action `saveAboutUs({ location, typicalBudget, togetherSince, hasKids, about })`
     que actualiza los campos compartidos de `couples` (RLS `update_own_couple`) y el `about` del propio
     `profile` (RLS `update_own_profile`), luego `revalidatePath("/ajustes")` + `/inicio` + `/citas` +
     `/comunicacion`.
2. **"Mediador IA"** (provider/model/API key) — **solo creador** (como hoy). El invitado ya no ve un gate
   vacío: ve la sección "Sobre nosotros".

La página `ajustes/page.tsx` (Server Component) lee: perfil propio (about), pareja (nombre + about),
couple (campos), `isCreador`, y `ai_settings` (creador). Pasa props a un `AboutUsForm` (ambos) y al
`AjustesClient` de IA (creador).

## Refinamiento

### Ideas — todos los filtros + vibras
- `generateDateIdea(input: { filters: string[] })` (reemplaza `{ costFilter }`): deriva el costo (si hay
  uno de `COST_CATS`) y las vibras (los de `VIBE_CATS`) de `filters`. `dateIdeaMessages` recibe
  `costFilter?`, `vibes: string[]`, `avoid`, `coupleContext`.
- La IA responde `{"cost":"...","vibes":[...],"text":"..."}`. `parseDateIdea` (renombrado/extendido)
  valida `vibes ⊆ VIBE_CATS` (descarta inválidas) y devuelve `{ text, cost, vibes }`.
- `saveGeneratedIdea({ text, cost, vibes })` persiste `vibe = vibes.join(",") || null`.
- La tarjeta de la idea de IA muestra tags de costo + vibras.

### Un solo botón "Sorpréndenos" = IA
- El botón "Sorpréndenos" del pool ahora llama a `generateAi()` (IA). Se **elimina** el botón
  "Sorpréndenos con IA ✨".
- `generateAi`: si `reason === "sin-key"` → cae al `surprise()` del pool (idea aleatoria, sin IA); otros
  errores → mensaje cálido; con key → idea de IA.

### Preguntas por tema
- `generateGuidingQuestion` pasa a `guidingQuestionMessages` los 6 títulos+preguntas de `TOPICS`,
  el `moodSummary` y `coupleContext`. La IA elige el tema pertinente y devuelve JSON
  `{"topic":"<uno de los 6 o General>","question":"..."}`. Parseo defensivo (topic inválido → "General").
- `generateGuidingQuestion(): Promise<{ ok; question?; topic?; reason? }>`.
- UI: muestra **"Sobre {topic}"** encima de la pregunta.

## Manejo de errores
- Contexto vacío → prompts sin bloque de contexto (comportamiento actual). Nunca rompe.
- `saveAboutUs`: si la RLS rechaza (no debería) → mensaje cálido; validación numérica del presupuesto.
- IA: mismas razones cálidas (`aiReasonMessage`). Parseos defensivos (idea, pregunta) nunca lanzan.
- `generateAi` sin key cae al pool (no muestra error).

## Pruebas
- **Unit:** `buildCoupleContext` arma el bloque correcto y omite líneas vacías (con/sin datos);
  `parseDateIdea` filtra vibras inválidas; parseo de `{topic,question}` cae a "General" con topic inválido.
- **Build:** `pnpm build` exit 0, `tsc` limpio.
- **SQL:** `saveAboutUs` persiste `couples.location`/etc. y `profiles.about`; ambos miembros pueden
  actualizar `couples` (política nueva).
- **E2E (con key real, manual):** poner ubicación "Marcala, La Paz, Honduras" → "Sorpréndenos" sugiere
  algo cercano; "Nueva pregunta" muestra "Sobre {tema}"; sin key, "Sorpréndenos" cae al pool.

## Fuera de alcance (entregas siguientes)
- **3b Historial de citas** (pantalla + que la IA use las citas pasadas para no repetir).
- **3c Streaming** de respuestas.
- Editar el `about` de la pareja por el otro (cada quien edita el suyo).
