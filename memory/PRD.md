# Planora - PRD (Product Requirements Document)

## Original Problem Statement
Build a modern, responsive web app combining Calendly scheduling, Google Calendar interface, and collaborative task planner. Features include interactive calendar (Monthly/Weekly/Daily), availability management, booking links, task planner, and social invitations with RSVP.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI + Lucide React + date-fns + next-themes + recharts
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Auth**: Emergent Google OAuth + session-based email/password auth
- **Email**: Resend API for booking notifications
- **Calendar Sync**: Google Calendar API (OAuth2 flow)
- **Real-time**: WebSocket for live task collaboration

## Completed Features
- Phase 1: Full backend + React frontend + Auth + Calendar + Tasks + Availability + Booking
- Phase 2: PWA Service Worker + Recurring events + Drag-and-drop + Share page
- Phase 3: Custom booking duration (15/30/60) + Google Calendar sync UI + Resend email + Analytics
- Phase 4: Task categories (5 types) + Event overlap handling + iCal export + Vercel config
- Phase 5: WebSocket real-time task updates + Calendar sharing between users + In-app event reminders/browser notifications + UI polish/mobile responsiveness
- Bug fix: Removed auto-seed (no placeholder data), fixed Notification API crash on Safari/unsupported browsers

## Key API Endpoints
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`
- Events: `/api/events` (GET, POST), `/api/events/{id}` (PUT, DELETE)
- Tasks: `/api/tasks` (GET, POST), `/api/tasks/{id}` (PUT, DELETE)
- Availability: `/api/availability` (GET, PUT)
- Bookings: `/api/bookings` (GET, POST), `/api/bookings/user/{id}`, `/api/bookings/available/{id}`
- Calendar Sharing: `/api/calendar/share` (POST), `/api/calendar/shares` (GET), `/api/calendar/shares/{id}` (DELETE), `/api/calendar/shared/{user_id}/events` (GET)
- Google Calendar: `/api/gcal/connect`, `/api/gcal/callback`, `/api/gcal/status`, `/api/gcal/sync`, `/api/gcal/disconnect`
- Reminders: `/api/reminders/upcoming`
- WebSocket: `/api/ws/{session_token}`
- Analytics: `/api/analytics`
- Export: `/api/export/ical`

## Prioritized Backlog
All major features complete. Remaining nice-to-haves:
- P2: Vercel deployment validation (user needs Pro plan for git author fix)
- P2: Recurring booking types (weekly 1:1 links)
- P3: Smart scheduling suggestions based on analytics
