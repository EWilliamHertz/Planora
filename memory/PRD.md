# Planora - PRD

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI + date-fns + recharts
- **Backend**: FastAPI + MongoDB
- **Auth**: Emergent Google OAuth + email/password
- **Real-time**: WebSocket
- **Email**: Resend API
- **Calendar Sync**: Google Calendar API

## Completed Features (All Phases)
- Interactive Calendar (Month/Week/Day) with drag-and-drop
- Event CRUD with colors, attendees, recurrence, reminders
- Task planner with categories (work/personal/urgent/health/finance) and filtering
- Availability settings with custom duration (15/30/60 min)
- Shareable booking link for guests
- Google OAuth + email/password auth
- Dark/Light theme toggle
- PWA manifest + service worker
- Google Calendar two-way sync
- Email notifications for bookings (Resend)
- Meeting Analytics dashboard
- Event overlap handling in week/day views
- iCal export (.ics download)
- WebSocket real-time task collaboration
- Calendar sharing between users
- In-app event reminders + browser notifications
- Onboarding wizard (3-step: availability → first event → booking link)
- Vercel deployment config (root + frontend)

## Vercel Deployment
Two vercel.json files created:
- `/vercel.json` (root) — for repos where Vercel root = project root: builds `frontend/` subdir
- `/frontend/vercel.json` — for repos where Vercel Root Directory = `frontend`
User must set `REACT_APP_BACKEND_URL` env var in Vercel project settings pointing to the backend URL.

## Prioritized Backlog
- P2: Recurring booking types
- P3: Smart scheduling suggestions
