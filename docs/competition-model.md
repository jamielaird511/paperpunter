# Competition Model

## Overview

Competitions are the core unit of the PaperPunter platform.

Everything in the system exists to support competitions:
- fixtures
- picks
- leaderboards
- scoring
- reminders
- Gazza emails
- memberships

A competition should be easy to create, easy to manage, and require minimal ongoing admin effort.

---

# Competition Lifecycle

## 1. Competition Creation

An organiser creates a competition by:
- choosing a competition template
- selecting a sport
- selecting a league/season (optional initially)
- entering a competition name
- choosing visibility settings
- inviting members

The setup flow should feel lightweight and mobile-friendly.

---

## 2. Competition Active State

Once fixtures are available:
- members can submit picks
- reminders can be sent
- scores are automatically calculated
- leaderboards update automatically
- Gazza content can be generated

The organiser should not need to manually manage scoring or standings.

---

## 3. Competition Completion

A competition becomes completed when:
- all fixtures are finished
- final standings are locked
- winner is declared

Historical competitions should remain viewable.

---

# Competition Templates

Competition templates define how a competition works.

Templates control:
- pick types
- scoring rules
- leaderboard logic
- fixture behaviour

Templates should be reusable across multiple sports.

---

## Initial V2 Templates

### 1. Standard Fixture Tipping

Users pick:
- home team
- away team
- draw (if enabled)

Points are awarded for:
- correct winner/result

---

### 2. Margin Tipping

Users pick:
- winner
- margin band

Example:
- 1-12
- 13+

Points are awarded for:
- correct winner
- correct margin band

---

### 3. Tournament Predictions

Users predict:
- tournament winner
- finalists
- semi-finalists
- top scorer
- total goals/points

Each prediction type has configurable point values.

The available prediction types should remain opinionated and controlled by the platform.

---

# Competition Visibility

Competitions can have three visibility modes.

---

## Private

- only invited users can access
- not searchable
- requires invitation

---

## Unlisted

- accessible via direct link
- not publicly searchable

---

## Public

- visible publicly
- can appear in future discovery features

---

# Competition Roles

## Organiser

The organiser:
- creates the competition
- manages fixtures
- invites/removes members
- controls settings
- enters results if required

The organiser is the primary customer of PaperPunter.

---

## Member

Members can:
- join competitions
- make picks
- view standings
- receive emails/reminders

Members cannot modify competition settings.

---

# Membership Limits

Free competitions will initially support:
- up to 10 members

Future premium plans may support:
- larger competitions
- enhanced features
- advanced engagement tools

---

# Seasons and Leagues

The platform structure should support:

Sport
→ League
→ Season
→ Competition

Examples:

Rugby Union
→ Super Rugby Pacific
→ 2026 Season
→ Jamie's Office Comp

Football
→ FIFA World Cup
→ 2026 Tournament
→ ChatGPT Ballers

Competitions should remain independent from official leagues where possible.

---

# Fixtures

Fixtures are attached to competitions.

Fixtures may initially be:
- manually entered
- CSV imported
- bulk uploaded

Future versions may support automated sports APIs.

The platform architecture should support future automation without requiring redesign.

---

# Picks

Each member can submit picks for fixtures.

Picks should support:
- editing before lockout
- mobile-first UX
- simple interaction
- quick weekly completion

Lockout occurs automatically based on fixture start time.

---

# Scoring

Scoring should be driven by template configuration rather than hardcoded logic.

Competition scoring must:
- support reusable rules
- support multiple competition types
- avoid sport-specific hardcoding
- remain simple to understand

The scoring engine should exist independently from frontend routes and UI.

---

# Leaderboards

Leaderboards should:
- update automatically
- support ties
- support weekly and overall standings
- be mobile-friendly
- be easy to scan quickly

The leaderboard is one of the core engagement features of the platform.

---

# Notifications and Emails

PaperPunter should automate engagement wherever possible.

Examples:
- weekly reminders
- round summaries
- leaderboard updates
- lockout reminders

These should reduce organiser workload.

---

# Gazza Layer

Gazza exists as an engagement layer on top of competitions.

Gazza may:
- generate weekly wrap-ups
- create funny commentary
- highlight bad picks
- generate predictions
- send reminder emails

Gazza should not control:
- scoring logic
- fixtures
- core competition state

Gazza reads competition data but does not own competition infrastructure.

---

# Product Direction

The competition system should prioritise:
- simplicity
- low organiser effort
- social engagement
- mobile-first interaction
- reusable templates
- minimal admin burden

The goal is not maximum flexibility.

The goal is:
“Fun competitions that are incredibly easy to run.”