# Master Fixtures Model

PaperPunter should use shared fixture data.

The organiser should not manually enter fixtures for their private competition.

Admin/platform loads official fixtures once for a league and season.

Example:

Sport: Rugby Union  
League: NPC  
Season: 2026  
Fixtures: all NPC games

A user then creates:

Dave's Office NPC Comp

That competition links to the NPC 2026 fixture set.

The organiser gets:
- all rounds
- all fixtures
- lockout times
- picks pages
- leaderboards

without manual fixture setup.

## Core Principle

Fixture data belongs to the platform.

Private competitions belong to users.

## Correct Flow

1. Admin creates sport/league/season
2. Admin loads rounds and fixtures
3. User creates a competition from a season
4. System links competition to the selected season
5. Users make picks against shared fixtures
6. Results are entered once at source fixture level
7. All competitions using that fixture set can score automatically

## Tables Needed

- sports
- leagues
- seasons
- source_rounds
- source_fixtures
- competitions
- competition_members
- picks
- leaderboard_entries

## What Changes

Competitions should not own fixtures directly.

Rounds and fixtures should belong to a season or fixture set.

Competitions should link to a season.

Picks should link to:
- competition_id
- competition_member_id
- source_fixture_id

## Why This Matters

This supports the core promise:

“Office kudos. Zero admin.”

The organiser should not be manually creating fixtures.

PaperPunter handles the boring setup.