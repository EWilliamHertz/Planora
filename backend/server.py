from fastapi import FastAPI, APIRouter, HTTPException, Response, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
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
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
env_path = ROOT_DIR / '.env'
if env_path.exists():
    load_dotenv(env_path)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

import certifi

client = None
db = None

# Resend config
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Stripe config
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')

# Subscription plans (amounts in dollars)
SUBSCRIPTION_PLANS = {
    "free": {"name": "Free", "amount": 0.0, "features": ["5 events/month", "Basic calendar views", "1 booking link"]},
    "pro": {"name": "Pro", "amount": 9.00, "features": ["Unlimited events", "Google Calendar sync", "Custom booking links", "Email notifications", "Priority support"]},
    "business": {"name": "Business", "amount": 29.00, "features": ["Everything in Pro", "Team workspaces", "Analytics dashboard", "Multi-calendar sharing", "Weekly email digest", "API access"]},
}

# Google Calendar config
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
BACKEND_EXTERNAL_URL = os.environ.get('BACKEND_EXTERNAL_URL', '')
GCAL_REDIRECT_URI = f"{BACKEND_EXTERNAL_URL}/api/gcal/callback"
GCAL_SCOPES = ["https://www.googleapis.com/auth/calendar"]

app = FastAPI()
api_router = APIRouter(prefix="/api")

@app.on_event("startup")
async def startup_db_client():
    global client, db
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
    db = client[os.environ['DB_NAME']]

# --- WebSocket Connection Manager ---

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
        # Send to the user and all users who share with them
        shares = await db.calendar_shares.find(
            {"$or": [{"owner_user_id": user_id}, {"shared_with_user_id": user_id}]},
            {"_id": 0}
        ).to_list(100)
        target_ids = {user_id}
        for s in shares:
            target_ids.add(s["owner_user_id"])
            target_ids.add(s.get("shared_with_user_id", ""))
        for uid in target_ids:
            await self.broadcast_to_user(uid, {"type": "task_update", "action": action, "task": task})

ws_manager = ConnectionManager()

# --- Pydantic Models ---

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
    reminder: Optional[int] = None  # minutes before: 5, 15, 30, 60

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
    status: Optional[str] = "todo"  # "todo", "in_progress", "done"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    completed: Optional[bool] = None
    category: Optional[str] = None
    status: Optional[str] = None

class AvailabilityUpdate(BaseModel):
    schedule: Dict
    slot_duration: Optional[int] = 30  # 15, 30, or 60 minutes

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
    recurrence: Optional[str] = "weekly"  # "weekly", "biweekly"
    description: Optional[str] = ""

class TeamCreate(BaseModel):
    name: str

class TeamInvite(BaseModel):
    email: str
    role: Optional[str] = "member"  # "admin", "member"

# --- Auth Helper ---

async def get_current_user(request: Request):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one(
        {"session_token": session_token}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one(
        {"user_id": session["user_id"]}, {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user

async def create_session(user_id: str, response: Response):
    session_token = f"sess_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    return session_token

# --- Auth Endpoints ---

@api_router.post("/auth/register")
async def register(data: UserRegister, response: Response):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    user_id = f"user_{uuid.uuid4().hex[:12]}"

    await db.users.insert_one({
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "picture": None,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    session_token = await create_session(user_id, response)
    return {
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "picture": None,
        "session_token": session_token
    }

@api_router.post("/auth/login")
async def login(data: UserLogin, response: Response):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Use Google login for this account")

    if not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    session_token = await create_session(user["user_id"], response)
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "session_token": session_token
    }

@api_router.get("/auth/session")
async def process_google_session(session_id: str, response: Response):
    # Call Emergent's session-data endpoint
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

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    session_token = await create_session(user_id, response)
    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "session_token": session_token
    }

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "plan": user.get("plan", "free"),
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.set_cookie(
        key="session_token",
        value="",
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=0
    )
    return {"message": "Logged out"}

# --- Events ---

@api_router.get("/events")
async def list_events(request: Request):
    user = await get_current_user(request)
    events = await db.events.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(1000)
    return events

@api_router.post("/events")
async def create_event(data: EventCreate, request: Request):
    user = await get_current_user(request)
    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    event_doc = {
        "event_id": event_id,
        "user_id": user["user_id"],
        "title": data.title,
        "description": data.description,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "color": data.color,
        "attendees": data.attendees,
        "recurrence": data.recurrence,
        "reminder": data.reminder,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.events.insert_one(event_doc)
    return {k: v for k, v in event_doc.items() if k != "_id"}

@api_router.put("/events/{event_id}")
async def update_event(event_id: str, data: EventUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {}
    for k, v in data.model_dump().items():
        if v is not None:
            update_data[k] = v
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    result = await db.events.update_one(
        {"event_id": event_id, "user_id": user["user_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")

    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    return event

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.events.delete_one(
        {"event_id": event_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Deleted"}

# --- Tasks ---

@api_router.get("/tasks")
async def list_tasks(request: Request):
    user = await get_current_user(request)
    tasks = await db.tasks.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).to_list(1000)
    return tasks

@api_router.post("/tasks")
async def create_task(data: TaskCreate, request: Request):
    user = await get_current_user(request)
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    task_doc = {
        "task_id": task_id,
        "user_id": user["user_id"],
        "title": data.title,
        "description": data.description,
        "due_date": data.due_date,
        "completed": data.completed,
        "category": data.category,
        "status": data.status or "todo",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tasks.insert_one(task_doc)
    result_task = {k: v for k, v in task_doc.items() if k != "_id"}
    await ws_manager.broadcast_task_update(user["user_id"], "created", result_task)
    return result_task

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, request: Request):
    user = await get_current_user(request)
    update_data = {}
    for k, v in data.model_dump().items():
        if v is not None:
            update_data[k] = v
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")

    result = await db.tasks.update_one(
        {"task_id": task_id, "user_id": user["user_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")

    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    await ws_manager.broadcast_task_update(user["user_id"], "updated", task)
    return task

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.tasks.delete_one(
        {"task_id": task_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    await ws_manager.broadcast_task_update(user["user_id"], "deleted", {"task_id": task_id})
    return {"message": "Deleted"}

# --- Availability ---

@api_router.get("/availability")
async def get_availability(request: Request):
    user = await get_current_user(request)
    availability = await db.availability.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    if not availability:
        default_schedule = {}
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
            default_schedule[day] = {"enabled": True, "start": "09:00", "end": "17:00"}
        for day in ["saturday", "sunday"]:
            default_schedule[day] = {"enabled": False, "start": "09:00", "end": "17:00"}
        return {"user_id": user["user_id"], "schedule": default_schedule, "slot_duration": 30}
    return availability

@api_router.put("/availability")
async def update_availability(data: AvailabilityUpdate, request: Request):
    user = await get_current_user(request)
    await db.availability.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"schedule": data.schedule, "user_id": user["user_id"], "slot_duration": data.slot_duration}},
        upsert=True
    )
    availability = await db.availability.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    )
    return availability

# --- Bookings ---

@api_router.get("/bookings/user/{user_id}")
async def get_user_booking_info(user_id: str):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"name": user["name"], "user_id": user["user_id"]}

@api_router.get("/bookings/available/{user_id}")
async def get_available_slots(user_id: str, date: str):
    availability = await db.availability.find_one(
        {"user_id": user_id}, {"_id": 0}
    )
    slot_duration = 30  # default
    if not availability:
        schedule = {}
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
            schedule[day] = {"enabled": True, "start": "09:00", "end": "17:00"}
        for day in ["saturday", "sunday"]:
            schedule[day] = {"enabled": False, "start": "09:00", "end": "17:00"}
    else:
        schedule = availability["schedule"]
        slot_duration = availability.get("slot_duration", 30)

    target_date = datetime.fromisoformat(date).date()
    day_name = target_date.strftime("%A").lower()

    day_schedule = schedule.get(day_name)
    if not day_schedule or not day_schedule.get("enabled"):
        return {"slots": [], "slot_duration": slot_duration}

    start_hour, start_min = map(int, day_schedule["start"].split(":"))
    end_hour, end_min = map(int, day_schedule["end"].split(":"))

    slots = []
    current = datetime(target_date.year, target_date.month, target_date.day,
                       start_hour, start_min, tzinfo=timezone.utc)
    end = datetime(target_date.year, target_date.month, target_date.day,
                   end_hour, end_min, tzinfo=timezone.utc)

    existing_events = await db.events.find(
        {"user_id": user_id, "start_time": {"$gte": current.isoformat(), "$lt": end.isoformat()}},
        {"_id": 0}
    ).to_list(100)

    existing_bookings = await db.bookings.find(
        {"host_user_id": user_id, "start_time": {"$gte": current.isoformat(), "$lt": end.isoformat()}},
        {"_id": 0}
    ).to_list(100)

    while current + timedelta(minutes=slot_duration) <= end:
        slot_start = current.isoformat()
        slot_end = (current + timedelta(minutes=slot_duration)).isoformat()

        is_available = True
        for item in existing_events + existing_bookings:
            if item.get("start_time", "") < slot_end and item.get("end_time", "") > slot_start:
                is_available = False
                break

        if is_available:
            slots.append({"start_time": slot_start, "end_time": slot_end})

        current += timedelta(minutes=slot_duration)

    return {"slots": slots, "slot_duration": slot_duration}

@api_router.post("/bookings")
async def create_booking(data: BookingCreate):
    booking_id = f"book_{uuid.uuid4().hex[:12]}"
    booking_doc = {
        "booking_id": booking_id,
        "host_user_id": data.host_user_id,
        "guest_name": data.guest_name,
        "guest_email": data.guest_email,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "duration": data.duration,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.bookings.insert_one(booking_doc)

    await db.events.insert_one({
        "event_id": f"evt_{uuid.uuid4().hex[:12]}",
        "user_id": data.host_user_id,
        "title": f"Meeting with {data.guest_name}",
        "description": f"Booked by {data.guest_name} ({data.guest_email})",
        "start_time": data.start_time,
        "end_time": data.end_time,
        "color": "emerald",
        "attendees": [{"name": data.guest_name, "email": data.guest_email, "status": "accepted"}],
        "recurrence": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    # Send email notification
    if RESEND_API_KEY:
        host = await db.users.find_one({"user_id": data.host_user_id}, {"_id": 0})
        host_name = host["name"] if host else "Host"
        try:
            start_dt = datetime.fromisoformat(data.start_time.replace("Z", "+00:00"))
            formatted_time = start_dt.strftime("%A, %B %d at %I:%M %p UTC")
            resend.Emails.send({
                "from": f"Planora <{SENDER_EMAIL}>",
                "to": [data.guest_email],
                "subject": f"Meeting Confirmed with {host_name}",
                "html": f"""<div style="font-family:'DM Sans',Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#f8f8fc;border-radius:16px">
                    <div style="background:#1e1b4b;color:#fff;padding:28px;border-radius:12px;margin-bottom:20px">
                        <h1 style="font-family:'Manrope',sans-serif;margin:0 0 8px;font-size:22px">Meeting Confirmed</h1>
                        <p style="color:#a5b4fc;margin:0;font-size:14px">Your meeting has been booked</p>
                    </div>
                    <div style="background:#fff;padding:24px;border-radius:12px;border:1px solid #e5e7eb">
                        <p style="margin:0 0 16px;font-size:15px"><strong>With:</strong> {host_name}</p>
                        <p style="margin:0 0 16px;font-size:15px"><strong>When:</strong> {formatted_time}</p>
                        <p style="margin:0 0 16px;font-size:15px"><strong>Duration:</strong> {data.duration or 30} minutes</p>
                        <p style="margin:0;font-size:13px;color:#6b7280">Booked as {data.guest_name} ({data.guest_email})</p>
                    </div>
                    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px">Powered by Planora</p>
                </div>"""
            })
        except Exception as e:
            logger.error(f"Failed to send booking email: {e}")

    return {k: v for k, v in booking_doc.items() if k != "_id"}

@api_router.get("/bookings")
async def list_bookings(request: Request):
    user = await get_current_user(request)
    bookings = await db.bookings.find(
        {"host_user_id": user["user_id"]}, {"_id": 0}
    ).to_list(1000)
    return bookings

# --- Seed Data ---

@api_router.post("/seed")
async def seed_data(request: Request):
    user = await get_current_user(request)
    user_id = user["user_id"]

    # Only ensure default availability exists for new users
    existing = await db.availability.find_one({"user_id": user_id})
    if not existing:
        default_schedule = {}
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
            default_schedule[day] = {"enabled": True, "start": "09:00", "end": "17:00"}
        for day in ["saturday", "sunday"]:
            default_schedule[day] = {"enabled": False, "start": "09:00", "end": "17:00"}
        await db.availability.update_one(
            {"user_id": user_id},
            {"$set": {"user_id": user_id, "schedule": default_schedule, "slot_duration": 30}},
            upsert=True
        )

    return {"message": "ok"}

# --- Google Calendar ---

def _build_gcal_flow():
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(client_config, scopes=GCAL_SCOPES, redirect_uri=GCAL_REDIRECT_URI)
    return flow

@api_router.get("/gcal/connect")
async def gcal_connect(request: Request):
    user = await get_current_user(request)
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google Calendar not configured")
    flow = _build_gcal_flow()
    auth_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        state=user["user_id"]
    )
    return {"authorization_url": auth_url}

@api_router.get("/gcal/callback")
async def gcal_callback(code: str, state: str, response: Response):
    try:
        flow = _build_gcal_flow()
        flow.fetch_token(code=code)
        credentials = flow.credentials
        token_data = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": list(credentials.scopes) if credentials.scopes else GCAL_SCOPES,
        }
        await db.users.update_one(
            {"user_id": state},
            {"$set": {"google_calendar_tokens": token_data}}
        )
    except Exception as e:
        logger.error(f"Google Calendar callback error: {e}")
    frontend_url = BACKEND_EXTERNAL_URL.replace('/api', '').rstrip('/')
    return RedirectResponse(url=f"{frontend_url}/settings?gcal=connected")

@api_router.get("/gcal/status")
async def gcal_status(request: Request):
    user = await get_current_user(request)
    full_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    connected = bool(full_user and full_user.get("google_calendar_tokens"))
    return {"connected": connected}

@api_router.post("/gcal/sync")
async def gcal_sync(request: Request):
    user = await get_current_user(request)
    full_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    tokens = full_user.get("google_calendar_tokens") if full_user else None
    if not tokens:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")

    try:
        creds = Credentials(
            token=tokens["token"],
            refresh_token=tokens.get("refresh_token"),
            token_uri=tokens["token_uri"],
            client_id=tokens["client_id"],
            client_secret=tokens["client_secret"],
            scopes=tokens.get("scopes", GCAL_SCOPES),
        )
        if creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"google_calendar_tokens.token": creds.token}}
            )

        service = build("calendar", "v3", credentials=creds)
        now = datetime.now(timezone.utc)
        time_min = (now - timedelta(days=30)).isoformat()
        time_max = (now + timedelta(days=90)).isoformat()

        events_result = service.events().list(
            calendarId='primary', timeMin=time_min, timeMax=time_max,
            maxResults=100, singleEvents=True, orderBy='startTime'
        ).execute()
        gcal_events = events_result.get('items', [])

        imported = 0
        for gcal_event in gcal_events:
            start = gcal_event.get('start', {})
            end = gcal_event.get('end', {})
            start_time = start.get('dateTime', start.get('date', ''))
            end_time = end.get('dateTime', end.get('date', ''))
            title = gcal_event.get('summary', 'Untitled')
            gcal_id = gcal_event.get('id', '')

            existing = await db.events.find_one(
                {"user_id": user["user_id"], "gcal_id": gcal_id}, {"_id": 0}
            )
            if not existing and start_time and end_time:
                attendees = []
                for att in gcal_event.get('attendees', []):
                    status = 'accepted' if att.get('responseStatus') == 'accepted' else (
                        'declined' if att.get('responseStatus') == 'declined' else 'pending')
                    attendees.append({
                        "name": att.get('displayName', att.get('email', '')),
                        "email": att.get('email', ''),
                        "status": status
                    })
                await db.events.insert_one({
                    "event_id": f"evt_{uuid.uuid4().hex[:12]}",
                    "user_id": user["user_id"],
                    "title": title,
                    "description": gcal_event.get('description', ''),
                    "start_time": start_time,
                    "end_time": end_time,
                    "color": "violet",
                    "attendees": attendees,
                    "recurrence": None,
                    "gcal_id": gcal_id,
                    "created_at": now.isoformat()
                })
                imported += 1

        # Export Planora events to Google Calendar
        exported = 0
        planora_events = await db.events.find(
            {"user_id": user["user_id"], "gcal_id": {"$exists": False}},
            {"_id": 0}
        ).to_list(200)
        for evt in planora_events:
            try:
                gcal_body = {
                    'summary': evt['title'],
                    'description': evt.get('description', ''),
                    'start': {'dateTime': evt['start_time'], 'timeZone': 'UTC'},
                    'end': {'dateTime': evt['end_time'], 'timeZone': 'UTC'},
                }
                result = service.events().insert(calendarId='primary', body=gcal_body).execute()
                await db.events.update_one(
                    {"event_id": evt["event_id"]},
                    {"$set": {"gcal_id": result.get('id', '')}}
                )
                exported += 1
            except Exception as e:
                logger.error(f"Failed to export event {evt['event_id']}: {e}")

        return {"imported": imported, "exported": exported, "message": f"Imported {imported}, exported {exported} events"}
    except Exception as e:
        logger.error(f"Google Calendar sync error: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@api_router.post("/gcal/disconnect")
async def gcal_disconnect(request: Request):
    user = await get_current_user(request)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$unset": {"google_calendar_tokens": ""}}
    )
    return {"message": "Disconnected"}

# --- Analytics ---

@api_router.get("/analytics")
async def get_analytics(request: Request):
    user = await get_current_user(request)
    user_id = user["user_id"]

    events = await db.events.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    tasks = await db.tasks.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    bookings = await db.bookings.find({"host_user_id": user_id}, {"_id": 0}).to_list(1000)

    now = datetime.now(timezone.utc)

    # Booking trends (last 6 months)
    booking_trends = {}
    for b in bookings:
        created = b.get("created_at", "")
        if created:
            try:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00")) if isinstance(created, str) else created
                key = dt.strftime("%Y-%m")
                booking_trends[key] = booking_trends.get(key, 0) + 1
            except Exception:
                pass
    trends_list = [{"month": k, "count": v} for k, v in sorted(booking_trends.items())][-6:]

    # Busiest time slots
    hour_counts = {}
    for e in events:
        st = e.get("start_time", "")
        if st:
            try:
                dt = datetime.fromisoformat(st.replace("Z", "+00:00")) if isinstance(st, str) else st
                hour_key = dt.strftime("%H:00")
                hour_counts[hour_key] = hour_counts.get(hour_key, 0) + 1
            except Exception:
                pass
    busiest = sorted(hour_counts.items(), key=lambda x: -x[1])[:8]
    busiest_slots = [{"hour": h, "count": c} for h, c in busiest]

    # Attendee response rates
    total_attendees = 0
    statuses = {"accepted": 0, "pending": 0, "declined": 0}
    for e in events:
        for att in e.get("attendees", []):
            total_attendees += 1
            s = att.get("status", "pending")
            statuses[s] = statuses.get(s, 0) + 1

    # Task completion
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.get("completed"))

    # Summary
    upcoming_events = sum(1 for e in events if e.get("start_time", "") > now.isoformat())

    return {
        "booking_trends": trends_list,
        "busiest_slots": busiest_slots,
        "attendee_responses": statuses,
        "total_attendees": total_attendees,
        "total_events": len(events),
        "upcoming_events": upcoming_events,
        "total_bookings": len(bookings),
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "task_completion_rate": round(completed_tasks / total_tasks * 100) if total_tasks else 0,
    }

# --- iCal Export ---

@api_router.get("/export/ical")
async def export_ical(request: Request):
    user = await get_current_user(request)
    events = await db.events.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Planora//Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{user['name']}'s Planora",
    ]

    for evt in events:
        uid = evt.get("event_id", uuid.uuid4().hex)
        start = evt.get("start_time", "")
        end = evt.get("end_time", "")

        def to_ical_dt(iso_str):
            try:
                dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
                return dt.strftime("%Y%m%dT%H%M%SZ")
            except Exception:
                return ""

        dtstart = to_ical_dt(start)
        dtend = to_ical_dt(end)
        if not dtstart or not dtend:
            continue

        summary = (evt.get("title") or "").replace(",", "\\,")
        desc = (evt.get("description") or "").replace("\n", "\\n").replace(",", "\\,")

        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{uid}@planora")
        lines.append(f"DTSTART:{dtstart}")
        lines.append(f"DTEND:{dtend}")
        lines.append(f"SUMMARY:{summary}")
        if desc:
            lines.append(f"DESCRIPTION:{desc}")
        for att in evt.get("attendees", []):
            if att.get("email"):
                lines.append(f"ATTENDEE;CN={att.get('name', '')};RSVP=TRUE:mailto:{att['email']}")

        rec = evt.get("recurrence")
        if rec and rec.get("type") and rec["type"] != "none":
            freq = rec["type"].upper()
            rrule = f"RRULE:FREQ={freq}"
            if rec.get("end_date"):
                until = to_ical_dt(rec["end_date"])
                if until:
                    rrule += f";UNTIL={until}"
            lines.append(rrule)

        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    ical_content = "\r\n".join(lines)

    return Response(
        content=ical_content,
        media_type="text/calendar",
        headers={"Content-Disposition": f"attachment; filename=planora-{user['user_id']}.ics"}
    )

# --- Calendar Sharing ---

@api_router.post("/calendar/share")
async def share_calendar(data: CalendarShareCreate, request: Request):
    user = await get_current_user(request)
    if data.email == user["email"]:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")

    existing = await db.calendar_shares.find_one(
        {"owner_user_id": user["user_id"], "shared_with_email": data.email}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already shared with this user")

    target_user = await db.users.find_one({"email": data.email}, {"_id": 0})
    share_doc = {
        "share_id": f"share_{uuid.uuid4().hex[:12]}",
        "owner_user_id": user["user_id"],
        "owner_name": user["name"],
        "owner_email": user["email"],
        "shared_with_email": data.email,
        "shared_with_user_id": target_user["user_id"] if target_user else None,
        "shared_with_name": target_user["name"] if target_user else data.email,
        "permission": data.permission,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.calendar_shares.insert_one(share_doc)
    return {k: v for k, v in share_doc.items() if k != "_id"}

@api_router.get("/calendar/shares")
async def list_shares(request: Request):
    user = await get_current_user(request)
    shared_by_me = await db.calendar_shares.find(
        {"owner_user_id": user["user_id"]}, {"_id": 0}
    ).to_list(100)
    shared_with_me = await db.calendar_shares.find(
        {"shared_with_email": user["email"]}, {"_id": 0}
    ).to_list(100)
    return {"shared_by_me": shared_by_me, "shared_with_me": shared_with_me}

@api_router.delete("/calendar/shares/{share_id}")
async def revoke_share(share_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.calendar_shares.delete_one(
        {"share_id": share_id, "owner_user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Share not found")
    return {"message": "Share revoked"}

@api_router.get("/calendar/shared/{user_id}/events")
async def get_shared_events(user_id: str, request: Request):
    viewer = await get_current_user(request)
    share = await db.calendar_shares.find_one(
        {"owner_user_id": user_id, "shared_with_email": viewer["email"]}, {"_id": 0}
    )
    if not share:
        raise HTTPException(status_code=403, detail="No access to this calendar")
    events = await db.events.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    return events

# --- Reminders ---

@api_router.get("/reminders/upcoming")
async def get_upcoming_reminders(request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    window_end = (now + timedelta(hours=1)).isoformat()

    events = await db.events.find(
        {"user_id": user["user_id"], "reminder": {"$ne": None}, "start_time": {"$lte": window_end}},
        {"_id": 0}
    ).to_list(100)

    due_reminders = []
    for evt in events:
        try:
            start = datetime.fromisoformat(evt["start_time"].replace("Z", "+00:00"))
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            reminder_mins = evt.get("reminder", 0)
            if not reminder_mins:
                continue
            reminder_time = start - timedelta(minutes=reminder_mins)
            if reminder_time <= now <= start:
                due_reminders.append({
                    "event_id": evt["event_id"],
                    "title": evt["title"],
                    "start_time": evt["start_time"],
                    "reminder": reminder_mins,
                    "minutes_until": max(0, int((start - now).total_seconds() / 60))
                })
        except Exception:
            continue

    return due_reminders

# --- Recurring Booking Links ---

@api_router.post("/booking-links")
async def create_booking_link(data: RecurringBookingCreate, request: Request):
    user = await get_current_user(request)
    link_id = f"blink_{uuid.uuid4().hex[:12]}"
    link_doc = {
        "link_id": link_id,
        "user_id": user["user_id"],
        "title": data.title,
        "duration": data.duration,
        "recurrence": data.recurrence,
        "description": data.description,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.booking_links.insert_one(link_doc)
    return {k: v for k, v in link_doc.items() if k != "_id"}

@api_router.get("/booking-links")
async def list_booking_links(request: Request):
    user = await get_current_user(request)
    links = await db.booking_links.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    return links

@api_router.delete("/booking-links/{link_id}")
async def delete_booking_link(link_id: str, request: Request):
    user = await get_current_user(request)
    await db.booking_links.delete_one({"link_id": link_id, "user_id": user["user_id"]})
    return {"message": "Deleted"}

@api_router.get("/booking-links/{link_id}/public")
async def get_public_booking_link(link_id: str):
    link = await db.booking_links.find_one({"link_id": link_id, "active": True}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Booking link not found")
    host = await db.users.find_one({"user_id": link["user_id"]}, {"_id": 0, "password_hash": 0})
    return {**link, "host_name": host["name"] if host else "Unknown"}

# --- Team Workspaces ---

@api_router.post("/teams")
async def create_team(data: TeamCreate, request: Request):
    user = await get_current_user(request)
    team_id = f"team_{uuid.uuid4().hex[:12]}"
    team_doc = {
        "team_id": team_id,
        "name": data.name,
        "owner_id": user["user_id"],
        "members": [{"user_id": user["user_id"], "email": user["email"], "name": user["name"], "role": "admin"}],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.teams.insert_one(team_doc)
    return {k: v for k, v in team_doc.items() if k != "_id"}

@api_router.get("/teams")
async def list_teams(request: Request):
    user = await get_current_user(request)
    teams = await db.teams.find(
        {"members.user_id": user["user_id"]}, {"_id": 0}
    ).to_list(50)
    return teams

@api_router.post("/teams/{team_id}/invite")
async def invite_to_team(team_id: str, data: TeamInvite, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    is_admin = any(m["user_id"] == user["user_id"] and m["role"] == "admin" for m in team["members"])
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can invite")

    if any(m["email"] == data.email for m in team["members"]):
        raise HTTPException(status_code=400, detail="Already a member")

    target = await db.users.find_one({"email": data.email}, {"_id": 0, "password_hash": 0})
    member = {
        "user_id": target["user_id"] if target else None,
        "email": data.email,
        "name": target["name"] if target else data.email,
        "role": data.role
    }
    await db.teams.update_one(
        {"team_id": team_id},
        {"$push": {"members": member}}
    )
    return {"message": "Invited", "member": member}

@api_router.delete("/teams/{team_id}/members/{member_email}")
async def remove_from_team(team_id: str, member_email: str, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    is_admin = any(m["user_id"] == user["user_id"] and m["role"] == "admin" for m in team["members"])
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can remove members")
    await db.teams.update_one(
        {"team_id": team_id},
        {"$pull": {"members": {"email": member_email}}}
    )
    return {"message": "Removed"}

@api_router.get("/teams/{team_id}")
async def get_team(team_id: str, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one(
        {"team_id": team_id, "members.user_id": user["user_id"]}, {"_id": 0}
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found or no access")
    return team

# --- Stripe Subscription Plans ---

@api_router.get("/plans")
async def get_plans():
    return [{"plan_id": k, **v} for k, v in SUBSCRIPTION_PLANS.items()]

@api_router.get("/user/plan")
async def get_user_plan(request: Request):
    user = await get_current_user(request)
    full_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    plan = full_user.get("plan", "free")
    return {"plan": plan, "plan_details": SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["free"])}

class SubscriptionCheckout(BaseModel):
    plan_id: str
    origin_url: str

@api_router.post("/subscribe")
async def create_subscription(data: SubscriptionCheckout, request: Request):
    user = await get_current_user(request)

    if data.plan_id not in SUBSCRIPTION_PLANS or data.plan_id == "free":
        raise HTTPException(status_code=400, detail="Invalid plan")

    plan = SUBSCRIPTION_PLANS[data.plan_id]
    amount = plan["amount"]

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    success_url = f"{data.origin_url}/settings?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{data.origin_url}/settings?payment=cancelled"

    metadata = {
        "user_id": user["user_id"],
        "plan_id": data.plan_id,
        "user_email": user["email"],
    }

    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "plan_id": data.plan_id,
        "amount": amount,
        "currency": "usd",
        "metadata": metadata,
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/subscribe/status/{session_id}")
async def check_subscription_status(session_id: str, request: Request):
    user = await get_current_user(request)

    txn = await db.payment_transactions.find_one(
        {"session_id": session_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if txn.get("payment_status") == "paid":
        return {"status": "paid", "plan_id": txn["plan_id"]}

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    status = await stripe_checkout.get_checkout_status(session_id)

    if status.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": status.status, "paid_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"plan": txn["plan_id"]}}
        )
        return {"status": "paid", "plan_id": txn["plan_id"]}

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": status.payment_status, "status": status.status}}
    )
    return {"status": status.status, "payment_status": status.payment_status, "plan_id": txn["plan_id"]}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        host_url = str(request.base_url).rstrip("/")
        webhook_url = f"{host_url}api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        event = await stripe_checkout.handle_webhook(body, sig)

        if event.payment_status == "paid" and event.session_id:
            txn = await db.payment_transactions.find_one(
                {"session_id": event.session_id, "payment_status": {"$ne": "paid"}}, {"_id": 0}
            )
            if txn:
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"payment_status": "paid", "status": "complete", "paid_at": datetime.now(timezone.utc).isoformat()}}
                )
                await db.users.update_one(
                    {"user_id": txn["user_id"]},
                    {"$set": {"plan": txn["plan_id"]}}
                )
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")

    return {"received": True}

# --- Email Digest ---

class DigestPreference(BaseModel):
    enabled: bool

@api_router.get("/user/preferences")
async def get_user_preferences(request: Request):
    user = await get_current_user(request)
    prefs = await db.user_preferences.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not prefs:
        return {"user_id": user["user_id"], "email_digest": False}
    return prefs

@api_router.put("/user/preferences/digest")
async def update_digest_preference(data: DigestPreference, request: Request):
    user = await get_current_user(request)
    await db.user_preferences.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"user_id": user["user_id"], "email_digest": data.enabled}},
        upsert=True,
    )
    return {"user_id": user["user_id"], "email_digest": data.enabled}

@api_router.post("/digest/send")
async def send_weekly_digest(request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=7)
    week_end = now + timedelta(days=7)

    events = await db.events.find(
        {"user_id": user["user_id"], "start_time": {"$gte": week_start.isoformat(), "$lte": week_end.isoformat()}},
        {"_id": 0}
    ).to_list(100)

    tasks = await db.tasks.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    pending_tasks = [t for t in tasks if not t.get("completed")]
    completed_this_week = [t for t in tasks if t.get("completed")]

    past_events = [e for e in events if e.get("start_time", "") < now.isoformat()]
    upcoming_events = [e for e in events if e.get("start_time", "") >= now.isoformat()]

    events_html = ""
    for e in upcoming_events[:10]:
        try:
            dt = datetime.fromisoformat(e["start_time"].replace("Z", "+00:00"))
            events_html += f'<li style="margin-bottom:8px;font-size:14px"><strong>{e["title"]}</strong> &mdash; {dt.strftime("%a, %b %d at %I:%M %p")}</li>'
        except Exception:
            events_html += f'<li style="margin-bottom:8px;font-size:14px"><strong>{e["title"]}</strong></li>'

    tasks_html = ""
    for t in pending_tasks[:10]:
        tasks_html += f'<li style="margin-bottom:6px;font-size:14px">{t["title"]}</li>'

    html = f"""<div style="font-family:'DM Sans',Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:32px;background:#f8f8fc;border-radius:16px">
        <div style="background:#1e1b4b;color:#fff;padding:28px;border-radius:12px;margin-bottom:20px">
            <h1 style="font-family:'Manrope',sans-serif;margin:0 0 6px;font-size:22px">Your Weekly Digest</h1>
            <p style="color:#a5b4fc;margin:0;font-size:13px">{now.strftime('%b %d')} &mdash; {(now+timedelta(days=7)).strftime('%b %d, %Y')}</p>
        </div>
        <div style="background:#fff;padding:24px;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:16px">
            <h2 style="font-size:16px;margin:0 0 12px;color:#1e1b4b">This Week at a Glance</h2>
            <div style="display:flex;gap:16px;margin-bottom:16px">
                <div style="flex:1;text-align:center;padding:12px;background:#f1f0ff;border-radius:8px">
                    <div style="font-size:24px;font-weight:700;color:#4338ca">{len(upcoming_events)}</div>
                    <div style="font-size:12px;color:#6b7280">Upcoming</div>
                </div>
                <div style="flex:1;text-align:center;padding:12px;background:#ecfdf5;border-radius:8px">
                    <div style="font-size:24px;font-weight:700;color:#059669">{len(completed_this_week)}</div>
                    <div style="font-size:12px;color:#6b7280">Completed</div>
                </div>
                <div style="flex:1;text-align:center;padding:12px;background:#fef2f2;border-radius:8px">
                    <div style="font-size:24px;font-weight:700;color:#dc2626">{len(pending_tasks)}</div>
                    <div style="font-size:12px;color:#6b7280">Pending</div>
                </div>
            </div>
        </div>
        {"<div style='background:#fff;padding:24px;border-radius:12px;border:1px solid #e5e7eb;margin-bottom:16px'><h3 style='font-size:15px;margin:0 0 12px;color:#1e1b4b'>Upcoming Events</h3><ul style='list-style:none;padding:0;margin:0'>" + events_html + "</ul></div>" if events_html else ""}
        {"<div style='background:#fff;padding:24px;border-radius:12px;border:1px solid #e5e7eb'><h3 style='font-size:15px;margin:0 0 12px;color:#1e1b4b'>Pending Tasks</h3><ul style='list-style:none;padding:0;margin:0'>" + tasks_html + "</ul></div>" if tasks_html else ""}
        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:20px">Powered by Planora</p>
    </div>"""

    if RESEND_API_KEY:
        try:
            resend.Emails.send({
                "from": f"Planora <{SENDER_EMAIL}>",
                "to": [user["email"]],
                "subject": f"Your Planora Weekly Digest - {now.strftime('%b %d')}",
                "html": html,
            })
            return {"message": "Digest sent", "email": user["email"]}
        except Exception as e:
            logger.error(f"Digest email error: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to send: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Email service not configured")

# --- WebSocket ---

@app.websocket("/api/ws/{session_token}")
async def websocket_endpoint(websocket: WebSocket, session_token: str):
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        await websocket.close(code=4001)
        return

    user_id = session["user_id"]
    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws_manager.disconnect(user_id, websocket)

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
