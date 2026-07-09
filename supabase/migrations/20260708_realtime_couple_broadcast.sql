-- Realtime: every write to a shared table nudges that couple's private channel.
-- The client does not read the payload; it just refetches. See
-- docs/superpowers/specs/2026-07-08-realtime-design.md
--
-- Why a trigger and not Postgres Changes: RLS is not applied to DELETE in logical
-- replication (the WAL old-record carries only the primary key), so every couple's
-- browser would be woken by every other couple's delete. A trigger sees the whole
-- OLD row, including couple_id.

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
  if tg_op = 'DELETE' then
    cid := old.couple_id;
  else
    cid := new.couple_id;
  end if;

  if cid is not null then
    perform realtime.send(
      pg_catalog.jsonb_build_object('tabla', tg_table_name, 'op', tg_op, 'actor', auth.uid()),
      'cambio',
      'couple:' || cid::text,
      true  -- private channel
    );
  end if;

  return null;  -- AFTER trigger: the return value is ignored
end;
$$;

create trigger notify_couple_change_ai_messages
  after insert or update or delete on public.ai_messages
  for each row execute function public.notify_couple_change();

create trigger notify_couple_change_moods
  after insert or update or delete on public.moods
  for each row execute function public.notify_couple_change();

create trigger notify_couple_change_events
  after insert or update or delete on public.events
  for each row execute function public.notify_couple_change();

create trigger notify_couple_change_expenses
  after insert or update or delete on public.expenses
  for each row execute function public.notify_couple_change();

create trigger notify_couple_change_budgets
  after insert or update or delete on public.budgets
  for each row execute function public.notify_couple_change();

create trigger notify_couple_change_date_ideas
  after insert or update or delete on public.date_ideas
  for each row execute function public.notify_couple_change();

-- Without this policy private channels deny everyone: there is no realtime AND no
-- privacy leak. With it, exactly one couple can read its own topic. This policy IS
-- the access control for the feature.
create policy "couple listens to its own channel"
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and realtime.topic() = 'couple:' || public.get_my_couple_id()::text
  );

-- Rollback:
--   drop policy "couple listens to its own channel" on realtime.messages;
--   drop trigger notify_couple_change_date_ideas on public.date_ideas;
--   drop trigger notify_couple_change_budgets on public.budgets;
--   drop trigger notify_couple_change_expenses on public.expenses;
--   drop trigger notify_couple_change_events on public.events;
--   drop trigger notify_couple_change_moods on public.moods;
--   drop trigger notify_couple_change_ai_messages on public.ai_messages;
--   drop function public.notify_couple_change();
