# Nosotros

App de pareja compartida — citas, calendario, gastos y comunicación, todo
compartido entre ustedes dos. Mobile-first, recreada fielmente desde el diseño
validado.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS** + tokens del design system (shadcn/ui como base de componentes)
- **Supabase** (`@supabase/ssr`) — Server Components para lecturas, Client
  Components para interacciones
- **pnpm** · desplegable en **Vercel**

## Design system

Paleta y tipografía definidas en `tailwind.config.ts` y `globals.css`:

| Token | Color | Uso |
|-------|-------|-----|
| `bg` | `#120F17` | Fondo |
| `overlay` | `#1B1626` | Panel |
| `rosa` | `#FF6F91` | Acento / creador |
| `violeta` | `#8B7CFF` | Acento / invitado |
| `teal` | `#3ED6B5` | Positivo / dentro de presupuesto |
| `amber` | `#FFB84D` | Cerca del límite |
| `alert` | `#FF6B6B` | Sobregiro / error |
| `ink` / `ink-secondary` / `ink-tertiary` | `#F2EEF9` / `#A79FBD` / `#6b6380` | Texto |

Fuentes: **Fraunces** (serif, títulos), **Inter** (UI), **JetBrains Mono**
(números — Lempiras, códigos, fechas, porcentajes).

## Empezar

```bash
pnpm install
pnpm dev
```

Abre http://localhost:3000.

### Variables de entorno

Crea `.env.local` (ya incluido para desarrollo):

```
NEXT_PUBLIC_SUPABASE_URL=https://iymibuwzwxzcpybcpkrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
```

### Nota de red (proxy corporativo)

Si estás detrás de un proxy con inspección TLS y `pnpm install` falla con
`fetch failed`, ejecuta con la CA del sistema:

```bash
# Windows (persistente)
setx NODE_OPTIONS "--use-system-ca"
```

## Estructura

```
src/
  app/
    login/                 # flujo de autenticación (crear / unirse)
    (app)/                 # app autenticada (con tab bar)
      inicio/ citas/ calendario/ gastos/ comunicacion/
  components/              # brand mark, nav, ui/, y cada pantalla
  lib/
    supabase/              # clients server / browser / middleware
    actions/               # Server Actions (mutaciones)
    queries.ts             # sesión + pareja
    couple-service.ts      # onboarding (crear / unirse)
    constants.ts format.ts # tokens de contenido y formateadores es-HN
```

## Backend

Supabase (proyecto `nosotros-app`). Todas las tablas con RLS filtrado por
`public.get_my_couple_id()`. El onboarding usa la función
`join_couple_by_code` (SECURITY DEFINER) para unirse por código sin exponer
parejas ajenas.

Regenerar los tipos tras cambios de esquema:

```bash
pnpm types > src/lib/database.types.ts
```
