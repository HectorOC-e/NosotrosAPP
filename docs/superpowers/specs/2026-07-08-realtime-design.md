# Diseño — Realtime: que los dos vean lo del otro en vivo

**Fecha:** 2026-07-08 · **Rama:** `feat/realtime` · **Base:** `main` @ `09b2566`

## Problema

La sincronización entre los dos miembros es por **revalidación de servidor**, no en vivo. Ambos ven lo
compartido, pero **solo al navegar o refrescar**. Si tu pareja escribe al mediador, o registra un gasto, o pone
su ánimo, no te enteras hasta que tocas algo.

Es la diferencia entre "compartido" y "compartido en vivo", y es lo último grande que falta.

## Grounding verificado contra el proyecto real (`iymibuwzwxzcpybcpkrp`)

- **Realtime está apagado.** La publicación `supabase_realtime` existe pero **sin ninguna tabla**.
- **Cero policies en `realtime.messages`.** Los canales privados hoy deniegan a todo el mundo.
- `realtime.send()` y `realtime.broadcast_changes()` **existen** en el proyecto.
- Las 6 tablas compartidas tienen `couple_id`: `ai_messages`, `moods`, `events`, `expenses`, `budgets`,
  `date_ideas`.
- `public.get_my_couple_id()` es `STABLE SECURITY DEFINER` y lee `auth.uid()`. Sirve dentro de una policy de
  `realtime.messages`.
- **El cliente de navegador de Supabase (`lib/supabase/client.ts`) existe pero no se usa en ninguna parte.**
  Esta feature es la primera vez que la app abre un WebSocket.
- `supabase-js@2.110` llama a `realtime.setAuth()` en `SIGNED_IN`, `TOKEN_REFRESHED` y `SIGNED_OUT`, así que la
  autorización del canal privado sobrevive al refresco del token sin código nuestro.

## Los dos hechos que deciden la arquitectura

**1. Los `DELETE` de Postgres Changes no respetan la RLS.** Textual de los docs de Supabase:

> *"RLS policies are not applied to `DELETE` statements, because there is no way for Postgres to verify that a
> user has access to a deleted record. When RLS is enabled and `replica identity` is set to `full` on a table,
> the `old` record contains only the primary key(s)."*

Escuchando el WAL, cada borrado de `budgets` o `expenses` despertaría al navegador de **todas** las parejas, con
la PK de la fila borrada. Hoy hay una sola pareja, así que es teórico — pero borrar citas es una función que
acabamos de construir, y el fanout crece con cada usuario.

**Un trigger, en cambio, ve `OLD.couple_id` entero.** Emitiendo desde un trigger, los borrados quedan
correctamente acotados a su pareja. Esa es la razón técnica de elegir Broadcast sobre Postgres Changes.

**2. Esta app no tiene estado en el cliente.** Todo es Server Components + `revalidatePath`. No hay un store que
parchear con la fila que llega. Realtime no necesita traernos datos: solo avisarnos de que algo cambió, para
llamar a `router.refresh()`. Eso hace que el punto 1 sea además irrelevante para nosotros: nunca leemos la fila.

## Decisiones

1. **Broadcast desde triggers de la base de datos**, no Postgres Changes. Por el punto 1, y porque un trigger no
   se puede olvidar: emitir desde las 13 Server Actions dejaría cualquier mutación futura muda, y el fallo sería
   invisible hasta que alguien lo notara.
2. **Un canal privado por pareja** (`couple:<couple_id>`), protegido por una policy en `realtime.messages`.
   Esa policy **es** el control de acceso.
3. **El cliente no lee el payload para pintar.** Solo `router.refresh()`.
4. **Alcance: las 6 tablas compartidas.** Decisión del usuario ("todo lo compartido"). Fuera: `profiles` (cambia
   casi nunca) y `ai_settings` (creador-only, sin valor en vivo).

## Alcance

Dentro: una migración (una función trigger, 6 triggers, una policy en `realtime.messages`), un Client Component
nuevo, y su montaje en `(app)/layout.tsx`.

Fuera: `replica identity` y la publicación `supabase_realtime` (no usamos WAL). Optimistic updates. Indicador de
"conectado". Presence (saber si el otro está mirando). Sincronizar `profiles` o `ai_settings`.

## Arquitectura

### 1. Emisión — `supabase/migrations/<ts>_realtime_couple_broadcast.sql`

```sql
create or replace function public.notify_couple_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
begin
  -- In a DELETE trigger NEW is unassigned; reading new.couple_id raises.
  if tg_op = 'DELETE' then cid := old.couple_id; else cid := new.couple_id; end if;
  if cid is not null then
    perform realtime.send(
      jsonb_build_object('tabla', tg_table_name, 'op', tg_op, 'actor', auth.uid()),
      'cambio',
      'couple:' || cid::text,
      true  -- private channel
    );
  end if;
  return null;  -- AFTER trigger; return value is ignored
end;
$$;
```

El `if tg_op = 'DELETE'` no es cosmético: en plpgsql, dentro de un trigger de `DELETE`, `NEW` no está asignado y
leer `new.couple_id` lanza un error en tiempo de ejecución. Y es exactamente ahí donde este diseño gana sobre el
WAL: `OLD.couple_id` está completo.

Un trigger `after insert or update or delete for each row` en cada una de las 6 tablas.

Y la policy, sin la cual no hay privacidad **ni** funcionalidad (los canales privados deniegan por defecto):

```sql
create policy "couple listens to its own channel"
  on realtime.messages for select to authenticated
  using (
    extension = 'broadcast'
    and realtime.topic() = 'couple:' || public.get_my_couple_id()::text
  );
```

El archivo de migración incluye su propio **rollback comentado** (`drop trigger` × 6, `drop function`,
`drop policy`).

### 2. Escucha — `src/components/realtime-refresher.tsx` (nuevo)

Client Component, sin UI (`return null`), montado en `src/app/(app)/layout.tsx` con el `coupleId` y el `userId`
que el layout ya tiene de `getSessionContext()`.

```tsx
const channel = supabase
  .channel(`couple:${coupleId}`, { config: { private: true } })
  .on("broadcast", { event: "cambio" }, ({ payload }) => {
    if (payload?.actor === userId) return;  // revalidatePath already refreshed us
    debouncedRefresh();
  })
  .subscribe((status) => {
    if (status === "SUBSCRIBED" && !first.current) router.refresh();
    first.current = false;
  });
```

Tres detalles que no son opcionales:

- **Debounce de 250 ms.** Borrar una cita con 5 gastos dispara 6 triggers (la cascada de la FK
  `expenses.budget_id`). Sin debounce, 6 `router.refresh()`.
- **Ignorar los eventos propios.** Quien muta ya se refrescó con `revalidatePath`. *(El mediador escribe con el
  cliente service-role, donde `auth.uid()` es `null`; ahí refrescan ambos. Aceptable.)*
- **`router.refresh()` al recibir `SUBSCRIBED`, salvo la primera vez.** Si el WebSocket se cae y vuelve, los
  eventos de ese hueco se perdieron para siempre. Sin esto la app se queda callada y desincronizada **sin
  avisar** — el peor fallo posible en una feature cuyo único propósito es no estar desincronizado. La primera
  vez se salta porque la página acaba de renderizarse en el servidor.

Limpieza en el `return` del `useEffect`: `clearTimeout` + `supabase.removeChannel(channel)`.

## Manejo de errores

Si el canal no llega a `SUBSCRIBED` (policy mal, red caída, token inválido), el componente **no rompe nada**: la
app sigue funcionando exactamente como hoy, con revalidación al navegar. Realtime es una mejora aditiva, nunca
una dependencia. El estado de error se loguea con `console.error`; no se muestra al usuario.

`router.refresh()` puede fallar si el servidor está caído: eso ya lo cubre el `error.tsx` que existe.

## Verificación

El repo no tiene test runner. Contra una pareja desechable **con sus dos miembros** (esta feature necesita dos
perfiles reales, no uno), en dos contextos de navegador:

1. **La feature:** A pone un ánimo en `/comunicacion` → B lo ve **sin navegar**.
2. **El debounce:** A borra una cita con gastos → B se refresca **una vez**, no seis. Se cuenta instrumentando
   `router.refresh` desde el test.
3. **La prueba de seguridad:** una **tercera** pareja, en otro contexto, **no recibe nada** de las otras dos. Si
   la policy está mal escrita, esto lo caza y nada más lo caza.
4. **La reconexión:** cortar la red del navegador de B (`context.setOffline(true)`), mutar en A, reconectar → B
   se pone al día solo, sin tocar nada.
5. `NODE_OPTIONS=--use-system-ca corepack pnpm build` verde.

Los casos 1 y 3 son inseparables: una policy que deje pasar a todo el mundo (`using (true)`) pasaría el 1 y
fallaría el 3. Sin el 3, no se ha probado nada.

## Riesgos

- **`realtime.send()` desde un trigger es la parte con menos control.** La función existe en el proyecto, pero
  que emita correctamente a un canal privado hay que **verificarlo en vivo**, no asumirlo. Si no funciona, la
  alternativa documentada es `realtime.broadcast_changes()`, y eso cambia la migración.
- **Es una migración de esquema**, la primera desde el mediador. Reversible, y el rollback se escribe con ella.
- **Cada mutación hace trabajo extra en la BD**: un `realtime.send()` por fila cambiada. Con dos usuarios es
  ruido. La cascada de borrar una cita es el peor caso (1 + N gastos).
- **Un `router.refresh()` por evento es más caro que parchear estado en el cliente.** Es el precio de no tener
  estado en el cliente, y es el correcto para esta app: cualquier otra cosa exigiría duplicar en el navegador la
  lógica que hoy vive en los Server Components.
- **La policy usa `public.get_my_couple_id()`**, que hace una consulta a `profiles` por cada evaluación. Realtime
  la evalúa al suscribirse, no por mensaje, así que el coste es por conexión.
