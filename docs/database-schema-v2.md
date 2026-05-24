# Database Schema V2

## Overview

This document defines the planned clean database model for PaperPunter V2.

The database should support:
- global user accounts
- multiple competitions
- reusable competition templates
- fixture tipping
- tournament predictions later
- scoring configuration
- public/private/unlisted competitions
- organiser/member roles
- Gazza engagement features later

The core rule is:

> Everything revolves around `competition_id`.

---

# Core Design Rules

## 1. Competition-centred architecture

Competitions are the atomic unit of the platform.

Most major records should link back to:

```text
competition_id
```

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
- stores settings/config for scoring and behaviour

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

Stores teams/participants in fixtures.

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

## fixtures

Stores competition fixtures.

### fixtures

```text
id uuid primary key
competition_id uuid references competitions(id)

home_team_id uuid references teams(id)
away_team_id uuid references teams(id)

round_name text
starts_at timestamptz
venue text

status text not null

created_at timestamptz
updated_at timestamptz
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
- fixtures belong to competitions
- initially manually entered/imported
- future versions may sync from source fixtures

---

## fixture_results

Stores results for fixtures.

### fixture_results

```text
id uuid primary key
fixture_id uuid references fixtures(id)

home_score integer
away_score integer
winning_team_id uuid references teams(id)
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
- separate fixtures from results
- allow corrections
- keep result handling clean

---

## picks

Stores member picks for fixtures.

### picks

```text
id uuid primary key
competition_id uuid references competitions(id)
fixture_id uuid references fixtures(id)
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
- one member pick per fixture
- supports standard result tipping and margin tipping
- should have unique constraint on fixture_id + member_id

---

## pick_scores

Stores calculated scores for picks.

### pick_scores

```text
id uuid primary key
pick_id uuid references picks(id)
competition_id uuid references competitions(id)
fixture_id uuid references fixtures(id)
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
picks: unique(fixture_id, member_id)
fixture_results: unique(fixture_id)
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
competition_templates
competitions
competition_members
invites
teams
fixtures
fixture_results
picks
pick_scores
leaderboard_snapshots
```

Do not build Gazza or tournament prediction tables until the fixture tipping flow is working.

---

# First Vertical Slice

The first build should prove:

1. User signs up/logs in
2. User creates a competition
3. User adds/imports fixtures
4. User invites members
5. Members make picks
6. Organiser enters results
7. Scores calculate
8. Leaderboard updates

Once this works, PaperPunter V2 has a solid foundation.

---

# Architecture Warning

Do not allow these mistakes from V1 to return:

- hardcoded scoring inside pages or API routes
- World Cup-specific logic in the core model
- duplicate authentication systems
- competition scoping bugs
- route-specific business rules
- Gazza controlling core state
- excessive customisation before the core product works

The database should support a simple product first, then expand carefully.