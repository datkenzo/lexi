-- Lexi: database setup. Paste all of this into Supabase > SQL Editor and press Run.
-- Safe to run again: it replaces what it created before.

-- 1. Who may use Lexi. Put the Google email(s) you sign in with here.
create or replace function public.lexi_allowed()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'thisisdat098@gmail.com'
    -- , 'another.email@gmail.com'
  );
$$;

-- 2. One row per saved word, per person.
create table if not exists public.words (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  word       text        not null,
  data       jsonb,                          -- the saved word (meanings, status, my sentence, dates)
  deleted    boolean     not null default false,
  updated_at bigint      not null,           -- time of the change on the device (ms)
  synced_at  timestamptz not null default clock_timestamp(),  -- time the server received it
  primary key (user_id, word)
);

create index if not exists words_user_synced on public.words (user_id, synced_at);

-- 3. The server stamps synced_at on every write, so device clocks don't matter.
create or replace function public.words_stamp()
returns trigger
language plpgsql
as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists words_stamp on public.words;
create trigger words_stamp
  before insert or update on public.words
  for each row execute function public.words_stamp();

-- 4. Security: each person sees and changes only their own rows,
--    and only allowed emails get in at all. Enforced by the database itself.
alter table public.words enable row level security;

drop policy if exists "own words: read"   on public.words;
drop policy if exists "own words: add"    on public.words;
drop policy if exists "own words: change" on public.words;
drop policy if exists "own words: remove" on public.words;

create policy "own words: read" on public.words
  for select to authenticated
  using (user_id = auth.uid() and public.lexi_allowed());

create policy "own words: add" on public.words
  for insert to authenticated
  with check (user_id = auth.uid() and public.lexi_allowed());

create policy "own words: change" on public.words
  for update to authenticated
  using (user_id = auth.uid() and public.lexi_allowed())
  with check (user_id = auth.uid() and public.lexi_allowed());

create policy "own words: remove" on public.words
  for delete to authenticated
  using (user_id = auth.uid() and public.lexi_allowed());

-- Nobody who is signed out can touch the table.
revoke all on public.words from anon;
