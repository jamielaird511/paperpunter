-- Competition Schema V1 — core MVP tables.
-- Everything connects back to competition_id.

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger function
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  sport_code text not null,
  season text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  invite_code text unique not null,
  visibility text not null default 'private',
  status text not null default 'draft',
  member_limit integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competitions_visibility_check
    check (visibility in ('private', 'unlisted', 'public')),
  constraint competitions_status_check
    check (status in ('draft', 'active', 'completed', 'archived')),
  constraint competitions_member_limit_check
    check (member_limit > 0)
);

create index competitions_created_by_idx on public.competitions (created_by);

create table public.competition_members (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, user_id),
  constraint competition_members_role_check
    check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint competition_members_status_check
    check (status in ('invited', 'active', 'removed', 'left'))
);

create index competition_members_competition_id_idx
  on public.competition_members (competition_id);

create index competition_members_user_id_idx
  on public.competition_members (user_id);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  name text not null,
  round_number integer,
  lock_time timestamptz,
  status text not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rounds_status_check
    check (status in ('upcoming', 'open', 'locked', 'completed', 'cancelled'))
);

create index rounds_competition_id_idx on public.rounds (competition_id);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  round_id uuid not null references public.rounds (id) on delete cascade,
  home_team text not null,
  away_team text not null,
  starts_at timestamptz,
  home_score integer,
  away_score integer,
  winner text,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixtures_winner_check
    check (winner is null or winner in ('home', 'away', 'draw')),
  constraint fixtures_status_check
    check (status in ('scheduled', 'locked', 'completed', 'cancelled', 'postponed'))
);

create index fixtures_competition_id_idx on public.fixtures (competition_id);
create index fixtures_round_id_idx on public.fixtures (round_id);

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  competition_member_id uuid not null references public.competition_members (id) on delete cascade,
  selected_winner text not null,
  points_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, competition_member_id),
  constraint picks_selected_winner_check
    check (selected_winner in ('home', 'away', 'draw'))
);

create index picks_competition_id_idx on public.picks (competition_id);
create index picks_fixture_id_idx on public.picks (fixture_id);
create index picks_competition_member_id_idx on public.picks (competition_member_id);

create table public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  competition_member_id uuid not null references public.competition_members (id) on delete cascade,
  total_points integer not null default 0,
  correct_picks integer not null default 0,
  rank integer,
  updated_at timestamptz not null default now(),
  unique (competition_id, competition_member_id)
);

create index leaderboard_entries_competition_id_idx
  on public.leaderboard_entries (competition_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger competitions_set_updated_at
before update on public.competitions
for each row
execute function public.set_updated_at();

create trigger competition_members_set_updated_at
before update on public.competition_members
for each row
execute function public.set_updated_at();

create trigger rounds_set_updated_at
before update on public.rounds
for each row
execute function public.set_updated_at();

create trigger fixtures_set_updated_at
before update on public.fixtures
for each row
execute function public.set_updated_at();

create trigger picks_set_updated_at
before update on public.picks
for each row
execute function public.set_updated_at();

create trigger leaderboard_entries_set_updated_at
before update on public.leaderboard_entries
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------

create or replace function public.is_competition_member(p_competition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.competition_members cm
    where cm.competition_id = p_competition_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  );
$$;

create or replace function public.is_competition_owner_or_admin(p_competition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.competition_members cm
    where cm.competition_id = p_competition_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'admin')
      and cm.status = 'active'
  );
$$;

create or replace function public.owns_competition_member(p_competition_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.competition_members cm
    where cm.id = p_competition_member_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.competitions enable row level security;
alter table public.competition_members enable row level security;
alter table public.rounds enable row level security;
alter table public.fixtures enable row level security;
alter table public.picks enable row level security;
alter table public.leaderboard_entries enable row level security;

-- competitions
create policy "Competition members and creators can read competitions"
on public.competitions
for select
to authenticated
using (
  created_by = auth.uid()
  or public.is_competition_member(id)
);

create policy "Authenticated users can create competitions"
on public.competitions
for insert
to authenticated
with check (created_by = auth.uid());

create policy "Competition owners and admins can update competitions"
on public.competitions
for update
to authenticated
using (public.is_competition_owner_or_admin(id))
with check (public.is_competition_owner_or_admin(id));

-- competition_members
create policy "Competition members can read membership"
on public.competition_members
for select
to authenticated
using (public.is_competition_member(competition_id));

create policy "Users can join competitions or add themselves as owner"
on public.competition_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    role = 'member'
    or (
      role = 'owner'
      and exists (
        select 1
        from public.competitions c
        where c.id = competition_id
          and c.created_by = auth.uid()
      )
    )
  )
);

create policy "Competition owners and admins can update members"
on public.competition_members
for update
to authenticated
using (public.is_competition_owner_or_admin(competition_id))
with check (public.is_competition_owner_or_admin(competition_id));

-- rounds
create policy "Competition members can read rounds"
on public.rounds
for select
to authenticated
using (public.is_competition_member(competition_id));

create policy "Competition owners and admins can manage rounds"
on public.rounds
for insert
to authenticated
with check (public.is_competition_owner_or_admin(competition_id));

create policy "Competition owners and admins can update rounds"
on public.rounds
for update
to authenticated
using (public.is_competition_owner_or_admin(competition_id))
with check (public.is_competition_owner_or_admin(competition_id));

create policy "Competition owners and admins can delete rounds"
on public.rounds
for delete
to authenticated
using (public.is_competition_owner_or_admin(competition_id));

-- fixtures
create policy "Competition members can read fixtures"
on public.fixtures
for select
to authenticated
using (public.is_competition_member(competition_id));

create policy "Competition owners and admins can manage fixtures"
on public.fixtures
for insert
to authenticated
with check (public.is_competition_owner_or_admin(competition_id));

create policy "Competition owners and admins can update fixtures"
on public.fixtures
for update
to authenticated
using (public.is_competition_owner_or_admin(competition_id))
with check (public.is_competition_owner_or_admin(competition_id));

create policy "Competition owners and admins can delete fixtures"
on public.fixtures
for delete
to authenticated
using (public.is_competition_owner_or_admin(competition_id));

-- picks
create policy "Competition members can read picks"
on public.picks
for select
to authenticated
using (public.is_competition_member(competition_id));

create policy "Members can create their own picks"
on public.picks
for insert
to authenticated
with check (
  public.is_competition_member(competition_id)
  and public.owns_competition_member(competition_member_id)
);

create policy "Members can update their own picks"
on public.picks
for update
to authenticated
using (public.owns_competition_member(competition_member_id))
with check (public.owns_competition_member(competition_member_id));

-- leaderboard_entries
create policy "Competition members can read leaderboard entries"
on public.leaderboard_entries
for select
to authenticated
using (public.is_competition_member(competition_id));

create policy "Competition owners and admins can manage leaderboard entries"
on public.leaderboard_entries
for insert
to authenticated
with check (public.is_competition_owner_or_admin(competition_id));

create policy "Competition owners and admins can update leaderboard entries"
on public.leaderboard_entries
for update
to authenticated
using (public.is_competition_owner_or_admin(competition_id))
with check (public.is_competition_owner_or_admin(competition_id));

create policy "Competition owners and admins can delete leaderboard entries"
on public.leaderboard_entries
for delete
to authenticated
using (public.is_competition_owner_or_admin(competition_id));
