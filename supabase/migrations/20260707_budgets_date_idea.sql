alter table public.budgets
  add column if not exists date_idea_id uuid
  references public.date_ideas(id) on delete set null;
