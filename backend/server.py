import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncpg
import resend

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Resend API Key
resend.api_key = os.environ.get("RESEND_API_KEY", "")

# Database Schema
SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS user_sessions (
    session_token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    location TEXT,
    created_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(user_id)
);

CREATE TABLE IF NOT EXISTS event_invitations (
    invitation_id TEXT PRIMARY KEY,
    event_id      TEXT NOT NULL,
    inviter_id    TEXT NOT NULL,
    guest_email   TEXT NOT NULL,
    guest_name    TEXT,
    status        TEXT DEFAULT 'pending',
    responded_at  TEXT,
    created_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_invitations_event ON event_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_invitations_guest ON event_invitations(guest_email);
"""

# Database connection pool
db_pool = None


async def init_db():
    global db_pool
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    db_pool = await asyncpg.create_pool(db_url)
    
    async with db_pool.acquire() as conn:
        await conn.execute(SCHEMA_SQL)
    
    logger.info("Database initialized")


async def close_db():
    global db_pool
    if db_pool:
        await db_pool.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


# Pydantic Models
class EventInviteRequest(BaseModel):
    guest_email: str
    guest_name: Optional[str] = None
    message: Optional[str] = None


class EventInviteResponse(BaseModel):
    invitation_id: str
    event_id: str
    guest_email: str
    status: str
    created_at: str


class UserBase(BaseModel):
    email: str
    name: str


class UserCreate(UserBase):
    password: str


class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: str
    end_time: Optional[str] = None
    location: Optional[str] = None


class EventCreate(EventBase):
    pass


class EventResponse(EventBase):
    event_id: str
    user_id: str
    created_at: str


# Email template function
def get_event_invite_html(inviter_name: str, inviter_email: str, guest_name: str, 
                          event_title: str, event_date: str, event_time: str, 
                          event_duration: int, message: Optional[str] = None,
                          rsvp_accept_link: str = "", rsvp_decline_link: str = "") -> str:
    message_html = f'<p style="font-size: 14px; color: #555; margin: 20px 0;">{message}</p>' if message else ""
    
    return f'''<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; margin: 0; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 28px; font-weight: 600; }}
            .content {{ padding: 40px; }}
            .event-card {{ background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 6px; }}
            .event-card h2 {{ margin: 0 0 15px 0; color: #667eea; font-size: 20px; }}
            .event-detail {{ display: flex; align-items: center; margin: 12px 0; font-size: 14px; color: #555; }}
            .event-detail-icon {{ margin-right: 10px; min-width: 24px; }}
            .quick-rsvp {{ display: flex; gap: 10px; justify-content: center; margin: 20px 0; flex-wrap: wrap; }}
            .rsvp-btn {{ padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px; color: white; }}
            .accept-btn {{ background: #10b981; }}
            .decline-btn {{ background: #ef4444; }}
            .footer {{ background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h1>📅 You're Invited!</h1></div>
            <div class="content">
                <p>Hi {guest_name},</p>
                <p><strong>{inviter_name}</strong> has invited you to an event.</p>
                <div class="event-card">
                    <h2>{event_title}</h2>
                    <div class="event-detail"><span class="event-detail-icon">📅</span><span>{event_date}</span></div>
                    <div class="event-detail"><span class="event-detail-icon">⏰</span><span>{event_time} ({event_duration}min)</span></div>
                </div>
                {message_html}
                <div style="text-align: center;">
                    <p style="font-weight: 600; color: #333;">Will you attend?</p>
                    <div class="quick-rsvp">
                        <a href="{rsvp_accept_link}" class="rsvp-btn accept-btn">✓ Accept</a>
                        <a href="{rsvp_decline_link}" class="rsvp-btn decline-btn">✗ Decline</a>
                    </div>
                </div>
                <p style="font-size: 12px; color: #999; margin-top: 20px;">Questions? Contact {inviter_name} at {inviter_email}</p>
            </div>
            <div class="footer"><p style="margin: 0;">Sent from <strong>Planora</strong></p></div>
        </div>
    </body>
    </html>'''


# FastAPI App
app = FastAPI(title="Planora API", lifespan=lifespan)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Event Invite Route
@app.post("/api/events/{event_id}/invite")
async def invite_to_event(event_id: str, invite: EventInviteRequest, request: Request):
    """Send an event invitation to a guest via email"""
    session_token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not session_token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    async with db_pool.acquire() as conn:
        # Get user from session
        session = await conn.fetchrow(
            'SELECT user_id FROM user_sessions WHERE session_token = $1 AND expires_at > $2', 
            session_token, 
            datetime.now(timezone.utc).isoformat()
        )
        if not session:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        user_id = session['user_id']
        
        # Get event
        event = await conn.fetchrow('SELECT * FROM events WHERE event_id = $1', event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        if event['user_id'] != user_id:
            raise HTTPException(status_code=403, detail="Cannot invite to others' events")
        
        # Get inviter details
        inviter = await conn.fetchrow('SELECT email, name FROM users WHERE user_id = $1', user_id)
        
        # Create invitation
        invitation_id = f"inv_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        
        await conn.execute(
            'INSERT INTO event_invitations (invitation_id, event_id, inviter_id, guest_email, guest_name, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            invitation_id, event_id, user_id, invite.guest_email, invite.guest_name or invite.guest_email, 'pending', now
        )
        
        # Send email via Resend
        try:
            frontend_url = os.environ.get('FRONTEND_URL', 'https://planora.app')
            rsvp_base = f"{frontend_url}/events/{event_id}/rsvp/{invitation_id}"
            
            html = get_event_invite_html(
                inviter_name=inviter['name'],
                inviter_email=inviter['email'],
                guest_name=invite.guest_name or invite.guest_email,
                event_title=event['title'],
                event_date=event['start_time'][:10],
                event_time=event['start_time'][11:16],
                event_duration=30,
                message=invite.message,
                rsvp_accept_link=f"{rsvp_base}?response=accepted",
                rsvp_decline_link=f"{rsvp_base}?response=declined"
            )
            
            resend.Emails.send({
                "From": os.environ.get('SENDER_EMAIL', 'noreply@hatake.social'),
                "To": invite.guest_email,
                "Subject": f"📅 {inviter['name']} invited you to: {event['title']}",
                "Html": html
            })
        except Exception as e:
            logger.error(f"Failed to send invite: {e}")
        
        return EventInviteResponse(
            invitation_id=invitation_id,
            event_id=event_id,
            guest_email=invite.guest_email,
            status="pending",
            created_at=now
        )


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
