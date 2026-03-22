from fastapi import FastAPI, APIRouter, HTTPException, Response, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

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
    recurrence: Optional[Dict] = None  # {type: "none"|"daily"|"weekly"|"monthly", end_date: "ISO"}

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    color: Optional[str] = None
    attendees: Optional[List[Dict]] = None
    recurrence: Optional[Dict] = None

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    due_date: Optional[str] = None
    completed: Optional[bool] = False

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    completed: Optional[bool] = None

class AvailabilityUpdate(BaseModel):
    schedule: Dict

class BookingCreate(BaseModel):
    host_user_id: str
    guest_name: str
    guest_email: str
    start_time: str
    end_time: str

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
        "picture": user.get("picture")
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tasks.insert_one(task_doc)
    return {k: v for k, v in task_doc.items() if k != "_id"}

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
    return task

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.tasks.delete_one(
        {"task_id": task_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
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
        return {"user_id": user["user_id"], "schedule": default_schedule}
    return availability

@api_router.put("/availability")
async def update_availability(data: AvailabilityUpdate, request: Request):
    user = await get_current_user(request)
    await db.availability.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"schedule": data.schedule, "user_id": user["user_id"]}},
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
    if not availability:
        schedule = {}
        for day in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
            schedule[day] = {"enabled": True, "start": "09:00", "end": "17:00"}
        for day in ["saturday", "sunday"]:
            schedule[day] = {"enabled": False, "start": "09:00", "end": "17:00"}
    else:
        schedule = availability["schedule"]

    target_date = datetime.fromisoformat(date).date()
    day_name = target_date.strftime("%A").lower()

    day_schedule = schedule.get(day_name)
    if not day_schedule or not day_schedule.get("enabled"):
        return []

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

    while current + timedelta(minutes=30) <= end:
        slot_start = current.isoformat()
        slot_end = (current + timedelta(minutes=30)).isoformat()

        is_available = True
        for item in existing_events + existing_bookings:
            if item.get("start_time", "") < slot_end and item.get("end_time", "") > slot_start:
                is_available = False
                break

        if is_available:
            slots.append({"start_time": slot_start, "end_time": slot_end})

        current += timedelta(minutes=30)

    return slots

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
        "created_at": datetime.now(timezone.utc).isoformat()
    })

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

    existing_events = await db.events.count_documents({"user_id": user_id})
    if existing_events > 0:
        return {"message": "Data already exists"}

    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    events = [
        {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "title": "Team Standup",
            "description": "Daily team sync - discuss progress and blockers",
            "start_time": (today + timedelta(hours=9)).isoformat(),
            "end_time": (today + timedelta(hours=9, minutes=30)).isoformat(),
            "color": "indigo",
            "recurrence": {"type": "daily", "end_date": (today + timedelta(days=30)).isoformat()},
            "attendees": [
                {"name": "Sarah Chen", "email": "sarah@example.com", "status": "accepted",
                 "avatar": "https://images.pexels.com/photos/30004324/pexels-photo-30004324.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"},
                {"name": "Alex Kim", "email": "alex@example.com", "status": "accepted",
                 "avatar": "https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHw0fHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NDE4NTI4Mnww&ixlib=rb-4.1.0&q=85"}
            ],
            "created_at": now.isoformat()
        },
        {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "title": "Client Meeting",
            "description": "Q1 strategy review with Acme Corp",
            "start_time": (today + timedelta(days=1, hours=14)).isoformat(),
            "end_time": (today + timedelta(days=1, hours=15)).isoformat(),
            "color": "emerald",
            "attendees": [
                {"name": "Jordan Lee", "email": "jordan@acme.com", "status": "accepted",
                 "avatar": "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NDE4NTI4Mnww&ixlib=rb-4.1.0&q=85"},
                {"name": "Morgan Patel", "email": "morgan@acme.com", "status": "pending"}
            ],
            "created_at": now.isoformat()
        },
        {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "title": "Product Review",
            "description": "Sprint demo and feedback session",
            "start_time": (today + timedelta(days=2, hours=10)).isoformat(),
            "end_time": (today + timedelta(days=2, hours=11, minutes=30)).isoformat(),
            "color": "amber",
            "attendees": [
                {"name": "Sarah Chen", "email": "sarah@example.com", "status": "accepted",
                 "avatar": "https://images.pexels.com/photos/30004324/pexels-photo-30004324.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"},
                {"name": "Alex Kim", "email": "alex@example.com", "status": "declined",
                 "avatar": "https://images.unsplash.com/photo-1762522926157-bcc04bf0b10a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHw0fHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NDE4NTI4Mnww&ixlib=rb-4.1.0&q=85"},
                {"name": "Jordan Lee", "email": "jordan@acme.com", "status": "pending",
                 "avatar": "https://images.unsplash.com/photo-1576558656222-ba66febe3dec?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdCUyMHBvcnRyYWl0fGVufDB8fHx8MTc3NDE4NTI4Mnww&ixlib=rb-4.1.0&q=85"}
            ],
            "created_at": now.isoformat()
        },
        {
            "event_id": f"evt_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "title": "1:1 with Sarah",
            "description": "Weekly check-in and career development",
            "start_time": (today + timedelta(hours=15)).isoformat(),
            "end_time": (today + timedelta(hours=15, minutes=30)).isoformat(),
            "color": "sky",
            "recurrence": {"type": "weekly", "end_date": (today + timedelta(days=60)).isoformat()},
            "attendees": [
                {"name": "Sarah Chen", "email": "sarah@example.com", "status": "accepted",
                 "avatar": "https://images.pexels.com/photos/30004324/pexels-photo-30004324.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"}
            ],
            "created_at": now.isoformat()
        }
    ]

    tasks = [
        {
            "task_id": f"task_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "title": "Prepare Q4 report",
            "description": "Compile sales figures and growth metrics for quarterly review",
            "due_date": (today + timedelta(days=1, hours=17)).isoformat(),
            "completed": False,
            "created_at": now.isoformat()
        },
        {
            "task_id": f"task_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "title": "Review PR #142",
            "description": "Code review for the new authentication module",
            "due_date": (today + timedelta(hours=12)).isoformat(),
            "completed": True,
            "created_at": now.isoformat()
        },
        {
            "task_id": f"task_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "title": "Update design specs",
            "description": "Sync Figma designs with latest requirements from product",
            "due_date": (today + timedelta(days=3, hours=17)).isoformat(),
            "completed": False,
            "created_at": now.isoformat()
        },
        {
            "task_id": f"task_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "title": "Send client proposal",
            "description": "Draft and send the Q2 engagement proposal to Acme Corp",
            "due_date": (today - timedelta(days=1)).isoformat(),
            "completed": False,
            "created_at": now.isoformat()
        },
        {
            "task_id": f"task_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "title": "Team building planning",
            "description": "Organize team outing for next month - research venues",
            "due_date": (today + timedelta(days=5, hours=17)).isoformat(),
            "completed": True,
            "created_at": now.isoformat()
        }
    ]

    default_schedule = {}
    for day in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
        default_schedule[day] = {"enabled": True, "start": "09:00", "end": "17:00"}
    for day in ["saturday", "sunday"]:
        default_schedule[day] = {"enabled": False, "start": "09:00", "end": "17:00"}

    await db.events.insert_many(events)
    await db.tasks.insert_many(tasks)
    await db.availability.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "schedule": default_schedule}},
        upsert=True
    )

    return {"message": "Seed data created"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
