# Database Schema V2

## Overview

This document defines the planned clean database model for PaperPunter V2.

The database should support:
- global user accounts
- multiple competitions
- reusable competition templates
- **shared platform fixture sets** (master fixtures model)
- fixture tipping
- tournament predictions later
- scoring configuration
- public/private/unlisted competitions
- organiser/member roles
- Gazza engagement features later

The core rule is:

> Everything revolves around `competition_id`.

Fixture data is separate: rounds and fixtures belong to a **season** (platform data). Competitions **link to** a season and inherit its fixture set. See [master-fixtures-model.md](./master-fixtures-model.md).

---

# Core Design Rules

## 1. Competition-centred architecture

Competitions are the atomic unit of the platform.

Most major records should link back to:

```text
competition_id
```

Fixture data (`source_rounds`, `source_fixtures`) links to `season_id` instead. Competitions connect to fixture data via `competitions.season_id`.

---

## 2. No hardcoded competition logic

Scoring, pick types, and competition behaviour should come from:
- competition templates
- scoring configuration
- reusable scoring modules

Not from route-specific hardcoding.

---

## 3. Sport and competition type are separate

Sport describes presentation and fixture context.

Competition template describes behaviour.

Example:

```text
Sport: Rugby Union
Template: Margin Tipping
```

```text
Sport: Football
Template: Standard Fixture Tipping
```

---

# Proposed Tables

## users / profiles

Supabase Auth handles authentication.

A `profiles` table stores public user details.

### profiles

```text
id uuid primary key references auth.users(id)
display_name text
email text
avatar_url text
created_at timestamptz
updated_at timestamptz
```

Purpose:
- store global user identity
- support one account across many competitions

---

## sports

Stores high-level sports.

### sports

```text
id uuid primary key
name text not null
slug text unique not null
created_at timestamptz
```

Examples:
- Rugby Union
- Football
- Rugby League
- NFL
- Cricket

---

## leagues

Stores leagues or tournaments within a sport.

### leagues

```text
id uuid primary key
sport_id uuid references sports(id)
name text not null
slug text not null
created_at timestamptz
```

Examples:
- Super Rugby Pacific
- FIFA World Cup
- NPC
- NRL
- NFL

---

## seasons

Stores season/tournament periods.

### seasons

```text
id uuid primary key
league_id uuid references leagues(id)
name text not null
year integer
starts_at date
ends_at date
created_at timestamptz
```

Examples:
- 2026 Season
- 2026 FIFA World Cup
- 2027 Season

Purpose:
- the fixture set that competitions link to
- admin loads rounds and fixtures once per season
- many private competitions can share the same season

---

## source_rounds

Stores rounds/weeks within a season. Platform admin manages these.

### source_rounds

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

### status values

```text
upcoming
open
locked
completed
cancelled
```

Purpose:
- picking periods belong to the season, not to individual competitions
- lock times apply across all comps using that season

---

## source_fixtures

Stores matches/games within a source round. Platform admin manages these.

### source_fixtures

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

Purpose:
- shared fixture data loaded once by platform/admin
- results entered once at source level
- all competitions linked to the season score from the same results

For MVP, teams can remain plain text. A `teams` table is optional.

---

## competition_templates

Defines reusable competition formats.

### competition_templates

```text
id uuid primary key
name text not null
slug text unique not null
description text
template_type text not null
default_config jsonb not null
is_active boolean default true
created_at timestamptz
```

Example template types:
- standard_fixture_tipping
- margin_tipping
- tournament_predictions

Purpose:
- separate competition behaviour from sport
- avoid hardcoded World Cup/Super Rugby logic

---

## competitions

Stores each user-created competition.

### competitions

```text
id uuid primary key
season_id uuid references seasons(id)
template_id uuid references competition_templates(id)
owner_user_id uuid references profiles(id)

name text not null
slug text not null
description text

visibility text not null
status text not null

config jsonb not null

member_limit integer default 10

created_at timestamptz
updated_at timestamptz
```

### visibility values

```text
private
unlisted
public
```

### status values

```text
draft
active
completed
archived
```

### config examples

```json
{
  "allowDraw": false,
  "lockPicksAtKickoff": true,
  "marginBands": ["1-12", "13+"],
  "points": {
    "correctWinner": 5,
    "correctMarginBand": 2
  }
}
```

Purpose:
- central record for each competition
- links to a season for fixture data via `season_id`
- stores settings/config for scoring and behaviour

Competition owners do **not** create fixtures. They select a season when creating a comp.

---

## competition_members

Links users to competitions.

### competition_members

```text
id uuid primary key
competition_id uuid references competitions(id)
user_id uuid references profiles(id)

role text not null
display_name text
status text not null

joined_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### role values

```text
organiser
member
viewer
```

### status values

```text
invited
active
removed
left
```

Purpose:
- allow one global user to join many competitions
- allow per-competition display names
- support organiser/member permissions

---

## invites

Stores competition invitations.

### invites

```text
id uuid primary key
competition_id uuid references competitions(id)
invited_by_user_id uuid references profiles(id)

email text
invite_token text unique not null
status text not null

expires_at timestamptz
accepted_at timestamptz
created_at timestamptz
```

### status values

```text
pending
accepted
expired
revoked
```

Purpose:
- simple invite links
- easy onboarding
- support email invites later

---

## teams

Stores teams/participants in source fixtures (optional for MVP).

### teams

```text
id uuid primary key
sport_id uuid references sports(id)

name text not null
short_name text
slug text
logo_url text

created_at timestamptz
```

Examples:
- Crusaders
- Blues
- France
- Brazil
- Chiefs

---

## source_fixture_results

Stores results for source fixtures (optional separate table if results are not stored inline on `source_fixtures`).

### source_fixture_results

```text
id uuid primary key
source_fixture_id uuid references source_fixtures(id)

home_score integer
away_score integer
winner text
is_draw boolean default false

result_status text not null

entered_by_user_id uuid references profiles(id)
created_at timestamptz
updated_at timestamptz
```

### result_status values

```text
draft
confirmed
corrected
void
```

Purpose:
- separate fixtures from results if needed
- allow corrections
- platform admin enters results once; all linked competitions score automatically

For MVP, result fields on `source_fixtures` may be sufficient without a separate table.

---

## Deprecated: competition-owned fixtures

> **Deprecated.** Earlier drafts placed `fixtures` and `fixture_results` directly on `competition_id`. That model is replaced by `source_fixtures` on `season_id`. Do not build new features against competition-owned fixtures.

### fixtures (deprecated)

```text
id uuid primary key
competition_id uuid references competitions(id)  -- deprecated
home_team_id uuid references teams(id)
away_team_id uuid references teams(id)
round_name text
starts_at timestamptz
...
```

### fixture_results (deprecated)

```text
id uuid primary key
fixture_id uuid references fixtures(id)  -- deprecated: use source_fixture_id
...
```

---

## picks

Stores member picks for source fixtures within a competition.

### picks

```text
id uuid primary key
competition_id uuid references competitions(id)
source_fixture_id uuid references source_fixtures(id)
member_id uuid references competition_members(id)

selected_team_id uuid references teams(id)
selected_result text
selected_margin_band text

locked_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### selected_result examples

```text
home
away
draw
```

Purpose:
- one member pick per source fixture per competition
- references shared platform fixture data plus competition scope
- supports standard result tipping and margin tipping
- should have unique constraint on `source_fixture_id` + `member_id`

---

## pick_scores

Stores calculated scores for picks.

### pick_scores

```text
id uuid primary key
pick_id uuid references picks(id)
competition_id uuid references competitions(id)
source_fixture_id uuid references source_fixtures(id)
member_id uuid references competition_members(id)

points_awarded integer not null
score_breakdown jsonb

calculated_at timestamptz
```

### score_breakdown example

```json
{
  "correctWinner": 5,
  "correctMarginBand": 2,
  "total": 7
}
```

Purpose:
- avoid recalculating everything every page load
- make leaderboard generation easier
- allow transparent scoring breakdowns

---

## leaderboard_snapshots

Stores calculated leaderboard states.

### leaderboard_snapshots

```text
id uuid primary key
competition_id uuid references competitions(id)

scope text not null
scope_value text

standings jsonb not null

calculated_at timestamptz
created_at timestamptz
```

### scope examples

```text
overall
round
week
```

Purpose:
- fast leaderboard reads
- historical weekly standings
- support Gazza summaries later

---

# Tournament Prediction Tables

These are not required for the first MVP slice, but the schema should allow them later.

## prediction_categories

Defines allowed tournament prediction types.

### prediction_categories

```text
id uuid primary key
template_id uuid references competition_templates(id)

name text not null
slug text not null
description text

default_points integer not null
config jsonb

created_at timestamptz
```

Examples:
- tournament_winner
- semi_finalists
- top_try_scorer
- total_goals
- group_winners

---

## competition_prediction_settings

Stores enabled prediction categories and points for a competition.

### competition_prediction_settings

```text
id uuid primary key
competition_id uuid references competitions(id)
prediction_category_id uuid references prediction_categories(id)

points integer not null
is_enabled boolean default true

config jsonb

created_at timestamptz
updated_at timestamptz
```

Purpose:
- allow controlled customisation
- let organisers adjust points without creating arbitrary prediction types

---

## member_predictions

Stores member tournament predictions.

### member_predictions

```text
id uuid primary key
competition_id uuid references competitions(id)
member_id uuid references competition_members(id)
prediction_category_id uuid references prediction_categories(id)

prediction_value jsonb not null

locked_at timestamptz
created_at timestamptz
updated_at timestamptz
```

Purpose:
- support structured tournament picks later
- avoid hardcoded World Cup-only prediction logic

---

## prediction_scores

Stores calculated scores for tournament predictions.

### prediction_scores

```text
id uuid primary key
competition_id uuid references competitions(id)
member_prediction_id uuid references member_predictions(id)
member_id uuid references competition_members(id)

points_awarded integer not null
score_breakdown jsonb

calculated_at timestamptz
```

---

# Gazza Tables

Gazza should be added after the core competition engine works.

## gazza_personas

Stores available Gazza personalities.

### gazza_personas

```text
id uuid primary key
name text not null
slug text unique not null
description text
system_prompt text
is_active boolean default true
created_at timestamptz
```

---

## gazza_competition_settings

Stores Gazza settings for a competition.

### gazza_competition_settings

```text
id uuid primary key
competition_id uuid references competitions(id)
persona_id uuid references gazza_personas(id)

enabled boolean default false
favourite_team_id uuid references teams(id)

email_frequency text
tone_config jsonb

created_at timestamptz
updated_at timestamptz
```

---

## gazza_email_runs

Stores generated Gazza emails.

### gazza_email_runs

```text
id uuid primary key
competition_id uuid references competitions(id)

email_type text not null
status text not null

subject text
body text

generated_at timestamptz
reviewed_at timestamptz
sent_at timestamptz

created_at timestamptz
```

### email_type examples

```text
weekly_wrap
pick_reminder
round_preview
final_wrap
```

### status values

```text
draft
approved
sent
failed
cancelled
```

Purpose:
- generate draft first
- allow organiser review
- enable auto-send later

---

# Important Constraints

## Unique constraints

Recommended:

```text
competitions: unique(owner_user_id, slug)
competition_members: unique(competition_id, user_id)
picks: unique(source_fixture_id, member_id)
source_fixture_results: unique(source_fixture_id)
invites: unique(invite_token)
```

---

# MVP Tables Required First

For the first working slice, only these tables are essential:

```text
profiles
sports
leagues
seasons
source_rounds
source_fixtures
competition_templates
competitions
competition_members
invites
picks
pick_scores
leaderboard_snapshots
```

Optional for MVP (can defer):
- `teams` (plain text on source_fixtures is fine initially)
- `source_fixture_results` (inline results on source_fixtures may suffice)

Do not build Gazza or tournament prediction tables until the fixture tipping flow is working.

---

# First Vertical Slice

The first build should prove:

1. Admin loads sport/league/season with source rounds and fixtures
2. User signs up/logs in
3. User creates a competition linked to a season
4. User invites members
5. Members make picks against shared source fixtures
6. Admin enters results once on source fixtures
7. Scores calculate across linked competitions
8. Leaderboard updates

Once this works, PaperPunter V2 has a solid foundation.

Organisers should never need to manually add fixtures or enter results per competition.

---

# Architecture Warning

Do not allow these mistakes from V1 to return:

- hardcoded scoring inside pages or API routes
- World Cup-specific logic in the core model
- duplicate authentication systems
- competition scoping bugs
- route-specific business rules
- Gazza controlling core state
- organiser-managed fixture entry (fixtures are platform data)
- competition-owned fixture tables for new features
- excessive customisation before the core product works

The database should support a simple product first, then expand carefully.