# Planora - PRD (Product Requirements Document)

## Original Problem Statement
Build a modern, responsive web app combining Calendly scheduling, Google Calendar interface, and collaborative task planner. Features include interactive calendar (Monthly/Weekly/Daily), availability management, booking links, task planner, and social invitations with RSVP.

## User Preferences
- **Primary Color**: Indigo
- **Theme**: Dark + Light mode with toggle
- **Auth**: Google OAuth (Emergent) + JWT email/password
- **PWA**: Mobile-optimized progressive web app

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI + Lucide React + date-fns + next-themes + recharts
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Auth**: Emergent Google OAuth + session-based email/password auth
- **Email**: Resend API for booking notifications
- **Calendar Sync**: Google Calendar API (OAuth2 flow)
- **Design**: Manrope headings, DM Sans body, Indigo primary, Swiss & High-Contrast aesthetic

## User Personas
1. **Solo Professional**: Uses calendar for personal scheduling, sets availability for client meetings
2. **Team Lead**: Creates collaborative events, assigns tasks, manages team schedule
3. **External Guest**: Visits booking link to schedule meetings with host users

## Core Requirements
1. Interactive Calendar with Monthly/Weekly/Daily views
2. Event CRUD with color coding and attendee management
3. Task planner with completion tracking, due dates, and categories
4. Availability settings with custom duration (15/30/60 min)
5. Shareable booking link for guest scheduling
6. Google OAuth + email/password authentication
7. Dark/Light theme toggle
8. PWA manifest + service worker for offline support
9. Recurring events (daily/weekly/monthly)
10. Drag-and-drop event rescheduling
11. Google Calendar two-way sync
12. Email notifications for bookings (Resend)
13. Meeting Analytics dashboard
14. Task categories/labels with filtering
15. Calendar event overlap handling (week/day views)
16. iCal export (.ics file download)

## Key DB Schema
- **users**: `{user_id, email, password_hash, name, picture, google_calendar_tokens, created_at}`
- **events**: `{event_id, user_id, title, description, start_time, end_time, color, attendees, recurrence, gcal_id}`
- **tasks**: `{task_id, user_id, title, description, due_date, completed, category, created_at}`
- **availability**: `{user_id, schedule, slot_duration}`
- **bookings**: `{booking_id, host_user_id, guest_name, guest_email, start_time, end_time, duration, created_at}`
- **user_sessions**: `{user_id, session_token, expires_at, created_at}`

## Key API Endpoints
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`
- Events: `/api/events` (GET, POST), `/api/events/{id}` (PUT, DELETE)
- Tasks: `/api/tasks` (GET, POST), `/api/tasks/{id}` (PUT, DELETE) — supports `category` field
- Availability: `/api/availability` (GET, PUT) — supports `slot_duration`
- Bookings: `/api/bookings` (GET, POST), `/api/bookings/user/{id}`, `/api/bookings/available/{id}`
- Google Calendar: `/api/gcal/connect`, `/api/gcal/callback`, `/api/gcal/status`, `/api/gcal/sync`, `/api/gcal/disconnect`
- Analytics: `/api/analytics`
- Export: `/api/export/ical`
- Seed: `/api/seed`

## Completed Features
- Phase 1: Full backend + React frontend + Auth + Calendar + Tasks + Availability + Booking
- Phase 2: PWA Service Worker + Recurring events + Drag-and-drop + Share page
- Phase 3: Custom booking duration (15/30/60) + Google Calendar sync UI + Resend email + Analytics
- Phase 4: Task categories (5 types) + Event overlap handling + iCal export + Vercel config

## Prioritized Backlog

### P1 (High)
- Real-time task collaboration (WebSocket)
- Calendar sharing between users

### P2 (Medium)
- Event reminders/notifications (in-app / browser)
- Vercel deployment validation (user needs Pro plan for git author fix)

### Deployment Notes
- **Emergent Deploy**: 50 credits/month, custom domain supported via Entri
- **Vercel Deploy**: Frontend only, needs REACT_APP_BACKEND_URL env var set to backend URL. vercel.json configured with SPA rewrites and PWA headers. User on Hobby plan — needs Pro upgrade to fix git author commit issue.
