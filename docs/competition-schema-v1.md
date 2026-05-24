# Competition Schema V1

## Purpose

This document defines the first practical competition schema for PaperPunter V2.

The goal is to support a simple, private tipping competition where:

- platform/admin loads fixture data once for a league and season
- a user creates a competition linked to that season
- other users join
- users make picks against shared fixtures
- results are entered once at source level
- leaderboards update across all comps using that fixture set

This is the first real product spine.

Keep it simple.
Keep it competition-centred.
Do not overbuild.

---

# Core Rule

Everything important in a **competition** should connect back to:

```text
competition_id
```

Competitions are the centre of the user-facing platform.

**Fixture data is different.** Rounds and fixtures belong to the platform (a season/fixture set), not to individual competitions. Competitions **link to** a season and inherit its rounds and fixtures.

See [master-fixtures-model.md](./master-fixtures-model.md) for the product rationale.

---

# Fixture Data Model

## Core Principle

Fixture data belongs to the platform. Private competitions belong to users.

The organiser should **not** manually enter fixtures for their private competition. Admin/platform loads official fixtures once; competition owners pick a season when creating a comp.

Example:

```text
Sport: Rugby Union
League: NPC
Season: 2026
→ all NPC 2026 rounds and fixtures (platform data)

User creates: Dave's Office NPC Comp
→ competition links to NPC 2026 season
→ picks, rounds, lockouts, and leaderboards work without manual fixture setup
```

## Correct Flow

1. Admin creates sport / league / season
2. Admin loads `source_rounds` and `source_fixtures`
3. User creates a competition from a season
4. System links `competition.season_id` to the selected season
5. Users make picks against shared source fixtures
6. Results are entered once at source fixture level
7. All competitions using that fixture set score automatically

---

# Existing Foundation

The following already exists.

---

## auth.users

Managed by Supabase Auth.

Purpose:
- login
- signup
- session handling
- authentication identity

---

## profiles

Application-level user identity.

Purpose:
- display names
- avatars later
- user-facing profile data

Profiles should extend `auth.users`, not replace it.

---

# Platform Fixture Tables

These tables hold shared fixture data. Only platform admins manage them. Competition owners do not create or edit these rows.

---

## sports

High-level sport classification.

```text
id uuid primary key
name text not null
slug text unique not null
created_at timestamptz
updated_at timestamptz
```

Examples: Rugby Union, NRL, AFL, Football

---

## leagues

A league or tournament within a sport.

```text
id uuid primary key
sport_id uuid references sports(id)
name text not null
slug text not null
created_at timestamptz
updated_at timestamptz
```

Examples: NPC, Super Rugby Pacific, FIFA World Cup

---

## seasons

A season or tournament period. This is the **fixture set** competitions link to.

```text
id uuid primary key
league_id uuid references leagues(id)
name text not null
year integer
starts_at date
ends_at date
status text not null
created_at timestamptz
updated_at timestamptz
```

Examples: NPC 2026, Super Rugby 2026, FIFA World Cup 2026

For MVP, admin creates seasons and loads fixture data before users can create comps for that season.

---

## source_rounds

A round, week, or picking period within a season.

```text
id uuid primary key
season_id uuid references seasons(id)
name text not null
round_number integer
lock_time timestamptz
status text not null
created_at timestamptz
updated_at timestamptz
```

Examples: Round 1, Week 12, Quarter Finals

### status values

```text
upcoming
open
locked
completed
cancelled
```

Rounds belong to the **season**, not to a competition.

---

## source_fixtures

One match/game within a source round.

```text
id uuid primary key
season_id uuid references seasons(id)
source_round_id uuid references source_rounds(id)
home_team text not null
away_team text not null
starts_at timestamptz
home_score integer
away_score integer
winner text
status text not null
created_at timestamptz
updated_at timestamptz
```

Examples: Blues vs Crusaders, Warriors vs Broncos

### winner values

```text
home
away
draw
```

### status values

```text
scheduled
locked
completed
cancelled
postponed
```

For MVP, teams can be stored as plain text. Do not create a full `teams` table unless clearly needed.

Results are entered once on `source_fixtures`. All competitions linked to that season inherit the result for scoring.

---

# MVP Competition Tables

## competitions

Represents one tipping competition.

Examples:
- Henderson Bros AFL Tipping
- Friday Punters NRL
- ChatGPT Ballers Super Rugby
- Family World Cup Picks

### Fields

```text
id uuid primary key
name text not null
slug text not null
season_id uuid references seasons(id) not null
sport_code text not null
season text
created_by uuid references profiles(id)
invite_code text unique not null
visibility text not null
status text not null
member_limit integer default 10
created_at timestamptz
updated_at timestamptz
```

### Notes

- `season_id` links the competition to a platform fixture set. This is how the comp gets rounds and fixtures.
- `sport_code` and `season` text fields may remain for display/backward compatibility during migration; `season_id` is the source of truth for fixture data.
- `created_by` is the owner/creator.
- `invite_code` allows users to join without manual admin.
- `slug` will be used for friendly URLs later.
- `member_limit` supports the initial free tier of up to 10 users.

Competitions do **not** own fixtures. They inherit fixture data through `season_id`.

### visibility values

```text
private
unlisted
public
```

For MVP, default to:

```text
private
```

---

### status values

```text
draft
active
completed
archived
```

For MVP, newly created competitions should start as:

```text
draft
```

---

### Notes (competitions)

- Competition creation requires selecting an available season (fixture set).
- The organiser does not add rounds or fixtures — those come from the linked season.

---

# competition_members

Represents users who belong to a competition.

A user can belong to many competitions.
A competition can have many users.

### Fields

```text
id uuid primary key
competition_id uuid references competitions(id)
user_id uuid references profiles(id)
role text not null
status text not null
joined_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### role values

```text
owner
admin
member
viewer
```

For MVP:
- creator becomes `owner`
- invited users become `member`

---

### status values

```text
invited
active
removed
left
```

For MVP:
- joined users should be `active`

---

### Constraints

Recommended:

```text
unique(competition_id, user_id)
```

This prevents duplicate membership records.

---

# picks

Represents a member's pick for a source fixture within a competition.

### Fields

```text
id uuid primary key
competition_id uuid references competitions(id)
source_fixture_id uuid references source_fixtures(id)
competition_member_id uuid references competition_members(id)
selected_winner text not null
points_awarded integer default 0
created_at timestamptz
updated_at timestamptz
```

Picks reference **shared** source fixtures plus the competition and member. The same `source_fixture_id` can appear in picks across many competitions that share the same season.

### selected_winner values

```text
home
away
draw
```

### Constraints

Recommended:

```text
unique(source_fixture_id, competition_member_id)
```

This ensures one pick per member per source fixture per competition.

---

### Notes

For MVP:
- picks can be edited before fixture lock
- picks are winner-only initially
- margin bands can come later
- fixture lock time comes from `source_rounds.lock_time` or `source_fixtures.starts_at` depending on comp config

---

# Deprecated: competition-owned rounds and fixtures

> **Deprecated.** The initial migration (`002_create_competition_core.sql`) created `rounds` and `fixtures` tables scoped to `competition_id`. This model is being replaced by the master fixtures model above.
>
> Do not build new features against competition-owned rounds/fixtures. Existing UI that lets owners manually add rounds/fixtures is interim only and will be removed.

### Legacy `rounds` (deprecated)

```text
id uuid primary key
competition_id uuid references competitions(id)  -- deprecated: use source_rounds.season_id
name text not null
round_number integer
lock_time timestamptz
status text not null
...
```

### Legacy `fixtures` (deprecated)

```text
id uuid primary key
competition_id uuid references competitions(id)  -- deprecated: use source_fixtures.season_id
round_id uuid references rounds(id)            -- deprecated: use source_fixtures.source_round_id
home_team text not null
away_team text not null
starts_at timestamptz
...
```

Legacy picks used `fixture_id` referencing competition-owned fixtures. Target model uses `source_fixture_id` as shown above.

---

# leaderboard_entries

Stores cached leaderboard rows for each competition.

### Fields

```text
id uuid primary key
competition_id uuid references competitions(id)
competition_member_id uuid references competition_members(id)
total_points integer default 0
correct_picks integer default 0
rank integer
updated_at timestamptz
```

### Constraints

Recommended:

```text
unique(competition_id, competition_member_id)
```

---

### Notes

Leaderboard entries are cached for fast reads.

For MVP, leaderboard updates can be recalculated after results are entered.

Do not overbuild live scoring yet.

---

# MVP Flow Supported By This Schema

## 1. Admin Loads Fixture Set

Platform admin creates sport, league, and season.

System:
- creates `sports`, `leagues`, `seasons` rows
- loads `source_rounds` and `source_fixtures` for that season
- sets lock times and kickoffs once

This happens once per league/season, not per competition.

---

## 2. Create Competition

Authenticated user creates a competition and selects a season (fixture set).

System:
- creates `competitions` row with `season_id`
- generates invite code
- creates owner row in `competition_members`
- creates leaderboard row for owner

The organiser does **not** add rounds or fixtures. They inherit from the linked season.

---

## 3. Join Competition

User enters invite code or follows invite link.

System:
- finds competition
- checks member limit
- creates `competition_members` row
- creates leaderboard row

---

## 4. View Rounds and Fixtures

Member opens picks or fixtures view.

System:
- reads `source_rounds` and `source_fixtures` via `competitions.season_id`
- shows shared fixture data to all members of the comp

No per-competition fixture setup required.

---

## 5. Make Picks

Member submits picks against source fixtures.

System:
- creates or updates picks with `source_fixture_id`
- enforces one pick per member per source fixture per competition
- blocks picks after lock

---

## 6. Enter Results

Platform admin (or automated import) enters final scores on source fixtures.

System:
- updates `source_fixtures` result fields
- sets source fixture status to completed
- calculates winner once at source level

Competition owners do **not** enter results per comp.

---

## 7. Update Leaderboard

System:
- calculates pick points from source fixture results
- updates `picks.points_awarded`
- updates `leaderboard_entries` per competition

All comps linked to the same season score from the same source results.

---

# RLS Direction

Initial RLS should be simple and safe.

---

## competitions

Users can:
- read competitions they are members of
- create competitions
- update competitions they own/admin

---

## competition_members

Users can:
- read members of competitions they belong to
- insert themselves when joining via invite code
- owners/admins can manage members later

---

## source_rounds and source_fixtures

Platform admins can:
- create/update source rounds and fixtures for a season

Competition members can:
- read source rounds/fixtures for seasons their competitions link to (via `competition.season_id`)

Competition owners/admins can:
- **not** create or edit source fixture data (deprecated: legacy competition-owned rounds/fixtures allowed insert during migration period only)

---

## picks

Users can:
- read picks in competitions they belong to
- create/update their own picks only

---

## leaderboard_entries

Users can:
- read leaderboard entries in competitions they belong to

System/admin logic can:
- update leaderboard entries

---

# Explicit V1 Non-Goals

Do NOT build yet:

- payments
- public competition discovery
- advanced scoring builders
- margin tipping
- tournament predictions
- fantasy sports mechanics
- comments/chat
- AI-generated Gazza emails
- sports API ingestion at scale
- complex team database
- custom branding
- organisation/workspace model

---

# Architecture Warnings

Avoid repeating V1 issues:

- no hardcoded World Cup logic
- no sport-specific route logic
- no duplicate auth system
- no competition state stored only in UI
- no scoring logic buried inside page components
- no organiser-managed fixture entry (fixtures are platform data)
- no Gazza dependency in core tables

The schema should support the boring foundation first.

Personality comes later.