-- Link picks to shared source fixtures (master fixtures model).
-- Keeps legacy fixture_id nullable for interim competition-owned fixtures.

alter table public.picks
  alter column fixture_id drop not null;

alter table public.picks
  add column source_fixture_id uuid references public.source_fixtures (id) on delete cascade;

create unique index picks_source_fixture_competition_member_idx
  on public.picks (source_fixture_id, competition_member_id)
  where source_fixture_id is not null;

create index picks_source_fixture_id_idx
  on public.picks (source_fixture_id);
