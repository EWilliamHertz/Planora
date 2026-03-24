from fastapi import FastAPI, APIRouter, HTTPException, Response, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import asyncpg
import json
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import requests
import resend
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

ROOT_DIR = Path(__file__).parent
env_path = ROOT_DIR / '.env'
if env_path.exists():
    load_dotenv(env_path)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ── Environment Variables ────────────────────────────────────────────────────

RESEND_API_KEY      = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL        = os.environ.get('SENDER_EMAIL', 'noreply@planora.app')
GOOGLE_CLIENT_ID    = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GCAL_REDIRECT_URI   = os.environ.get('GCAL_REDIRECT_URI', '')
GCAL_SCOPES         = ['https://www.googleapis.com/auth/calendar']
STRIPE_API_KEY      = os.environ.get('STRIPE_API_KEY', '')
BACKEND_EXTERNAL_URL = os.environ.get('BACKEND_EXTERNAL_URL', '')

SUBSCRIPTION_PLANS = {
    'free':  {'name': 'Free',  'amount': 0,    'features': ['5 events/month', '1 booking link']},
    'pro':   {'name': 'Pro',   'amount': 999,  'features': ['Unlimited events', '10 booking links', 'Analytics']},
    'team':  {'name': 'Team',  'amount': 2999, 'features': ['Everything in Pro', 'Team collaboration', 'Priority support']},
}

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# ── Database ────────────────────────────────────────────────────────────────

def _clean_db_url(url: str) -> str:
    """Strip params asyncpg does not understand (channel_binding)."""
    url = re.sub(r'[&?]channel_binding=[^&]*', '', url)
    url = re.sub(r'\?&', '?', url)
    url = re.sub(r'&&+', '&', url)
    url = url.rstrip('?').rstrip('&')
    return url

DATABASE_URL: str = _clean_db_url(os.environ.get('DATABASE_URL', ''))
db_pool: asyncpg.Pool = None  # lazily initialized on first request
_schema_initialized: bool = False

async def _init_conn(conn):
    """Register JSON/JSONB codecs so dicts/lists pass through automatically."""
    await conn.set_type_codec('jsonb', encoder=json.dumps, decoder=json.loads, schema='pg_catalog')
    await conn.set_type_codec('json',  encoder=json.dumps, decoder=json.loads, schema='pg_catalog')

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    user_id            TEXT PRIMARY KEY,
    email              TEXT UNIQUE NOT NULL,
    name               TEXT NOT NULL,
    picture            TEXT,
    password_hash      TEXT,
    plan               TEXT DEFAULT 'free',
    google_calendar_tokens JSONB,
    created_at         TEXT
);

CREATE TABLE IF NOT EXISTS user_sessions (
    session_token TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL,
    expires_at    TEXT NOT NULL,
    created_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);

CREATE TABLE IF NOT EXISTS events (
    event_id    TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    start_time  TEXT,
    end_time    TEXT,
    color       TEXT DEFAULT 'indigo',
    attendees   JSONB DEFAULT '[]'::jsonb,
    recurrence  JSONB,
    reminder    INTEGER,
    gcal_id     TEXT,
    created_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);

CREATE TABLE IF NOT EXISTS tasks (
    task_id     TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT DEFAULT '',
    due_date    TEXT,
    completed   BOOLEAN DEFAULT FALSE,
    category    TEXT,
    status      TEXT DEFAULT 'todo',
    created_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);

CREATE TABLE IF NOT EXISTS availability (
    user_id       TEXT PRIMARY KEY,
    schedule      JSONB NOT NULL,
    slot_duration INTEGER DEFAULT 30,
    updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS bookings (
    booking_id    TEXT PRIMARY KEY,
    host_user_id  TEXT NOT NULL,
    guest_name    TEXT NOT NULL,
    guest_email   TEXT NOT NULL,
    start_time    TEXT,
    end_time      TEXT,
    duration      INTEGER DEFAULT 30,
    created_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_host ON bookings(host_user_id);

CREATE TABLE IF NOT EXISTS booking_links (
    link_id     TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    title       TEXT NOT NULL,
    duration    INTEGER DEFAULT 30,
    recurrence  TEXT DEFAULT 'weekly',
    description TEXT DEFAULT '',
    active      BOOLEAN DEFAULT TRUE,
    created_at  TEXT
);

CREATE TABLE IF NOT EXISTS calendar_shares (
    share_id              TEXT PRIMARY KEY,
    owner_user_id         TEXT NOT NULL,
    owner_name            TEXT,
    owner_email           TEXT,
    shared_with_email     TEXT NOT NULL,
    shared_with_user_id   TEXT,
    shared_with_name      TEXT,
    permission            TEXT DEFAULT 'view',
    created_at            TEXT
);
CREATE INDEX IF NOT EXISTS idx_shares_owner  ON calendar_shares(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shares_email  ON calendar_shares(shared_with_email);

CREATE TABLE IF NOT EXISTS teams (
    team_id    TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    owner_id   TEXT NOT NULL,
    members    JSONB DEFAULT '[]'::jsonb,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    session_id     TEXT PRIMARY KEY,
    user_id        TEXT NOT NULL,
    plan_id        TEXT,
    amount         NUMERIC,
    currency       TEXT DEFAULT 'usd',
    metadata       JSONB,
    payment_status TEXT DEFAULT 'initiated',
    status         TEXT,
    paid_at        TEXT,
    created_at     TEXT
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id      TEXT PRIMARY KEY,
    email_digest BOOLEAN DEFAULT FALSE
);
"""

# ── Helpers ─────────────────────────────────────────────────────────────────

def _row(row) -> dict:
    return dict(row) if row else None

def _rows(rows) -> list:
    return [dict(r) for r in rows]

def _build_update(fields: dict, start_idx: int = 2):
    clauses, values = [], []
    for k, v in fields.items():
        values.append(v)
        clauses.append(f"{k} = ${start_idx + len(values) - 1}")
    return ", ".join(clauses), values

async def get_pool() -> asyncpg.Pool:
    """Lazily create the DB pool and run schema init. Required for Vercel serverless
    because @app.on_event('startup') is never called in that environment."""
    global db_pool, _schema_initialized
    if db_pool is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL environment variable is not set")
        db_pool = await asyncpg.create_pool(DATABASE_URL, init=_init_conn, min_size=1, max_size=5)
        logger.info("Database pool created (lazy init)")
    if not _schema_initialized:
        async with db_pool.acquire() as conn:
            stmts = [s.strip() for s in SCHEMA_SQL.split(";") if s.strip()]
            for i, stmt in enumerate(stmts):
                try:
                    await conn.execute(stmt)
                except Exception as e:
                    logger.warning(f"Schema statement {i+1} skipped: {e}")
        _schema_initialized = True
        logger.info("Database schema initialized")
    return db_pool

# ── WebSocket Manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(user_id, []).append(ws)

    def disconnect(self, user_id: str, ws: WebSocket):
        if user_id in self.active:
            self.active[user_id] = [c for c in self.active[user_id] if c is not ws]
            if not self.active[user_id]:
                del self.active[user_id]

    async def broadcast_to_user(self, user_id: str, message: dict):
        for ws in self.active.get(user_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def broadcast_task_update(self, user_id: str, action: str, task: dict):
        async with (await get_pool()).acquire() as conn:
            shares = await conn.fetch(
                "SELECT owner_user_id, shared_with_user_id FROM calendar_shares "
                "WHERE owner_user_id = $1 OR shared_with_user_id = $1",
                user_id
            )
        target_ids = {user_id}
        for s in shares:
            target_ids.add(s['owner_user_id'])
            if s['shared_with_user_id']:
                target_ids.add(s['shared_with_user_id'])
        for uid in target_ids:
            await self.broadcast_to_user(uid, {"type": "task_update", "action": action, "task": task})

ws_manager = ConnectionManager()

# ── Pydantic Models ──────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    start_time: str
    end_time: str
    color: Optional[str] = "indigo"
    attendees: Optional[List[Dict]] = []
    recurrence: Optional[Dict] = None
    reminder: Optional[int] = None

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    color: Optional[str] = None
    attendees: Optional[List[Dict]] = None
    recurrence: Optional[Dict] = None
    reminder: Optional[int] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    due_date: Optional[str] = None
    completed: Optional[bool] = False
    category: Optional[str] = None
    status: Optional[str] = "todo"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    completed: Optional[bool] = None
    category: Optional[str] = None
    status: Optional[str] = None

class AvailabilityUpdate(BaseModel):
    schedule: Dict
    slot_duration: Optional[int] = 30

class BookingCreate(BaseModel):
    host_user_id: str
    guest_name: str
    guest_email: str
    start_time: str
    end_time: str
    duration: Optional[int] = 30

class CalendarShareCreate(BaseModel):
    email: str
    permission: Optional[str] = "view"

class RecurringBookingCreate(BaseModel):
    title: str
    duration: Optional[int] = 30
    recurrence: Optional[str] = "weekly"
    description: Optional[str] = ""

class TeamCreate(BaseModel):
    name: str

class TeamInvite(BaseModel):
    email: str
    role: Optional[str] = "member"

# ── Auth Helpers ─────────────────────────────────────────────────────────────

async def get_current_user(request: Request):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with (await get_pool()).acquire() as conn:
        session = _row(await conn.fetchrow(
            "SELECT * FROM user_sessions WHERE session_token = $1", session_token
        ))
        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")

        expires_at = session["expires_at"]
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")

        user = _row(await conn.fetchrow(
            "SELECT * FROM users WHERE user_id = $1", session["user_id"]
        ))
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

async def create_session(user_id: str, response: Response) -> str:
    session_token = f"sess_{uuid.uuid4().hex}"
    async with (await get_pool()).acquire() as conn:
        await conn.execute(
            "INSERT INTO user_sessions (session_token, user_id, expires_at, created_at) VALUES ($1,$2,$3,$4)",
            session_token, user_id,
            (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            datetime.now(timezone.utc).isoformat()
        )
    response.set_cookie(
        key="session_token", value=session_token,
        httponly=True, secure=True, samesite="none", path="/",
        max_age=7 * 24 * 60 * 60
    )
    return session_token

# ── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ── Auth Endpoints ───────────────────────────────────────────────────────────

@api_router.post("/auth/register")
async def register(data: UserRegister, response: Response):
    async with (await get_pool()).acquire() as conn:
        existing = await conn.fetchrow("SELECT user_id FROM users WHERE email = $1", data.email)
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await conn.execute(
            "INSERT INTO users (user_id, email, name, picture, password_hash, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
            user_id, data.email, data.name, None, password_hash,
            datetime.now(timezone.utc).isoformat()
        )
    session_token = await create_session(user_id, response)
    return {"user_id": user_id, "email": data.email, "name": data.name, "picture": None, "session_token": session_token}

@api_router.post("/auth/login")
async def login(data: UserLogin, response: Response):
    async with (await get_pool()).acquire() as conn:
        user = _row(await conn.fetchrow("SELECT * FROM users WHERE email = $1", data.email))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Use Google login for this account")
    if not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    session_token = await create_session(user["user_id"], response)
    return {"user_id": user["user_id"], "email": user["email"], "name": user["name"],
            "picture": user.get("picture"), "session_token": session_token}

@api_router.get("/auth/session")
async def process_google_session(session_id: str, response: Response):
    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth failed: {str(e)}")

    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")

    async with (await get_pool()).acquire() as conn:
        existing = _row(await conn.fetchrow("SELECT user_id FROM users WHERE email = $1", email))
        if existing:
            user_id = existing["user_id"]
            await conn.execute("UPDATE users SET name=$1, picture=$2 WHERE user_id=$3", name, picture, user_id)
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            await conn.execute(
                "INSERT INTO users (user_id, email, name, picture, created_at) VALUES ($1,$2,$3,$4,$5)",
                user_id, email, name, picture, datetime.now(timezone.utc).isoformat()
            )
    session_token = await create_session(user_id, response)
    return {"user_id": user_id, "email": email, "name": name, "picture": picture, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {"user_id": user["user_id"], "email": user["email"], "name": user["name"],
            "picture": user.get("picture"), "plan": user.get("plan", "free")}

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        async with (await get_pool()).acquire() as conn:
            await conn.execute("DELETE FROM user_sessions WHERE session_token=$1", session_token)
    response.set_cookie(key="session_token", value="", httponly=True, secure=True,
                        samesite="none", path="/", max_age=0)
    return {"message": "Logged out"}

# ── Events ───────────────────────────────────────────────────────────────────

@api_router.get("/events")
async def list_events(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        rows = await conn.fetch("SELECT * FROM events WHERE user_id=$1 ORDER BY start_time", user["user_id"])
    return _rows(rows)

@api_router.post("/events")
async def create_event(data: EventCreate, request: Request):
    user = await get_current_user(request)
    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    async with (await get_pool()).acquire() as conn:
        await conn.execute(
            "INSERT INTO events (event_id,user_id,title,description,start_time,end_time,color,attendees,recurrence,reminder,created_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
            event_id, user["user_id"], data.title, data.description or "",
            data.start_time, data.end_time, data.color or "indigo",
            data.attendees or [], data.recurrence, data.reminder, now
        )
        row = _row(await conn.fetchrow("SELECT * FROM events WHERE event_id=$1", event_id))
    return row

@api_router.put("/events/{event_id}")
async def update_event(event_id: str, data: EventUpdate, request: Request):
    user = await get_current_user(request)
    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No data to update")
    set_clause, values = _build_update(update_fields, start_idx=2)
    async with (await get_pool()).acquire() as conn:
        result = await conn.execute(
            f"UPDATE events SET {set_clause} WHERE event_id=$1 AND user_id=${len(values)+2}",
            event_id, *values, user["user_id"]
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Event not found")
        return _row(await conn.fetchrow("SELECT * FROM events WHERE event_id=$1", event_id))

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        result = await conn.execute(
            "DELETE FROM events WHERE event_id=$1 AND user_id=$2", event_id, user["user_id"]
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Deleted"}

# ── Tasks ────────────────────────────────────────────────────────────────────

@api_router.get("/tasks")
async def list_tasks_endpoint(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        rows = await conn.fetch("SELECT * FROM tasks WHERE user_id=$1 ORDER BY created_at DESC", user["user_id"])
    return _rows(rows)

@api_router.post("/tasks")
async def create_task(data: TaskCreate, request: Request):
    user = await get_current_user(request)
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    async with (await get_pool()).acquire() as conn:
        await conn.execute(
            "INSERT INTO tasks (task_id,user_id,title,description,due_date,completed,category,status,created_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            task_id, user["user_id"], data.title, data.description or "",
            data.due_date, data.completed or False, data.category, data.status or "todo", now
        )
        task = _row(await conn.fetchrow("SELECT * FROM tasks WHERE task_id=$1", task_id))
    await ws_manager.broadcast_task_update(user["user_id"], "created", task)
    return task

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, request: Request):
    user = await get_current_user(request)
    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_fields:
        raise HTTPException(status_code=400, detail="No data to update")
    set_clause, values = _build_update(update_fields, start_idx=2)
    async with (await get_pool()).acquire() as conn:
        result = await conn.execute(
            f"UPDATE tasks SET {set_clause} WHERE task_id=$1 AND user_id=${len(values)+2}",
            task_id, *values, user["user_id"]
        )
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Task not found")
        task = _row(await conn.fetchrow("SELECT * FROM tasks WHERE task_id=$1", task_id))
    await ws_manager.broadcast_task_update(user["user_id"], "updated", task)
    return task

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        result = await conn.execute(
            "DELETE FROM tasks WHERE task_id=$1 AND user_id=$2", task_id, user["user_id"]
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Task not found")
    await ws_manager.broadcast_task_update(user["user_id"], "deleted", {"task_id": task_id})
    return {"message": "Deleted"}

# ── Availability ─────────────────────────────────────────────────────────────

DEFAULT_SCHEDULE = {
    **{d: {"enabled": True,  "start": "09:00", "end": "17:00"} for d in ["monday","tuesday","wednesday","thursday","friday"]},
    **{d: {"enabled": False, "start": "09:00", "end": "17:00"} for d in ["saturday","sunday"]},
}

@api_router.get("/availability")
async def get_availability(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        row = _row(await conn.fetchrow("SELECT * FROM availability WHERE user_id=$1", user["user_id"]))
    if not row:
        return {"user_id": user["user_id"], "schedule": DEFAULT_SCHEDULE, "slot_duration": 30}
    return row

@api_router.put("/availability")
async def update_availability(data: AvailabilityUpdate, request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc).isoformat()
    async with (await get_pool()).acquire() as conn:
        await conn.execute(
            "INSERT INTO availability (user_id, schedule, slot_duration, updated_at) VALUES ($1,$2,$3,$4) "
            "ON CONFLICT (user_id) DO UPDATE SET schedule=$2, slot_duration=$3, updated_at=$4",
            user["user_id"], data.schedule, data.slot_duration, now
        )
        return _row(await conn.fetchrow("SELECT * FROM availability WHERE user_id=$1", user["user_id"]))

# ── Bookings ─────────────────────────────────────────────────────────────────

@api_router.get("/bookings/user/{user_id}")
async def get_user_booking_info(user_id: str):
    async with (await get_pool()).acquire() as conn:
        user = _row(await conn.fetchrow("SELECT user_id, name FROM users WHERE user_id=$1", user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"name": user["name"], "user_id": user["user_id"]}

@api_router.get("/bookings/available/{user_id}")
async def get_available_slots(user_id: str, date: str):
    async with (await get_pool()).acquire() as conn:
        avail_row = _row(await conn.fetchrow("SELECT * FROM availability WHERE user_id=$1", user_id))

    slot_duration = 30
    if not avail_row:
        schedule = DEFAULT_SCHEDULE
    else:
        schedule = avail_row["schedule"]
        slot_duration = avail_row.get("slot_duration", 30)

    target_date = datetime.fromisoformat(date).date()
    day_name = target_date.strftime("%A").lower()
    day_schedule = schedule.get(day_name)
    if not day_schedule or not day_schedule.get("enabled"):
        return {"slots": [], "slot_duration": slot_duration}

    start_hour, start_min = map(int, day_schedule["start"].split(":"))
    end_hour, end_min = map(int, day_schedule["end"].split(":"))
    current = datetime(target_date.year, target_date.month, target_date.day, start_hour, start_min, tzinfo=timezone.utc)
    end    = datetime(target_date.year, target_date.month, target_date.day, end_hour,   end_min,   tzinfo=timezone.utc)

    async with (await get_pool()).acquire() as conn:
        existing_events = _rows(await conn.fetch(
            "SELECT start_time, end_time FROM events WHERE user_id=$1 AND start_time >= $2 AND start_time < $3",
            user_id, current.isoformat(), end.isoformat()
        ))
        existing_bookings = _rows(await conn.fetch(
            "SELECT start_time, end_time FROM bookings WHERE host_user_id=$1 AND start_time >= $2 AND start_time < $3",
            user_id, current.isoformat(), end.isoformat()
        ))

    all_busy = existing_events + existing_bookings
    slots = []
    while current + timedelta(minutes=slot_duration) <= end:
        slot_start = current.isoformat()
        slot_end   = (current + timedelta(minutes=slot_duration)).isoformat()
        busy = any(item["start_time"] < slot_end and item["end_time"] > slot_start for item in all_busy)
        if not busy:
            slots.append({"start_time": slot_start, "end_time": slot_end})
        current += timedelta(minutes=slot_duration)

    return {"slots": slots, "slot_duration": slot_duration}

@api_router.post("/bookings")
async def create_booking(data: BookingCreate):
    booking_id = f"book_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    async with (await get_pool()).acquire() as conn:
        await conn.execute(
            "INSERT INTO bookings (booking_id,host_user_id,guest_name,guest_email,start_time,end_time,duration,created_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
            booking_id, data.host_user_id, data.guest_name, data.guest_email,
            data.start_time, data.end_time, data.duration, now
        )
        await conn.execute(
            "INSERT INTO events (event_id,user_id,title,description,start_time,end_time,color,attendees,created_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            f"evt_{uuid.uuid4().hex[:12]}", data.host_user_id,
            f"Meeting with {data.guest_name}",
            f"Booked by {data.guest_name} ({data.guest_email})",
            data.start_time, data.end_time, "emerald",
            [{"name": data.guest_name, "email": data.guest_email, "status": "accepted"}], now
        )
        host = _row(await conn.fetchrow("SELECT name FROM users WHERE user_id=$1", data.host_user_id))

    booking_doc = {"booking_id": booking_id, "host_user_id": data.host_user_id,
                   "guest_name": data.guest_name, "guest_email": data.guest_email,
                   "start_time": data.start_time, "end_time": data.end_time,
                   "duration": data.duration, "created_at": now}

    if RESEND_API_KEY:
        host_name = host["name"] if host else "Host"
        try:
            start_dt = datetime.fromisoformat(data.start_time.replace("Z", "+00:00"))
            formatted_time = start_dt.strftime("%A, %B %d at %I:%M %p UTC")
            resend.Emails.send({
                "from": f"Planora <{SENDER_EMAIL}>",
                "to": [data.guest_email],
                "subject": f"Meeting Confirmed with {host_name}",
                "html": f"<p>Your meeting with {host_name} is confirmed for {formatted_time}.</p>"
            })
        except Exception as e:
            logger.error(f"Failed to send booking email: {e}")

    return booking_doc

@api_router.get("/bookings")
async def list_bookings(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        rows = await conn.fetch("SELECT * FROM bookings WHERE host_user_id=$1 ORDER BY start_time DESC", user["user_id"])
    return _rows(rows)

# ── Seed ─────────────────────────────────────────────────────────────────────

@api_router.post("/seed")
async def seed_data(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        await conn.execute(
            "INSERT INTO availability (user_id, schedule, slot_duration, updated_at) VALUES ($1,$2,$3,$4) "
            "ON CONFLICT (user_id) DO NOTHING",
            user["user_id"], DEFAULT_SCHEDULE, 30, datetime.now(timezone.utc).isoformat()
        )
    return {"message": "ok"}

# ── Google Calendar ───────────────────────────────────────────────────────────

def _build_gcal_flow():
    client_config = {"web": {
        "client_id": GOOGLE_CLIENT_ID, "client_secret": GOOGLE_CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }}
    return Flow.from_client_config(client_config, scopes=GCAL_SCOPES, redirect_uri=GCAL_REDIRECT_URI)

@api_router.get("/gcal/connect")
async def gcal_connect(request: Request):
    user = await get_current_user(request)
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google Calendar not configured")
    flow = _build_gcal_flow()
    auth_url, _ = flow.authorization_url(access_type='offline', include_granted_scopes='true',
                                          prompt='consent', state=user["user_id"])
    return {"authorization_url": auth_url}

@api_router.get("/gcal/callback")
async def gcal_callback(code: str, state: str, response: Response):
    try:
        flow = _build_gcal_flow()
        flow.fetch_token(code=code)
        creds = flow.credentials
        token_data = {"token": creds.token, "refresh_token": creds.refresh_token,
                      "token_uri": creds.token_uri, "client_id": creds.client_id,
                      "client_secret": creds.client_secret,
                      "scopes": list(creds.scopes) if creds.scopes else GCAL_SCOPES}
        async with (await get_pool()).acquire() as conn:
            await conn.execute("UPDATE users SET google_calendar_tokens=$1 WHERE user_id=$2",
                               token_data, state)
    except Exception as e:
        logger.error(f"Google Calendar callback error: {e}")
    frontend_url = os.environ.get('FRONTEND_URL', 'https://planora-tau-seven.vercel.app')
    return RedirectResponse(url=f"{frontend_url}/settings?gcal=connected")

@api_router.get("/gcal/status")
async def gcal_status(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        row = _row(await conn.fetchrow("SELECT google_calendar_tokens FROM users WHERE user_id=$1", user["user_id"]))
    connected = bool(row and row.get("google_calendar_tokens"))
    return {"connected": connected}

@api_router.post("/gcal/sync")
async def gcal_sync(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        full_user = _row(await conn.fetchrow("SELECT * FROM users WHERE user_id=$1", user["user_id"]))
    tokens = full_user.get("google_calendar_tokens") if full_user else None
    if not tokens:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")

    try:
        creds = Credentials(token=tokens["token"], refresh_token=tokens.get("refresh_token"),
                            token_uri=tokens["token_uri"], client_id=tokens["client_id"],
                            client_secret=tokens["client_secret"],
                            scopes=tokens.get("scopes", GCAL_SCOPES))
        if creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
            async with (await get_pool()).acquire() as conn:
                updated_tokens = {**tokens, "token": creds.token}
                await conn.execute("UPDATE users SET google_calendar_tokens=$1 WHERE user_id=$2",
                                   updated_tokens, user["user_id"])

        service = build("calendar", "v3", credentials=creds)
        now = datetime.now(timezone.utc)
        events_result = service.events().list(
            calendarId='primary',
            timeMin=(now - timedelta(days=30)).isoformat(),
            timeMax=(now + timedelta(days=90)).isoformat(),
            maxResults=100, singleEvents=True, orderBy='startTime'
        ).execute()

        imported = 0
        for gcal_event in events_result.get('items', []):
            start = gcal_event.get('start', {})
            end   = gcal_event.get('end', {})
            start_time = start.get('dateTime', start.get('date', ''))
            end_time   = end.get('dateTime',   end.get('date', ''))
            gcal_id    = gcal_event.get('id', '')
            if not start_time or not end_time:
                continue
            async with (await get_pool()).acquire() as conn:
                existing = await conn.fetchrow(
                    "SELECT event_id FROM events WHERE user_id=$1 AND gcal_id=$2", user["user_id"], gcal_id
                )
                if not existing:
                    attendees = []
                    for att in gcal_event.get('attendees', []):
                        status = ('accepted' if att.get('responseStatus') == 'accepted'
                                  else 'declined' if att.get('responseStatus') == 'declined' else 'pending')
                        attendees.append({"name": att.get('displayName', att.get('email', '')),
                                          "email": att.get('email', ''), "status": status})
                    await conn.execute(
                        "INSERT INTO events (event_id,user_id,title,description,start_time,end_time,color,attendees,gcal_id,created_at) "
                        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
                        f"evt_{uuid.uuid4().hex[:12]}", user["user_id"],
                        gcal_event.get('summary', 'Untitled'),
                        gcal_event.get('description', ''),
                        start_time, end_time, "violet", attendees, gcal_id, now.isoformat()
                    )
                    imported += 1

        exported = 0
        async with (await get_pool()).acquire() as conn:
            planora_events = _rows(await conn.fetch(
                "SELECT * FROM events WHERE user_id=$1 AND gcal_id IS NULL", user["user_id"]
            ))
        for evt in planora_events:
            try:
                result = service.events().insert(calendarId='primary', body={
                    'summary': evt['title'], 'description': evt.get('description', ''),
                    'start': {'dateTime': evt['start_time'], 'timeZone': 'UTC'},
                    'end':   {'dateTime': evt['end_time'],   'timeZone': 'UTC'},
                }).execute()
                async with (await get_pool()).acquire() as conn:
                    await conn.execute("UPDATE events SET gcal_id=$1 WHERE event_id=$2",
                                       result.get('id', ''), evt["event_id"])
                exported += 1
            except Exception as e:
                logger.error(f"Failed to export event {evt['event_id']}: {e}")

        return {"imported": imported, "exported": exported,
                "message": f"Imported {imported}, exported {exported} events"}
    except Exception as e:
        logger.error(f"Google Calendar sync error: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@api_router.post("/gcal/disconnect")
async def gcal_disconnect(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        await conn.execute("UPDATE users SET google_calendar_tokens=NULL WHERE user_id=$1", user["user_id"])
    return {"message": "Disconnected"}

# ── Analytics ────────────────────────────────────────────────────────────────

@api_router.get("/analytics")
async def get_analytics(request: Request):
    user = await get_current_user(request)
    uid = user["user_id"]
    async with (await get_pool()).acquire() as conn:
        events   = _rows(await conn.fetch("SELECT * FROM events   WHERE user_id=$1",      uid))
        tasks    = _rows(await conn.fetch("SELECT * FROM tasks    WHERE user_id=$1",      uid))
        bookings = _rows(await conn.fetch("SELECT * FROM bookings WHERE host_user_id=$1", uid))

    now = datetime.now(timezone.utc)

    booking_trends = {}
    for b in bookings:
        created = b.get("created_at", "")
        if created:
            try:
                dt = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
                key = dt.strftime("%Y-%m")
                booking_trends[key] = booking_trends.get(key, 0) + 1
            except Exception:
                pass
    trends_list = [{"month": k, "count": v} for k, v in sorted(booking_trends.items())][-6:]

    hour_counts = {}
    for e in events:
        st = e.get("start_time", "")
        if st:
            try:
                dt = datetime.fromisoformat(str(st).replace("Z", "+00:00"))
                hour_key = dt.strftime("%H:00")
                hour_counts[hour_key] = hour_counts.get(hour_key, 0) + 1
            except Exception:
                pass
    busiest_slots = [{"hour": h, "count": c} for h, c in sorted(hour_counts.items(), key=lambda x: -x[1])[:8]]

    statuses = {"accepted": 0, "pending": 0, "declined": 0}
    total_attendees = 0
    for e in events:
        atts = e.get("attendees") or []
        for att in atts:
            total_attendees += 1
            s = att.get("status", "pending")
            statuses[s] = statuses.get(s, 0) + 1

    total_tasks     = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.get("completed"))
    upcoming_events = sum(1 for e in events if str(e.get("start_time", "")) > now.isoformat())

    return {
        "booking_trends": trends_list, "busiest_slots": busiest_slots,
        "attendee_responses": statuses, "total_attendees": total_attendees,
        "total_events": len(events), "upcoming_events": upcoming_events,
        "total_bookings": len(bookings), "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "task_completion_rate": round(completed_tasks / total_tasks * 100) if total_tasks else 0,
    }

# ── iCal Export ───────────────────────────────────────────────────────────────

@api_router.get("/export/ical")
async def export_ical(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        events = _rows(await conn.fetch("SELECT * FROM events WHERE user_id=$1", user["user_id"]))

    def to_ical_dt(iso_str):
        try:
            dt = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
            return dt.strftime("%Y%m%dT%H%M%SZ")
        except Exception:
            return ""

    lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Planora//Calendar//EN",
             "CALSCALE:GREGORIAN","METHOD:PUBLISH",f"X-WR-CALNAME:{user['name']}'s Planora"]
    for evt in events:
        dtstart = to_ical_dt(evt.get("start_time",""))
        dtend   = to_ical_dt(evt.get("end_time",""))
        if not dtstart or not dtend:
            continue
        summary = (evt.get("title") or "").replace(",", "\\,")
        desc    = (evt.get("description") or "").replace("\n","\\n").replace(",","\\,")
        lines += ["BEGIN:VEVENT", f"UID:{evt.get('event_id',uuid.uuid4().hex)}@planora",
                  f"DTSTART:{dtstart}", f"DTEND:{dtend}", f"SUMMARY:{summary}"]
        if desc:
            lines.append(f"DESCRIPTION:{desc}")
        for att in (evt.get("attendees") or []):
            if att.get("email"):
                lines.append(f"ATTENDEE;CN={att.get('name','')};RSVP=TRUE:mailto:{att['email']}")
        rec = evt.get("recurrence")
        if rec and rec.get("type") and rec["type"] != "none":
            rrule = f"RRULE:FREQ={rec['type'].upper()}"
            if rec.get("end_date"):
                until = to_ical_dt(rec["end_date"])
                if until:
                    rrule += f";UNTIL={until}"
            lines.append(rrule)
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")

    return Response(content="\r\n".join(lines), media_type="text/calendar",
                    headers={"Content-Disposition": f"attachment; filename=planora-{user['user_id']}.ics"})

# ── Calendar Sharing ──────────────────────────────────────────────────────────

@api_router.post("/calendar/share")
async def share_calendar(data: CalendarShareCreate, request: Request):
    user = await get_current_user(request)
    if data.email == user["email"]:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")
    async with (await get_pool()).acquire() as conn:
        existing = await conn.fetchrow(
            "SELECT share_id FROM calendar_shares WHERE owner_user_id=$1 AND shared_with_email=$2",
            user["user_id"], data.email
        )
        if existing:
            raise HTTPException(status_code=400, detail="Already shared with this user")
        target = _row(await conn.fetchrow("SELECT user_id, name FROM users WHERE email=$1", data.email))
        share_id = f"share_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        share_doc = {
            "share_id": share_id, "owner_user_id": user["user_id"],
            "owner_name": user["name"], "owner_email": user["email"],
            "shared_with_email": data.email,
            "shared_with_user_id": target["user_id"] if target else None,
            "shared_with_name": target["name"] if target else data.email,
            "permission": data.permission, "created_at": now
        }
        await conn.execute(
            "INSERT INTO calendar_shares (share_id,owner_user_id,owner_name,owner_email,shared_with_email,"
            "shared_with_user_id,shared_with_name,permission,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            *share_doc.values()
        )
    return share_doc

@api_router.get("/calendar/shares")
async def list_shares(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        shared_by_me   = _rows(await conn.fetch("SELECT * FROM calendar_shares WHERE owner_user_id=$1",    user["user_id"]))
        shared_with_me = _rows(await conn.fetch("SELECT * FROM calendar_shares WHERE shared_with_email=$1", user["email"]))
    return {"shared_by_me": shared_by_me, "shared_with_me": shared_with_me}

@api_router.delete("/calendar/shares/{share_id}")
async def revoke_share(share_id: str, request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        result = await conn.execute(
            "DELETE FROM calendar_shares WHERE share_id=$1 AND owner_user_id=$2", share_id, user["user_id"]
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail="Share not found")
    return {"message": "Share revoked"}

@api_router.get("/calendar/shared/{user_id}/events")
async def get_shared_events(user_id: str, request: Request):
    viewer = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        share = await conn.fetchrow(
            "SELECT share_id FROM calendar_shares WHERE owner_user_id=$1 AND shared_with_email=$2",
            user_id, viewer["email"]
        )
        if not share:
            raise HTTPException(status_code=403, detail="No access to this calendar")
        return _rows(await conn.fetch("SELECT * FROM events WHERE user_id=$1", user_id))

# ── Reminders ─────────────────────────────────────────────────────────────────

@api_router.get("/reminders/upcoming")
async def get_upcoming_reminders(request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    window_end = (now + timedelta(hours=1)).isoformat()
    async with (await get_pool()).acquire() as conn:
        events = _rows(await conn.fetch(
            "SELECT * FROM events WHERE user_id=$1 AND reminder IS NOT NULL AND start_time <= $2",
            user["user_id"], window_end
        ))
    due = []
    for evt in events:
        try:
            start = datetime.fromisoformat(str(evt["start_time"]).replace("Z", "+00:00"))
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            reminder_mins = evt.get("reminder", 0) or 0
            if not reminder_mins:
                continue
            reminder_time = start - timedelta(minutes=reminder_mins)
            if reminder_time <= now <= start:
                due.append({"event_id": evt["event_id"], "title": evt["title"],
                            "start_time": evt["start_time"], "reminder": reminder_mins,
                            "minutes_until": max(0, int((start - now).total_seconds() / 60))})
        except Exception:
            continue
    return due

# ── Booking Links ─────────────────────────────────────────────────────────────

@api_router.post("/booking-links")
async def create_booking_link(data: RecurringBookingCreate, request: Request):
    user = await get_current_user(request)
    link_id = f"blink_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    async with (await get_pool()).acquire() as conn:
        await conn.execute(
            "INSERT INTO booking_links (link_id,user_id,title,duration,recurrence,description,active,created_at) "
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
            link_id, user["user_id"], data.title, data.duration, data.recurrence, data.description or "", True, now
        )
        return _row(await conn.fetchrow("SELECT * FROM booking_links WHERE link_id=$1", link_id))

@api_router.get("/booking-links")
async def list_booking_links(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        return _rows(await conn.fetch("SELECT * FROM booking_links WHERE user_id=$1", user["user_id"]))

@api_router.delete("/booking-links/{link_id}")
async def delete_booking_link(link_id: str, request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        await conn.execute("DELETE FROM booking_links WHERE link_id=$1 AND user_id=$2", link_id, user["user_id"])
    return {"message": "Deleted"}

@api_router.get("/booking-links/{link_id}/public")
async def get_public_booking_link(link_id: str):
    async with (await get_pool()).acquire() as conn:
        link = _row(await conn.fetchrow("SELECT * FROM booking_links WHERE link_id=$1 AND active=TRUE", link_id))
        if not link:
            raise HTTPException(status_code=404, detail="Booking link not found")
        host = _row(await conn.fetchrow("SELECT name FROM users WHERE user_id=$1", link["user_id"]))
    return {**link, "host_name": host["name"] if host else "Unknown"}

# ── Teams ─────────────────────────────────────────────────────────────────────

@api_router.post("/teams")
async def create_team(data: TeamCreate, request: Request):
    user = await get_current_user(request)
    team_id = f"team_{uuid.uuid4().hex[:12]}"
    members = [{"user_id": user["user_id"], "email": user["email"], "name": user["name"], "role": "admin"}]
    now = datetime.now(timezone.utc).isoformat()
    async with (await get_pool()).acquire() as conn:
        await conn.execute(
            "INSERT INTO teams (team_id,name,owner_id,members,created_at) VALUES ($1,$2,$3,$4,$5)",
            team_id, data.name, user["user_id"], members, now
        )
        return _row(await conn.fetchrow("SELECT * FROM teams WHERE team_id=$1", team_id))

@api_router.get("/teams")
async def list_teams(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM teams WHERE EXISTS ("
            "  SELECT 1 FROM jsonb_array_elements(members) m WHERE m->>'user_id' = $1"
            ")", user["user_id"]
        )
    return _rows(rows)

@api_router.post("/teams/{team_id}/invite")
async def invite_to_team(team_id: str, data: TeamInvite, request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        team = _row(await conn.fetchrow("SELECT * FROM teams WHERE team_id=$1", team_id))
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        members = team.get("members") or []
        if not any(m["user_id"] == user["user_id"] and m["role"] == "admin" for m in members):
            raise HTTPException(status_code=403, detail="Only admins can invite")
        if any(m["email"] == data.email for m in members):
            raise HTTPException(status_code=400, detail="Already a member")
        target = _row(await conn.fetchrow("SELECT user_id, name FROM users WHERE email=$1", data.email))
        new_member = {"user_id": target["user_id"] if target else None,
                      "email": data.email,
                      "name": target["name"] if target else data.email,
                      "role": data.role}
        updated = members + [new_member]
        await conn.execute("UPDATE teams SET members=$1 WHERE team_id=$2", updated, team_id)
    return {"message": "Invited", "member": new_member}

@api_router.delete("/teams/{team_id}/members/{member_email}")
async def remove_from_team(team_id: str, member_email: str, request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        team = _row(await conn.fetchrow("SELECT * FROM teams WHERE team_id=$1", team_id))
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        members = team.get("members") or []
        if not any(m["user_id"] == user["user_id"] and m["role"] == "admin" for m in members):
            raise HTTPException(status_code=403, detail="Only admins can remove members")
        updated = [m for m in members if m["email"] != member_email]
        await conn.execute("UPDATE teams SET members=$1 WHERE team_id=$2", updated, team_id)
    return {"message": "Removed"}

@api_router.get("/teams/{team_id}")
async def get_team(team_id: str, request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        team = _row(await conn.fetchrow(
            "SELECT * FROM teams WHERE team_id=$1 AND EXISTS ("
            "  SELECT 1 FROM jsonb_array_elements(members) m WHERE m->>'user_id' = $2"
            ")", team_id, user["user_id"]
        ))
    if not team:
        raise HTTPException(status_code=404, detail="Team not found or no access")
    return team

# ── Plans (Stripe removed — use emergentintegrations separately if needed) ────

@api_router.get("/plans")
async def get_plans():
    return [{"plan_id": k, **v} for k, v in SUBSCRIPTION_PLANS.items()]

@api_router.get("/user/plan")
async def get_user_plan(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        row = _row(await conn.fetchrow("SELECT plan FROM users WHERE user_id=$1", user["user_id"]))
    plan = (row or {}).get("plan", "free")
    return {"plan": plan, "plan_details": SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["free"])}

class SubscriptionCheckout(BaseModel):
    plan_id: str
    origin_url: str

@api_router.post("/subscribe")
async def create_subscription(data: SubscriptionCheckout, request: Request):
    raise HTTPException(status_code=503, detail="Payment processing not configured on this deployment")

@api_router.get("/subscribe/status/{session_id}")
async def check_subscription_status(session_id: str, request: Request):
    raise HTTPException(status_code=503, detail="Payment processing not configured on this deployment")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    return {"received": True}

# ── User Preferences & Digest ─────────────────────────────────────────────────

class DigestPreference(BaseModel):
    enabled: bool

@api_router.get("/user/preferences")
async def get_user_preferences(request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        prefs = _row(await conn.fetchrow("SELECT * FROM user_preferences WHERE user_id=$1", user["user_id"]))
    if not prefs:
        return {"user_id": user["user_id"], "email_digest": False}
    return prefs

@api_router.put("/user/preferences/digest")
async def update_digest_preference(data: DigestPreference, request: Request):
    user = await get_current_user(request)
    async with (await get_pool()).acquire() as conn:
        await conn.execute(
            "INSERT INTO user_preferences (user_id, email_digest) VALUES ($1,$2) "
            "ON CONFLICT (user_id) DO UPDATE SET email_digest=$2",
            user["user_id"], data.enabled
        )
    return {"user_id": user["user_id"], "email_digest": data.enabled}

@api_router.post("/digest/send")
async def send_weekly_digest(request: Request):
    user = await get_current_user(request)
    if not RESEND_API_KEY:
        raise HTTPException(status_code=400, detail="Email service not configured")
    now = datetime.now(timezone.utc)
    async with (await get_pool()).acquire() as conn:
        events = _rows(await conn.fetch(
            "SELECT * FROM events WHERE user_id=$1 AND start_time >= $2",
            user["user_id"], now.isoformat()
        ))
        tasks = _rows(await conn.fetch("SELECT * FROM tasks WHERE user_id=$1", user["user_id"]))
    try:
        resend.Emails.send({"from": f"Planora <{SENDER_EMAIL}>", "to": [user["email"]],
                            "subject": f"Your Planora Weekly Digest - {now.strftime('%b %d')}",
                            "html": f"<p>You have {len(events)} upcoming events and {len([t for t in tasks if not t.get('completed')])} pending tasks.</p>"})
        return {"message": "Digest sent", "email": user["email"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send: {str(e)}")

# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/api/ws/{session_token}")
async def websocket_endpoint(websocket: WebSocket, session_token: str):
    async with (await get_pool()).acquire() as conn:
        session = _row(await conn.fetchrow(
            "SELECT user_id FROM user_sessions WHERE session_token=$1", session_token
        ))
    if not session:
        await websocket.close(code=4001)
        return
    user_id = session["user_id"]
    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        ws_manager.disconnect(user_id, websocket)

# ── App Setup ─────────────────────────────────────────────────────────────────

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    """Best-effort startup init — runs when hosting with uvicorn, skipped on Vercel serverless."""
    try:
        await get_pool()
        logger.info("Startup: database ready")
    except Exception as e:
        logger.error(f"Startup: database init failed (will retry on first request): {e}")

@app.on_event("shutdown")
async def shutdown():
    if db_pool:
        await db_pool.close()
