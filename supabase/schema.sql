-- Datenbank-Schema des Wochenplaners (Stand: so in Supabase angelegt).
-- Zugriff: nur angemeldete Nutzer, deren E-Mail in public.members steht.

create table public.members (email text primary key, person_id text not null);
create table public.people (id text primary key, name text not null, sort int not null default 0);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  color text not null default '#5b8def',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  person_id text not null references public.people(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  date date not null,
  start_min int not null check (start_min between 0 and 1439),   -- Minuten ab Mitternacht
  end_min int not null check (end_min between 1 and 1440),
  note text not null default '' check (char_length(note) <= 80),
  updated_at timestamptz not null default now(),
  check (end_min > start_min)
);

create schema private;
create function private.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members m where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;

alter table public.members enable row level security;
alter table public.people enable row level security;
alter table public.categories enable row level security;
alter table public.blocks enable row level security;
create policy "members read own" on public.members for select to authenticated using ((select private.is_member()));
create policy "people read" on public.people for select to authenticated using ((select private.is_member()));
create policy "people update" on public.people for update to authenticated using ((select private.is_member())) with check ((select private.is_member()));
create policy "categories all" on public.categories for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));
create policy "blocks all" on public.blocks for all to authenticated using ((select private.is_member())) with check ((select private.is_member()));

alter publication supabase_realtime add table public.people, public.categories, public.blocks;

-- Zugang freischalten:
-- insert into public.members (email, person_id) values ('...', 'daniel'), ('...', 'emily');
