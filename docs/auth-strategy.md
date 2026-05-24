# Auth Strategy

## Overview

PaperPunter V2 uses a single global authentication system.

All users:
- create one account
- can join many competitions
- can create competitions
- can participate across multiple sports and seasons

The platform should not support separate participant-only authentication systems.

---

# Authentication Provider

PaperPunter uses:
- Supabase Auth
- email/password authentication initially

Potential future additions:
- Google login
- Apple login

But email/password is the only required method for V2 MVP.

---

# Core Principles

## 1. One global identity

Users should have:
- one account
- one profile
- one login session

Competitions should not create isolated accounts.

---

## 2. Profiles extend auth.users

Supabase Auth handles authentication.

A `profiles` table stores:
- display_name
- avatar_url
- timestamps

The application should use:
- auth.users for authentication
- profiles for application-level identity

---

## 3. Keep auth simple initially

Avoid:
- role systems
- complex permissions
- custom auth providers
- participant-only auth
- auth abstractions

The initial goal is simply:
- sign up
- log in
- stay logged in
- log out

---

# Route Philosophy

Public routes:
- homepage
- join competition pages
- marketing pages

Authenticated routes:
- dashboard
- create competition
- account pages

Avoid excessive middleware complexity early.

---

# Session Strategy

Use standard Supabase session handling.

Do not create:
- parallel localStorage auth systems
- custom token handling
- duplicate session logic

Supabase should remain the source of truth.

---

# Security Philosophy

Initial focus:
- reliability
- simplicity
- maintainability

Advanced role/security systems can come later.

Do not over-engineer authentication during the MVP phase.

---

# Future Permissions

Future competition permissions may include:
- organiser
- member
- viewer

But these should exist at the competition level, not the authentication level.

Authentication and competition permissions are separate concerns.