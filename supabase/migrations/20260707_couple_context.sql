alter table public.profiles add column if not exists about text;

alter table public.couples add column if not exists location text;
alter table public.couples add column if not exists typical_budget numeric;
alter table public.couples add column if not exists together_since date;
alter table public.couples add column if not exists has_kids boolean;

drop policy if exists update_own_couple on public.couples;
create policy update_own_couple on public.couples
  for update using (id = public.get_my_couple_id());
