# Planora - PRD

## Overview
Modern scheduling/calendar/task planner combining Calendly + Google Calendar + collaborative task management.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI (Python), Vercel Serverless Functions via `api/index.py`
- **Database**: NeonDB (PostgreSQL via asyncpg)
- **Deployment**: Vercel (frontend + backend together), Python 3.12 pinned via `.python-version`

## Environment Variables (Vercel)
- DATABASE_URL, RESEND_API_KEY, SENDER_EMAIL, FRONTEND_URL, REACT_APP_BACKEND_URL
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BACKEND_EXTERNAL_URL, CORS_ORIGINS

## Core Features (Implemented)
- User auth (email + Google OAuth) with token persistence (localStorage + Bearer header)
- Calendar views: Month, Week, Day, Kanban
- Day-click modal: click any day to see all events with edit/delete/create actions
- Event CRUD with colors, recurrence, reminders, attendees, team_id
- Multi-day event spanning across calendar cells
- Task management with categories and Kanban view
- Team workspaces with team events
- Availability scheduling + public booking links
- Google Calendar 2-way sync
- Calendar sharing (view/edit permissions)
- Notification center
- Email notifications via Resend
- Weekly email digest with toggle
- Analytics dashboard
- iCal export
- 3-step onboarding wizard
- Animated empty states

## Bug Fixes (March 25, 2026)
1. Notification endpoints: Fixed `(await db_pool).acquire()` → `db_pool.acquire()`
2. EventCreate missing `team_id`: Added field + migration
3. GET /api/events: Now returns team events user belongs to
4. Removed `emergentintegrations` dependency (breaks Vercel build)
5. Added missing config variables (RESEND, Google, etc.)
6. Vercel Python 3.12 pin: Added `.python-version` file to fix asyncpg C extension compilation error on Python 3.14
7. DayView: Fixed color mapping, passed `displayEvents` instead of raw `events`

## Backlog
- P2: Drag to resize events in week/day views
- P2: Smart scheduling suggestions
- P3: Stripe premium plans (deferred by user)
