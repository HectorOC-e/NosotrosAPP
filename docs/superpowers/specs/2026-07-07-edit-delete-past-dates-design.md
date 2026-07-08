# Diseño — Editar y borrar el historial de "Citas pasadas"

**Fecha:** 2026-07-07 · **Rama:** `feat/edit-delete-past-dates` · **Base:** `main` @ `96a9545`

## Problema

La sección "CITAS PASADAS" de `/citas` (entrega 3b) es de solo lectura. Una cita empezada por error, o
con un nombre derivado mal de la idea (`shortDateName` corta a 32 caracteres), queda en el historial
para siempre. Hay que permitir **renombrar** y **borrar** citas pasadas.

## Grounding verificado (Supabase MCP, proyecto `iymibuwzwxzcpybcpkrp`)

- **Sin migración.** `budgets.label` es `text NOT NULL`; no hacen falta columnas nuevas.
- **RLS ya lo cubre.** `budgets` y `expenses` tienen políticas `UPDATE` y `DELETE` con
  `couple_id = get_my_couple_id()`. Ambos miembros de la pareja pueden editar y borrar.
- **`expenses_budget_id_fkey → budgets(id) ON DELETE CASCADE`.** Un solo `DELETE` sobre `budgets` borra
  sus `expenses` en la base de datos. No hay que borrar las filas hijas primero.
- **Radio de impacto del cascade: pequeño.** `/gastos` solo lee los `expenses` del budget *activo* (el más
  reciente). Los gastos de una cita pasada hoy solo se ven como el total agregado `L {spent}` de su
  propia fila en "Citas pasadas". Borrar una cita pasada no borra nada visible en otra pantalla.

## Decisiones

1. **"Editar" = renombrar `budgets.label`.** El gasto (`L X`) es un agregado derivado de `expenses`, no un
   campo del budget; no es editable desde aquí. La fecha tampoco.
2. **"Borrar" = `DELETE` real, con cascada.** Es lo que un usuario espera de "borrar" y no deja filas
   huérfanas. Alternativas descartadas: *soft-delete* (exige migración, y sin UI de restauración sería un
   cementerio invisible) y *desvincular los gastos* (`budget_id` es `NOT NULL`, y mover los gastos a otra
   cita rompe su significado).
3. **Confirmación por doble tap inline**, no modal. El ethos del diseño es "sin diálogos" (las favoritas se
   borran de un tap), pero aquí el borrado sí pierde datos, así que un tap accidental no puede bastar.
4. **Solo las pasadas.** La salida activa no está en la lista y las Server Actions la rechazan.

## Alcance

Dentro: renombrar y borrar `budgets` de tipo cita (`date_idea_id IS NOT NULL`) que no sean la salida activa.

Fuera: editar el monto o la fecha; restaurar lo borrado; tocar la salida activa (se administra en `/gastos`);
borrar la `date_idea` asociada (la FK `budgets.date_idea_id` es `ON DELETE SET NULL`, no al revés — borrar
un budget no toca la idea).

## Server Actions — `src/lib/actions/citas.ts`

Dos exports nuevos, con el patrón del archivo (`requireCouple()` → escribir → `revalidatePath`):

```ts
export async function renameOuting(budgetId: string, label: string): Promise<void>
export async function deletePastDate(budgetId: string): Promise<void>
```

### Guard compartido

Las Server Actions son endpoints invocables desde el cliente: aunque la UI nunca ofrezca la salida activa,
el servidor debe rechazarla. Un helper privado (no exportado — cada export de un archivo `"use server"` es
una Server Action invocable) resuelve el budget y valida:

- No existe (o RLS lo oculta) → no-op.
- `date_idea_id IS NULL` → no es una cita → no-op.
- `id === await getActiveBudgetId(supabase)` → es la salida activa → no-op.

En los tres casos la acción retorna sin escribir, como hace `addIdea` con texto vacío. No se lanza error:
son estados inalcanzables desde la UI, y un `throw` visible no aporta nada al usuario.

`getActiveBudgetId` ya vive en `src/lib/queries.ts` y es la definición compartida de "salida activa"
(la misma que usan `citas/page.tsx` y las acciones de `gastos`).

### `renameOuting`

`label.trim()`; si queda vacío, no-op. Se recorta a 60 caracteres (`slice(0, 60)`) — el input tiene el
mismo `maxLength`, esto es el respaldo del servidor. Luego `update({ label })` sobre `budgets` por `id`.

### `deletePastDate`

Un solo `delete()` sobre `budgets` por `id`. Postgres borra los `expenses` por la FK.

### Revalidación

Ambas acciones: `revalidatePath("/citas")` y nada más. `/gastos` e `/inicio` solo leen el budget activo,
que el guard garantiza intacto. Añadirlos sería revalidación muerta.

## UI — `src/components/citas/citas-client.tsx`

La fila de la lista "Citas pasadas" gana dos botones, con el mismo lenguaje visual que las favoritas
(`Empezar` / `Eliminar`: texto plano, `text-[13px]`, sin fondo):

```
Lectura:  Cena en la terraza   hace 3 días  L 450   Editar   Eliminar
Editando: [Cena en la terraza______]                Guardar  Cancelar
Borrando: Cena en la terraza   hace 3 días  L 450   Editar   ¿Seguro?
```

### Estado

Dos piezas de estado local en `CitasClient`, más el `pending` del `useTransition` que ya existe:

- `editingId: string | null` — la fila en modo edición (más un `draft: string` con el texto del input).
- `confirmingId: string | null` — la fila con el borrado armado.

Son mutuamente excluyentes: abrir uno limpia el otro. Solo una fila puede estar en cada modo a la vez.

### Renombrar

Tap en `Editar` → el nombre se reemplaza por un `<input>` en la misma fila (`maxLength={60}`, autofocus),
y los botones pasan a `Guardar` / `Cancelar`. El total y la fecha se ocultan para dejar sitio al input.

- **Enter** o **Guardar** → si el valor recortado es no vacío y distinto del actual,
  `startTransition(() => renameOuting(id, draft))`; en cualquier caso se cierra el modo edición.
- **Esc** o **Cancelar** → cierra sin llamar al servidor.

Sin render optimista: la fila se actualiza cuando `revalidatePath` refresca el Server Component, igual que
las favoritas.

### Borrar

Tap 1 en `Eliminar` → `confirmingId = id`; el botón pasa a `¿Seguro?` en rojo (`text-alert`) y se arma un
`setTimeout` de 4 s que lo desarma solo (`confirmingId = null`). Tap 2 en `¿Seguro?` →
`startTransition(() => deletePastDate(id))`.

El timeout se limpia al desmontar el componente, al cambiar de fila y al confirmar. Se usa un `useRef` para
el handle y un `useEffect` de limpieza; sin esto un `setState` post-desmontaje o un desarmado tardío de la
fila equivocada son posibles.

### Deshabilitado

Todos los botones respetan el `disabled={pending}` existente, para que un doble envío no se cuele mientras
la transición corre.

## Manejo de errores

Las Server Actions hacen `throw error` si Supabase falla (el patrón de todo `src/lib/actions/citas.ts`).
Next lo muestra como error de la acción; no hay UI de error por fila y no la agregamos: sería la primera del
archivo y no hay precedente. Los rechazos del guard son silenciosos por diseño (ver arriba).

## Verificación

El repo no tiene tests unitarios ni de integración. La verificación es:

1. `NODE_OPTIONS=--use-system-ca corepack pnpm build` verde (incluye `tsc`).
2. Prueba en vivo en `/citas` con la cuenta de prueba `osoriohector89@gmail.com`: sembrar una cita pasada
   con el propio flujo (`Empezar` una idea dos veces → la primera cae al historial), renombrarla,
   verificar que el nombre persiste tras recargar, y borrarla. No se siembran datos vía SQL en cuentas
   reales.
3. Comprobar que la salida activa sigue en `/gastos` con sus gastos intactos después de borrar una pasada.

## Riesgos

- **El borrado es irreversible y se lleva los gastos de esa cita.** La confirmación de doble tap lo mitiga;
  no lo elimina. Es la decisión consciente del punto 2.
- `getActiveBudgetId` define "activa" como el budget más reciente. Si en el futuro se permite crear budgets
  con fecha pasada, el guard heredaría esa definición. Hoy es correcta y es la única que existe en el código.
