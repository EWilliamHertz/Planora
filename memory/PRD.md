# Planora - PRD (Product Requirements Document)

## Original Problem Statement
Build a modern, responsive web app combining Calendly scheduling, Google Calendar interface, and collaborative task planner. Features include interactive calendar (Monthly/Weekly/Daily), availability management, booking links, task planner, and social invitations with RSVP.

## User Preferences
- **Primary Color**: Indigo
- **Theme**: Dark + Light mode with toggle
- **Auth**: Google OAuth (Emergent) + JWT email/password
- **PWA**: Mobile-optimized progressive web app

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI + Lucide React + date-fns + next-themes
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Auth**: Emergent Google OAuth + session-based email/password auth
- **Design**: Manrope headings, DM Sans body, Indigo primary, Swiss & High-Contrast aesthetic

## User Personas
1. **Solo Professional**: Uses calendar for personal scheduling, sets availability for client meetings
2. **Team Lead**: Creates collaborative events, assigns tasks, manages team schedule
3. **External Guest**: Visits booking link to schedule meetings with host users

## Core Requirements (Static)
1. Interactive Calendar with Monthly/Weekly/Daily views
2. Event CRUD with color coding and attendee management
3. Task planner with completion tracking and due dates
4. Availability settings (Calendly-like working hours)
5. Shareable booking link for guest scheduling
6. Google OAuth + email/password authentication
7. Dark/Light theme toggle
8. PWA manifest for mobile optimization
9. Mock data seeding for new users

## What's Been Implemented (2026-03-22)
- Full backend with 18+ API endpoints (auth, events, tasks, availability, bookings, seed)
- Login/Register page with Google OAuth + email/password
- Dashboard with interactive calendar (Month/Week/Day views)
- Event creation/editing modal with attendee invite and RSVP statuses
- Task creation/editing modal with due dates
- Task sidebar with completion toggling and upcoming events
- Availability page with day-by-day working hours configuration
- Public booking page with date selection and time slot booking
- Settings page with theme toggle and copyable booking link
- Dark/Light/System theme toggle using next-themes
- PWA manifest.json with Planora branding
- Responsive layout with mobile hamburger menu
- All tests passing (100% backend, 95% frontend)

## Update (2026-03-22 - Phase 2)
- PWA Service Worker with offline-first caching (network-first for API, cache-first for static)
- Recurring events (daily/weekly/monthly) with calendar expansion and repeat indicators
- Drag-and-drop event rescheduling across all calendar views (month/week/day)
- Share Your Planora page with professional dark indigo card, QR code, PNG download, copy link, embed code
- Backend updated with recurrence field on events
- Seed data includes recurring events (Team Standup=daily, 1:1 with Sarah=weekly)
- All tests passing (100% backend 28/28, 95% frontend)

## Prioritized Backlog
### P0 (Critical - Next)
- Service worker for offline PWA support
- Email notifications for bookings (requires email integration)

### P1 (High)
- Recurring events support
- Drag-and-drop event rescheduling on calendar
- Real-time task collaboration (WebSocket)
- Calendar event overlap handling in week/day views

### P2 (Medium)
- Google Calendar sync integration
- Custom booking duration (15min, 30min, 60min)
- Event reminders/notifications
- Task categories/labels
- Calendar sharing between users
- Export calendar (iCal format)

## Next Tasks
1. Add service worker for full PWA offline support
2. Implement email notifications for new bookings
3. Add recurring events with frequency options
4. Drag-and-drop event rescheduling
5. Calendar event overlap handling in week/day views
