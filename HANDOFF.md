# 📋 Reporte de estado — "Nosotros"

**Fecha:** 2026-07-06 · **Rama:** `main` · **Commit:** `0f85376` · **Repo:** `github.com/HectorOC-e/NosotrosAPP`
**Stack:** Next.js 15.5.20 (App Router) · TypeScript · Tailwind + tokens del DS · Supabase SSR · pnpm 11.1.1

> Documento de handoff para otra sesión que continuará el trabajo. Objetivo: entender dónde
> quedamos sin abrir el código. Honesto por sobre optimista.

---

## 1. RESUMEN DE LO CONSTRUIDO

### Implementado y funcionando (verificado en navegador real con Playwright)

| Pantalla | Estado | Notas |
|---|---|---|
| **Auth / Onboarding** (`/login`) | ✅ Real | Elección → Crear / Unirse con código → interstitial "revisa tu correo" → confirmación → `/bienvenida`. |
| **Login usuarios recurrentes** | ✅ Real | Email+contraseña; ruteo a `/inicio` o a onboarding si falta pareja. |
| **Bienvenida** (`/bienvenida`) | ✅ Real | Pantalla de éxito: código de invitación (creador) o "ya son un espacio" (invitado). |
| **Inicio** (`/inicio`) | ✅ Real | Próximo pendiente, presupuesto activo con barra de color, check-in de ambos, shortcut a Citas. |
| **Citas** (`/citas`) | ✅ Real | Chips de filtro con **fill activo real** (rosa), idea central, "Sorpréndenos", favoritas, agregar idea. |
| **Calendario** (`/calendario`) | ✅ Real | Próximos 7 días, lista de pendientes con checkbox, agregar pendiente. |
| **Gastos** (`/gastos`) | ✅ Real | Presupuesto, banner cálido de sobregiro, lista de gastos, definir salida, registrar gasto. |
| **Comunicación** (`/comunicacion`) | ✅ Real (check-in + temas) / 🟡 Mock (mediador IA) | Check-ins y temas guía funcionan; el mediador IA es **solo visual**. |
| **Cerrar sesión** | ✅ Real | Icono en el header en todas las pantallas. |

Todas las **Server Actions persisten en la BD real** (verificado: agregar idea, mood, toggle
pendiente, gastos, crear/unir pareja, login, logout). Cero errores de consola originados por la app.

### Parcial / mock / placeholder (explícito)

- **Mediador IA** (Comunicación): **100% simulado**, por diseño. Teaser "PRÓXIMAMENTE" con burbujas de
  chat falsas atenuadas. No hay ninguna llamada a un LLM. *(Coincide con el diseño — no es omisión,
  pero no está conectado a nada real.)*
- **`couples.name`**: siempre queda `null`. No hay UI para nombrar el espacio (el diseño no lo pedía).
- **Ideas agregadas por el usuario**: se guardan bien, pero solo reaparecen dentro del pool aleatorio
  de "Sorpréndenos" — no hay lista de "todas las ideas" (esto replica el prototipo).
- **Sincronización entre parejas**: es por **revalidación de servidor** (`revalidatePath`), no realtime.
  Ambos ven lo compartido, pero **solo al navegar/refrescar**, no en vivo. No hay suscripciones de
  Supabase Realtime.

---

## 2. DESVIACIONES DEL PLAN ORIGINAL

1. **Confirmación de correo ON → flujo de round-trip** *(desviación mayor, decidida con el usuario)*.
   El prototipo entra a la app de inmediato tras crear/unirse. Pero el backend real tiene **email
   confirmation activada**, y sin sesión no se puede crear el perfil/pareja (RLS necesita `auth.uid()`).
   Se adaptó a: signup → "revisen su correo" → clic en enlace → `/auth/confirm` completa la
   creación/unión → `/bienvenida`. **El usuario eligió mantener confirmación y adaptar la UI.**

2. **Nueva función SQL `join_couple_by_code` (SECURITY DEFINER)** *(adición al backend, aprobada por el
   usuario)*. La RLS de `couples` (`id = get_my_couple_id()`) impide resolver un código a `couple_id`
   antes de ser miembro. Se agregó esta RPC para unirse de forma segura sin filtrar parejas ajenas.
   **Es la única adición al esquema.**

3. **Creación de pareja con `id` generado en cliente**. Por la misma RLS, `insert().select()` sobre
   `couples` no devuelve nada pre-vínculo. Se genera el `id` con `randomUUID()`, se inserta, se vincula
   el perfil como `creador`, y luego se lee el `invite_code`.

4. **Login de usuarios recurrentes** *(añadido, no estaba en el diseño)*. El diseño solo cubría
   crear/unirse. Un usuario que cierra sesión o entra en otro dispositivo no tenía forma de volver.
   Se agregó pantalla "Iniciar sesión" en el mismo lenguaje visual.

5. **Código de invitación**: el prototipo mostraba `AH4821` (demo). Se usa el real del backend, formato
   `LUNA284` (palabra + 3 dígitos, vía `generate_invite_code()`).

6. **Datos semilla**: solo se siembran las **8 ideas de cita genéricas** al crear pareja. Los datos demo
   del prototipo (gastos, pendientes, sobregiro) **NO** se inyectan — se usan los empty states reales.

**Diseño de Claude Design replicado 1:1** (colores, tipografía, radios, spacing, copy, estados). No hubo
partes que no se pudieran replicar. El único "estado no cableado" del prototipo (fill activo de los chips
de filtro) **sí se implementó** aquí (fill rosa `#FF6F91` con `aria-pressed`).

---

## 3. ESTRUCTURA DEL PROYECTO

```
src/
├── middleware.ts                      # refresh de sesión + guard de rutas
├── app/
│   ├── layout.tsx                     # fuentes (Fraunces/Inter/JetBrains), <html lang=es>
│   ├── globals.css                    # tokens, .app-panel, .glass, .btn-*, .field
│   ├── icon.svg                       # favicon (2 burbujas rosa/violeta)
│   ├── page.tsx                       # redirect → /inicio
│   ├── login/page.tsx                 # onboarding + login (Server Component → AuthFlow)
│   ├── bienvenida/page.tsx            # éxito post-confirmación
│   ├── auth/confirm/route.ts          # Route Handler: verifyOtp + completa onboarding
│   └── (app)/                         # grupo autenticado (header + tab bar)
│       ├── layout.tsx                 # shell: AppHeader + BottomNav; guard de pareja
│       ├── inicio/page.tsx
│       ├── citas/page.tsx             # SC lee → CitasClient
│       ├── calendario/page.tsx        # SC lee → CalendarioClient
│       ├── gastos/page.tsx            # SC calcula totales → GastosClient
│       └── comunicacion/page.tsx      # SC lee → ComunicacionClient
├── components/
│   ├── brand-mark.tsx  app-header.tsx  bottom-nav.tsx
│   ├── auth/           auth-flow.tsx  welcome-success.tsx
│   ├── citas/  calendario/  gastos/  comunicacion/   # *-client.tsx (Client Components)
│   └── ui/             button.tsx  input.tsx  labeled-field.tsx   # shadcn-style
└── lib/
    ├── database.types.ts              # tipos generados de Supabase (incl. RPC)
    ├── supabase/                      # client.ts, server.ts, middleware.ts, types.ts
    ├── queries.ts                     # getSessionContext() (cache()) — user→profile→couple→partner
    ├── couple-service.ts              # createCouple / joinCouple / ensureProfile
    ├── onboarding-core.ts             # complete/completePendingOnboarding (server-only, cliente como arg)
    ├── partners.ts                    # derivePartners() → slots A(creador)/B(invitado)
    ├── constants.ts  format.ts        # contenido del DS + formateadores es-HN
    └── actions/                       # "use server" — onboarding, citas, calendario, gastos, comunicacion, context
```

### Convenciones

- **Lectura**: Server Components (`page.tsx`) leen de Supabase y pasan props planos a Client Components.
- **Mutación**: Server Actions en `lib/actions/*.ts` (`"use server"`), cada una llama `requireCouple()`
  (en `actions/context.ts`) → valida sesión+pareja, luego escribe y `revalidatePath`.
- **Regla clave**: lógica ligada a sesión que recibe el cliente Supabase como argumento vive en módulos
  `server-only` (NO `"use server"`), porque Next trata cada export de un archivo `"use server"` como
  Server Action invocable desde cliente (args serializables). Por eso `onboarding-core.ts` está separado
  de `actions/onboarding.ts`.
- Nombres: kebab-case en archivos; `*-client.tsx` para Client Components de pantalla.

---

## 4. ESTADO DE SUPABASE

**Proyecto:** `nosotros-app` · ref `iymibuwzwxzcpybcpkrp` · us-east-1 · ACTIVE_HEALTHY.

### Esquema — coincide con el existente, con UNA adición

Las 8 tablas existen **sin cambios de columnas**: `couples`, `profiles`, `events`, `budgets`,
`expenses`, `moods`, `date_ideas`, `ai_settings`. Todas con **RLS activo** filtrado por
`public.get_my_couple_id()`. No se agregaron ni modificaron columnas ni tablas.

**Única adición (migración aplicada):** función
`public.join_couple_by_code(p_code text, p_display_name text default null) returns uuid` —
`SECURITY DEFINER`, `grant execute to authenticated`. Funciones preexistentes intactas:
`generate_invite_code()`, `get_my_couple_id()`, `touch_updated_at()`.

> ⚠️ Se usó SQL admin (vía MCP) para crear usuarios de prueba confirmados durante el testing. Todos
> fueron borrados — la BD quedó en ceros (0 users, 0 couples).

### Variables de entorno (solo nombres)

| Variable | Dónde | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` (local) | Falta ponerla en Vercel. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` (local) | Publishable key (`sb_publishable_…`), pública por diseño. Falta en Vercel. |
| `NEXT_PUBLIC_SITE_URL` | comentada en `.env.local` | Opcional; fija el origin del redirect de confirmación. Recomendada en Vercel. |
| `NODE_OPTIONS=--use-system-ca` | entorno local | Necesaria por proxy corporativo TLS (ver §7). No aplica en Vercel. |

**No existe `.env.example`** (recomendado agregarlo). `.env.local` está en `.gitignore`.

### Supabase Vault para la clave de IA

**PENDIENTE — no implementado en absoluto.** La tabla `ai_settings` tiene `api_key_secret_id uuid`
(referencia a un secreto de Vault) y RLS solo-creador, pero:

- **No hay UI** para configurar provider/model/API key (no existe pantalla de Ajustes).
- **No hay Server Action** que escriba en `ai_settings` ni que guarde secretos en Vault.
- **No se tocó Vault** en ningún punto.

Es un vertical completo sin empezar.

---

## 5. AUTENTICACIÓN Y ROLES

### Flujo crear/unirse — estado real

- **Crear**: ✅ funciona end-to-end (con el round-trip de confirmación). `createCouple` → perfil
  `creador` → siembra 8 ideas → muestra `invite_code`.
- **Unirse por código**: ✅ funciona vía RPC `join_couple_by_code` (valida el código, vincula como
  `invitado`). Errores cálidos: código inválido → *"Mmm, ese código no existe…"*.
- **Confirmación por correo**: el handler `/auth/confirm` (verifyOtp + `completePendingOnboarding`) está
  implementado y **verificado en sus rutas de error** (token inválido → redirige con mensaje).
  ⚠️ **El happy-path con una bandeja real NUNCA se probó** (ver §6).

### partner_role (creador/invitado) en la UI

- Se lee de `profiles.partner_role` (`'creador'` | `'invitado'`).
- `derivePartners()` (`lib/partners.ts`) ordena a los dos miembros en **slots fijos por rol**:
  **A = creador (rosa `#FF6F91`)**, **B = invitado (violeta `#8B7CFF`)**, independiente de quién esté
  logueado. Devuelve iniciales, nombres y `meSlot`.
- Se aplica en: brand mark del header, paneles de check-in (Inicio/Comunicación), selector de "quién
  pagó" en Gastos, y nombres de "agregó {X}" en Calendario.
- `ai_settings` es creador-only por RLS, pero como no hay UI de IA, ese rol aún no se ejerce en pantalla.

---

## 6. PENDIENTES CONOCIDOS / BUGS (honesto)

**No probado a fondo:**

1. **Happy-path de confirmación de correo con inbox real** — nunca se ejecutó de punta a punta con un
   clic real en el enlace. Se probaron las rutas de error del handler y la lógica de `complete()` (con
   sesión inyectada), pero no el correo real llegando + link + `/bienvenida`. **Riesgo medio**: depende
   de la config de Redirect URLs en Supabase.
2. **Realtime**: no existe. Si ambos están en la app a la vez, no ven cambios del otro hasta
   refrescar/navegar.

**Limitaciones / gaps funcionales:**

3. **Vault + IA**: vertical completo sin implementar (§4).
4. **Sin UI de Ajustes**: no se puede nombrar el espacio, cambiar nombre, cambiar contraseña, ni
   gestionar `ai_settings`.
5. **SMTP integrado de Supabase con rate limit bajo** — se agotó fácil durante pruebas ("Demasiados
   intentos"). Para uso real se necesita **SMTP propio** (SendGrid/Resend). No configurado.
6. **`couples.name` nunca se setea** (siempre null).
7. **Cerrar sesión sin confirmación** (por el ethos "sin diálogos" del diseño) — un tap accidental
   cierra sesión. Reversible con login, pero considerarlo.
8. **Advertencia benigna en build**: `@supabase/ssr` usa `process.version` en el Edge runtime del
   middleware → warning en build, no rompe nada.

**Entorno:**

9. **Proxy corporativo TLS** en la máquina de dev: `pnpm`/`next` fallan sin
   `NODE_OPTIONS=--use-system-ca`. No afecta Vercel.
10. **pnpm 11.1.1** requiere `pnpm-workspace.yaml` con `allowBuilds: {sharp: true, unrs-resolver: true}`
    (quirk de esa versión) — ya está commiteado.

**Sin TODO/FIXME reales en el código.** (No hay deuda marcada con comentarios.)

---

## 7. CÓMO CORRERLO

```bash
# Desde cero (máquina detrás de proxy TLS corporativo → usar system CA):
setx NODE_OPTIONS "--use-system-ca"        # Windows, persistente (reabrir terminal)
#   (en máquinas sin proxy, omitir lo anterior)

pnpm install
pnpm dev            # http://localhost:3000
# o producción:
pnpm build && pnpm start
```

**`.env.local` necesario** (crear con estos nombres):

```
NEXT_PUBLIC_SUPABASE_URL=<url del proyecto nosotros-app>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key sb_publishable_…>
# NEXT_PUBLIC_SITE_URL=http://localhost:3000   # opcional
```

**Testing local (Playwright ya instalado):** para pantallas autenticadas hay que sembrar un usuario
confirmado vía SQL admin e inyectar la sesión (formato cookie `@supabase/ssr`:
`base64-`+base64url(JSON), chunked a 3180 en `sb-<ref>-auth-token.N`).

### Estado de despliegue

- **NO desplegado en Vercel todavía.** No hay URL.
- El usuario eligió **Git integration**: falta importar `HectorOC-e/NosotrosAPP` en vercel.com/new +
  agregar las 2 env vars. Cada push a `main` redesplegará.
- Tras el primer deploy: **agregar la URL de Vercel a Supabase → Auth → URL Configuration (Redirect
  URLs)**, si no, el enlace de confirmación no vuelve a la app.
- Build local verificado: `pnpm build` exit 0, 13 rutas, `tsc` limpio.

---

## 8. SIGUIENTE PASO SUGERIDO

En orden de prioridad:

1. **Cerrar el loop de despliegue + probar el correo real** (bloqueante para uso real): importar en
   Vercel, configurar Redirect URLs en Supabase, y hacer **una prueba real de crear→confirmar→entrar**
   con una bandeja. Es el único flujo sin verificar de punta a punta y el más frágil.
2. **Configurar SMTP propio en Supabase** — el correo integrado no aguanta uso real (rate limit). Sin
   esto, el onboarding falla intermitentemente para usuarios reales.
3. **Implementar el vertical de IA (Vault + Ajustes)** — el mayor bloque sin empezar. Necesita: pantalla
   de Ajustes (solo creador), Server Action que guarde la API key en **Supabase Vault** y referencie
   `ai_settings.api_key_secret_id`, y luego conectar el mediador de verdad (reemplazar el teaser).
4. **Realtime** (si se quiere la sensación "compartido en vivo"): suscripciones de Supabase a
   `moods`/`events`/`expenses` para reflejar cambios del otro sin refrescar.
5. **Pulido menor**: `.env.example`, UI para nombrar el espacio, confirmación suave en cerrar sesión.

Recomendación: atacar **1 y 2 juntos primero** (desbloquean el producto), luego **3** (la funcionalidad
diferenciadora que el diseño promete).
