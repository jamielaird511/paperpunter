-- Fix SELECT RLS on picks tables so saved picks load on competition pages.
--
-- Bug: Broken or duplicate SELECT policies (often copied from legacy world-cup
-- tables) referenced user_id / participant_id on public.picks, which only stores
-- competition_member_id. Those policies never matched, so authenticated reads
-- returned zero rows even though save_pick / insert policies still worked.
--
-- Expected access after this migration:
-- - Authenticated members: read only rows where they own competition_member_id.
-- - Competition owners/admins: read all picks in that competition (leaderboard/admin).
-- - service_role: bypasses RLS (no policy required).
-- - Legacy worldcup_* tables (if present): read own rows via user_id or participant_id.

-- ---------------------------------------------------------------------------
-- public.picks
-- ---------------------------------------------------------------------------

alter table public.picks enable row level security;

-- Drop broken, duplicate, or superseded SELECT policies (idempotent).
drop policy if exists "Competition members can read picks" on public.picks;
drop policy if exists "Members can read their own picks" on public.picks;
drop policy if exists "Users can read own picks" on public.picks;
drop policy if exists "Users can read their own picks" on public.picks;
drop policy if exists "Authenticated users can read picks" on public.picks;
drop policy if exists "Competition members can read own picks" on public.picks;
drop policy if exists "Members can read own picks" on public.picks;
drop policy if exists "picks_select_own" on public.picks;
drop policy if exists "picks_select_member" on public.picks;

-- Members load their saved picks via competition_member_id (see loadMemberPicks).
create policy "Members can read their own picks"
on public.picks
for select
to authenticated
using (public.owns_competition_member(competition_member_id));

-- Owners/admins can read every pick in competitions they manage.
create policy "Competition owners and admins can read picks"
on public.picks
for select
to authenticated
using (public.is_competition_owner_or_admin(competition_id));

-- INSERT/UPDATE policies from 002 are unchanged.

-- ---------------------------------------------------------------------------
-- Legacy world cup picks tables (only when deployed)
-- ---------------------------------------------------------------------------

do $worldcup$
declare
  t text;
  tables text[] := array['worldcup_picks', 'worldcup_competition_picks'];
  policy_names text[] := array[
    'Competition members can read picks',
    'Members can read their own picks',
    'Users can read own picks',
    'Users can read their own picks',
    'Authenticated users can read picks',
    'Participants can read their own picks',
    'Participants can read own picks',
    'worldcup_picks_select_own',
    'worldcup_competition_picks_select_own'
  ];
  p text;
  has_user_id boolean;
  has_participant_id boolean;
  has_participants_table boolean;
  using_expr text;
begin
  foreach t in array tables loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = t
        and c.relkind = 'r'
    ) then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    foreach p in array policy_names loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'user_id'
    ) into has_user_id;

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = t
        and column_name = 'participant_id'
    ) into has_participant_id;

    select exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'worldcup_participants'
        and c.relkind = 'r'
    ) into has_participants_table;

    using_expr := 'false';

    if has_user_id and has_participant_id and has_participants_table then
      using_expr := '(user_id = auth.uid()) or exists (
        select 1
        from public.worldcup_participants wp
        where wp.id = participant_id
          and wp.user_id = auth.uid()
      )';
    elsif has_user_id and has_participant_id then
      using_expr := '(user_id = auth.uid()) or (participant_id = auth.uid())';
    elsif has_user_id then
      using_expr := 'user_id = auth.uid()';
    elsif has_participant_id and has_participants_table then
      using_expr := 'exists (
        select 1
        from public.worldcup_participants wp
        where wp.id = participant_id
          and wp.user_id = auth.uid()
      )';
    elsif has_participant_id then
      using_expr := 'participant_id = auth.uid()';
    end if;

    if using_expr = 'false' then
      raise notice 'Skipping SELECT policy on public.% — no user_id/participant_id columns', t;
      continue;
    end if;

    execute format(
      'create policy %I on public.%I for select to authenticated using (%s)',
      'Participants can read their own picks',
      t,
      using_expr
    );
  end loop;
end
$worldcup$;
