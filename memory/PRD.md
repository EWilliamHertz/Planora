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

## Core Requirements (Static)
1. Interactive Calendar with Monthly/Weekly/Daily views
2. Event CRUD with color coding and attendee management
3. Task planner with completion tracking and due dates
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

## Key DB Schema
- **users**: `{user_id, email, password_hash, name, picture, google_calendar_tokens, created_at}`
- **events**: `{event_id, user_id, title, description, start_time, end_time, color, attendees, recurrence, gcal_id}`
- **tasks**: `{task_id, user_id, title, description, due_date, completed, created_at}`
- **availability**: `{user_id, schedule, slot_duration}`
- **bookings**: `{booking_id, host_user_id, guest_name, guest_email, start_time, end_time, duration, created_at}`
- **user_sessions**: `{user_id, session_token, expires_at, created_at}`

## Key API Endpoints
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/session`, `/api/auth/me`, `/api/auth/logout`
- Events: `/api/events` (GET, POST), `/api/events/{id}` (PUT, DELETE)
- Tasks: `/api/tasks` (GET, POST), `/api/tasks/{id}` (PUT, DELETE)
- Availability: `/api/availability` (GET, PUT) — supports `slot_duration`
- Bookings: `/api/bookings` (GET, POST), `/api/bookings/user/{id}`, `/api/bookings/available/{id}`
- Google Calendar: `/api/gcal/connect`, `/api/gcal/callback`, `/api/gcal/status`, `/api/gcal/sync`, `/api/gcal/disconnect`
- Analytics: `/api/analytics`
- Seed: `/api/seed`

## Prioritized Backlog

### P0 (Completed)
- ~~Interactive Calendar~~ DONE
- ~~Event & Task CRUD~~ DONE
- ~~Auth (Google OAuth + email/password)~~ DONE
- ~~Availability settings~~ DONE
- ~~Booking page~~ DONE
- ~~PWA Service Worker~~ DONE
- ~~Recurring events~~ DONE
- ~~Drag-and-drop~~ DONE
- ~~Share Your Planora~~ DONE
- ~~Custom booking duration (15/30/60 min)~~ DONE
- ~~Google Calendar sync UI~~ DONE
- ~~Email notifications (Resend)~~ DONE
- ~~Meeting Analytics dashboard~~ DONE

### P1 (High)
- Real-time task collaboration (WebSocket)
- Calendar event overlap handling in week/day views
- Task categories/labels

### P2 (Medium)
- Calendar sharing between users
- Export calendar (iCal format)
- Event reminders/notifications (in-app)
- Vercel deployment config validation
