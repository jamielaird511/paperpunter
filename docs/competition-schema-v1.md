# Competition Schema V1

## Purpose

This document defines the first practical competition schema for PaperPunter V2.

The goal is to support a simple, private tipping competition where:

- a user creates a competition
- other users join
- fixtures are added
- users make picks
- results are entered
- leaderboards update

This is the first real product spine.

Keep it simple.
Keep it competition-centred.
Do not overbuild.

---

# Core Rule

Everything important should connect back to:

```text
competition_id
```

Competitions are the centre of the platform.

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

### Notes

- `created_by` is the owner/creator.
- `invite_code` allows users to join without manual admin.
- `slug` will be used for friendly URLs later.
- `sport_code` keeps MVP simple without needing full sports/leagues tables immediately.
- `member_limit` supports the initial free tier of up to 10 users.

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

# rounds

Represents a round, week, or picking period inside a competition.

Examples:
- Round 1
- Round 2
- Week 12
- Quarter Finals

### Fields

```text
id uuid primary key
competition_id uuid references competitions(id)
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

For MVP:
- use `open` for active rounds
- use `completed` once results are final

---

# fixtures

Represents one match/game inside a round.

Examples:
- Blues vs Crusaders
- Warriors vs Broncos
- Brazil vs France

### Fields

```text
id uuid primary key
competition_id uuid references competitions(id)
round_id uuid references rounds(id)
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

---

### Notes

For MVP, teams can be stored as plain text.

Do not create a full `teams` table yet unless clearly needed.

This keeps fixture creation and testing simple.

---

# picks

Represents a member’s pick for a fixture.

### Fields

```text
id uuid primary key
competition_id uuid references competitions(id)
fixture_id uuid references fixtures(id)
competition_member_id uuid references competition_members(id)
selected_winner text not null
points_awarded integer default 0
created_at timestamptz
updated_at timestamptz
```

### selected_winner values

```text
home
away
draw
```

### Constraints

Recommended:

```text
unique(fixture_id, competition_member_id)
```

This ensures one pick per member per fixture.

---

### Notes

For MVP:
- picks can be edited before fixture lock
- picks are winner-only initially
- margin bands can come later

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

## 1. Create Competition

Authenticated user creates a competition.

System:
- creates `competitions` row
- generates invite code
- creates owner row in `competition_members`
- creates leaderboard row for owner

---

## 2. Join Competition

User enters invite code or follows invite link.

System:
- finds competition
- checks member limit
- creates `competition_members` row
- creates leaderboard row

---

## 3. Add Round

Owner creates a round.

System:
- creates `rounds` row
- optionally sets lock time

---

## 4. Add Fixtures

Owner adds fixtures manually.

System:
- creates fixture rows attached to competition and round

---

## 5. Make Picks

Member submits picks.

System:
- creates or updates picks
- enforces one pick per member per fixture
- blocks picks after lock

---

## 6. Enter Results

Owner enters final scores.

System:
- updates fixture result fields
- sets fixture status to completed
- calculates winner

---

## 7. Update Leaderboard

System:
- calculates pick points
- updates `picks.points_awarded`
- updates `leaderboard_entries`

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

## rounds and fixtures

Users can:
- read rounds/fixtures for competitions they belong to

Owners/admins can:
- create/update rounds and fixtures

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
- sports API ingestion
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
- no Gazza dependency in core tables

The schema should support the boring foundation first.

Personality comes later.