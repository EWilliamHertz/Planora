# Planora - PRD

## Overview
Modern scheduling/calendar/task planner combining Calendly + Google Calendar + collaborative task management. Built with React frontend, FastAPI backend, NeonDB (PostgreSQL).

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI, deployed to Vercel
- **Backend**: FastAPI (Python), deployed as Vercel Serverless Functions via `api/index.py`
- **Database**: NeonDB (PostgreSQL via asyncpg)
- **Auth**: Cookie + Bearer token (localStorage), Emergent Google OAuth

## Core Features (Implemented)
- User registration/login (email + Google OAuth)
- Token-based auth with localStorage persistence (fixes cross-origin cookie issues on Vercel)
- Calendar views: Month, Week, Day, Board (Kanban)
- Event CRUD with colors, recurrence, reminders, attendees
- Multi-day event spanning across calendar cells
- Team events with `team_id` field
- Task management with categories and Kanban view
- Availability scheduling + public booking links
- Google Calendar 2-way sync
- Calendar sharing with view/edit permissions
- Real-time collaboration via WebSockets
- Notification center system
- Email notifications via Resend
- Weekly email digest
- Stripe subscription plans (Free/Pro/Business)
- Analytics dashboard
- iCal export
- 3-step onboarding wizard
- PWA capabilities
- Animated empty states with helpful tips

## Bug Fixes Applied (March 2026)
1. **Notification endpoints crash**: Fixed `(await db_pool).acquire()` → `db_pool.acquire()` — asyncpg Pool is not awaitable
2. **EventCreate missing team_id**: Added `team_id` field to EventCreate/EventUpdate models and events table schema
3. **GET /api/events missing team events**: Updated query to include events from user's teams
4. **Vercel build failure**: Removed `emergentintegrations` from requirements.txt; made import conditional with `try/except`
5. **Missing config variables**: Added RESEND, Google, Stripe config variable declarations to server.py
6. **Session persistence**: Added DATABASE_URL env var for local dev; token-based auth via localStorage

## Database Schema
- users, user_sessions, events (with team_id), tasks, availability, bookings, booking_links, calendar_shares, teams, payment_transactions, user_preferences, notifications

## Key API Endpoints
- `/api/auth/*` — register, login, session, me, logout
- `/api/events` — CRUD + team events
- `/api/tasks` — CRUD with Kanban status
- `/api/teams/*` — CRUD + invite/remove members
- `/api/notifications/*` — list, unread count, mark read, delete
- `/api/plans`, `/api/subscribe`, `/api/webhook/stripe` — Stripe subscriptions
- `/api/user/preferences/digest`, `/api/digest/send` — email digest
- `/api/gcal/*` — Google Calendar sync
- `/api/calendar/share`, `/api/calendar/shares` — calendar sharing

## Backlog
- P2: Drag to resize events in week/day views
- P2: Smart scheduling suggestions based on analytics
- P2: Stripe integration on Vercel (requires native `stripe` package instead of emergentintegrations)
