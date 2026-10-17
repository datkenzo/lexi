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

-- 5. Review activity for the streak: one row per day, per person.
--    `data` is { "by": { "<device>": cards reviewed } }. Devices add their counts together.
create table if not exists public.activity (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  day        text        not null,           -- the day on the device, as YYYY-MM-DD
  data       jsonb       not null,
  updated_at bigint      not null,           -- time of the change on the device (ms)
  synced_at  timestamptz not null default clock_timestamp(),  -- time the server received it
  primary key (user_id, day)
);

create index if not exists activity_user_synced on public.activity (user_id, synced_at);

create or replace function public.activity_stamp()
returns trigger
language plpgsql
as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists activity_stamp on public.activity;
create trigger activity_stamp
  before insert or update on public.activity
  for each row execute function public.activity_stamp();

alter table public.activity enable row level security;

drop policy if exists "own activity: read"   on public.activity;
drop policy if exists "own activity: add"    on public.activity;
drop policy if exists "own activity: change" on public.activity;
drop policy if exists "own activity: remove" on public.activity;

create policy "own activity: read" on public.activity
  for select to authenticated
  using (user_id = auth.uid() and public.lexi_allowed());

create policy "own activity: add" on public.activity
  for insert to authenticated
  with check (user_id = auth.uid() and public.lexi_allowed());

create policy "own activity: change" on public.activity
  for update to authenticated
  using (user_id = auth.uid() and public.lexi_allowed())
  with check (user_id = auth.uid() and public.lexi_allowed());

create policy "own activity: remove" on public.activity
  for delete to authenticated
  using (user_id = auth.uid() and public.lexi_allowed());

revoke all on public.activity from anon;
