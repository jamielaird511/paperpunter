-- Master fixtures model — shared platform fixture data.
-- Competitions link to seasons; rounds and fixtures belong to the platform.
--
-- Interim tables from 002 (competition-owned rounds/fixtures) remain in place
-- until app code migrates to source_rounds / source_fixtures.

comment on table public.rounds is
  'Interim: competition-owned rounds. Target model uses source_rounds. Do not extend.';

comment on table public.fixtures is
  'Interim: competition-owned fixtures. Target model uses source_fixtures. Do not extend.';

-- ---------------------------------------------------------------------------
-- Platform fixture tables
-- ---------------------------------------------------------------------------

create table public.sports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports (id) on delete restrict,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sport_id, slug)
);

create index leagues_sport_id_idx on public.leagues (sport_id);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete restrict,
  name text not null,
  year integer,
  starts_at date,
  ends_at date,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_status_check
    check (status in ('draft', 'active', 'completed', 'archived'))
);

create index seasons_league_id_idx on public.seasons (league_id);

create table public.source_rounds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  name text not null,
  round_number integer,
  lock_time timestamptz,
  status text not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_rounds_status_check
    check (status in ('upcoming', 'open', 'locked', 'completed', 'cancelled'))
);

create index source_rounds_season_id_idx on public.source_rounds (season_id);

create table public.source_fixtures (
  id uuid primary key default gen_random_uuid(),
  source_round_id uuid not null references public.source_rounds (id) on delete cascade,
  home_team text not null,
  away_team text not null,
  starts_at timestamptz,
  status text not null default 'scheduled',
  winning_side text,
  home_score integer,
  away_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_fixtures_winning_side_check
    check (winning_side is null or winning_side in ('home', 'away', 'draw')),
  constraint source_fixtures_status_check
    check (status in ('scheduled', 'locked', 'completed', 'cancelled', 'postponed'))
);

create index source_fixtures_source_round_id_idx
  on public.source_fixtures (source_round_id);

create index source_fixtures_starts_at_idx
  on public.source_fixtures (starts_at);

-- ---------------------------------------------------------------------------
-- Link competitions to platform fixture sets
-- ---------------------------------------------------------------------------

alter table public.competitions
  add column season_id uuid references public.seasons (id) on delete restrict;

create index competitions_season_id_idx on public.competitions (season_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger sports_set_updated_at
before update on public.sports
for each row
execute function public.set_updated_at();

create trigger leagues_set_updated_at
before update on public.leagues
for each row
execute function public.set_updated_at();

create trigger seasons_set_updated_at
before update on public.seasons
for each row
execute function public.set_updated_at();

create trigger source_rounds_set_updated_at
before update on public.source_rounds
for each row
execute function public.set_updated_at();

create trigger source_fixtures_set_updated_at
before update on public.source_fixtures
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- Authenticated users can read platform fixture data.
-- No insert/update/delete policies for authenticated users — writes use
-- service role (bypasses RLS) until admin workflows are built.

alter table public.sports enable row level security;
alter table public.leagues enable row level security;
alter table public.seasons enable row level security;
alter table public.source_rounds enable row level security;
alter table public.source_fixtures enable row level security;

create policy "Authenticated users can read sports"
on public.sports
for select
to authenticated
using (true);

create policy "Authenticated users can read leagues"
on public.leagues
for select
to authenticated
using (true);

create policy "Authenticated users can read seasons"
on public.seasons
for select
to authenticated
using (true);

create policy "Authenticated users can read source rounds"
on public.source_rounds
for select
to authenticated
using (true);

create policy "Authenticated users can read source fixtures"
on public.source_fixtures
for select
to authenticated
using (true);
