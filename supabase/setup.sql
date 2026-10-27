-- Run once in your private Supabase project's SQL editor. No user data is seeded.
create table if not exists public.calendar_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 1 check (version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
);
alter table public.calendar_snapshots enable row level security;
revoke all on public.calendar_snapshots from anon;
revoke all on public.calendar_snapshots from authenticated;
grant select, insert, update on public.calendar_snapshots to authenticated;
create policy "Read own calendar" on public.calendar_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own calendar" on public.calendar_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own calendar" on public.calendar_snapshots
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
