create table if not exists public.ai_messages (
  id         uuid primary key default gen_random_uuid(),
  couple_id  uuid not null references public.couples(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  kind       text not null default 'chat' check (kind in ('chat','summary')),
  content    text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_couple_created_idx
  on public.ai_messages (couple_id, created_at);

alter table public.ai_messages enable row level security;

create policy couple_select_ai_messages on public.ai_messages
  for select using (couple_id = public.get_my_couple_id());

create policy couple_insert_ai_messages on public.ai_messages
  for insert with check (couple_id = public.get_my_couple_id());
