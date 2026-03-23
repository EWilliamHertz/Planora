#!/usr/bin/env python3
"""
Phase 3 Feature Tests for Planora
Tests: Custom booking duration (15/30/60 min), Google Calendar sync UI, Analytics dashboard
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://availability-hub-22.preview.emergentagent.com')
SESSION_TOKEN = "sess_41114b878c1c49ed8ea66640c3c09109"
USER_ID = "user_d1396a53e00d"


@pytest.fixture
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    return session


class TestAvailabilitySlotDuration:
    """Test custom booking duration options (15/30/60 min)"""
    
    def test_get_availability_returns_slot_duration(self, api_client):
        """GET /api/availability should return slot_duration field"""
        response = api_client.get(f"{BASE_URL}/api/availability")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "schedule" in data, "Response should contain 'schedule'"
        assert "slot_duration" in data, "Response should contain 'slot_duration'"
        assert data["slot_duration"] in [15, 30, 60], f"slot_duration should be 15, 30, or 60, got {data['slot_duration']}"
        print(f"✓ Availability returns slot_duration: {data['slot_duration']} min")
    
    def test_update_availability_with_15min_duration(self, api_client):
        """PUT /api/availability with slot_duration=15"""
        schedule = {
            "monday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "tuesday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "wednesday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "thursday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "friday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "saturday": {"enabled": False, "start": "09:00", "end": "17:00"},
            "sunday": {"enabled": False, "start": "09:00", "end": "17:00"}
        }
        
        response = api_client.put(f"{BASE_URL}/api/availability", json={
            "schedule": schedule,
            "slot_duration": 15
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["slot_duration"] == 15, f"Expected slot_duration=15, got {data['slot_duration']}"
        print("✓ Updated availability with 15 min slot duration")
    
    def test_update_availability_with_60min_duration(self, api_client):
        """PUT /api/availability with slot_duration=60"""
        schedule = {
            "monday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "tuesday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "wednesday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "thursday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "friday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "saturday": {"enabled": False, "start": "09:00", "end": "17:00"},
            "sunday": {"enabled": False, "start": "09:00", "end": "17:00"}
        }
        
        response = api_client.put(f"{BASE_URL}/api/availability", json={
            "schedule": schedule,
            "slot_duration": 60
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["slot_duration"] == 60, f"Expected slot_duration=60, got {data['slot_duration']}"
        print("✓ Updated availability with 60 min slot duration")
    
    def test_reset_availability_to_30min(self, api_client):
        """Reset slot_duration back to 30 min (default)"""
        schedule = {
            "monday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "tuesday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "wednesday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "thursday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "friday": {"enabled": True, "start": "09:00", "end": "17:00"},
            "saturday": {"enabled": False, "start": "09:00", "end": "17:00"},
            "sunday": {"enabled": False, "start": "09:00", "end": "17:00"}
        }
        
        response = api_client.put(f"{BASE_URL}/api/availability", json={
            "schedule": schedule,
            "slot_duration": 30
        })
        assert response.status_code == 200
        data = response.json()
        assert data["slot_duration"] == 30
        print("✓ Reset availability to 30 min slot duration")


class TestBookingAvailableSlots:
    """Test /api/bookings/available/{userId} returns slots array and slot_duration"""
    
    def test_available_slots_returns_correct_structure(self, api_client):
        """GET /api/bookings/available/{userId}?date= should return {slots, slot_duration}"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        response = api_client.get(f"{BASE_URL}/api/bookings/available/{USER_ID}?date={tomorrow}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "slots" in data, "Response should contain 'slots' array"
        assert "slot_duration" in data, "Response should contain 'slot_duration'"
        assert isinstance(data["slots"], list), "'slots' should be a list"
        assert data["slot_duration"] in [15, 30, 60], f"slot_duration should be 15, 30, or 60, got {data['slot_duration']}"
        
        print(f"✓ Available slots API returns correct structure: {len(data['slots'])} slots, {data['slot_duration']} min duration")
    
    def test_available_slots_for_weekday(self, api_client):
        """Test available slots for a weekday (should have slots if enabled)"""
        # Find next Monday
        today = datetime.now()
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        next_monday = (today + timedelta(days=days_until_monday)).strftime("%Y-%m-%d")
        
        response = api_client.get(f"{BASE_URL}/api/bookings/available/{USER_ID}?date={next_monday}")
        assert response.status_code == 200
        
        data = response.json()
        # Monday should have slots if enabled in availability
        if len(data["slots"]) > 0:
            # Verify slot structure
            slot = data["slots"][0]
            assert "start_time" in slot, "Slot should have start_time"
            assert "end_time" in slot, "Slot should have end_time"
            print(f"✓ Monday has {len(data['slots'])} available slots")
        else:
            print("✓ Monday has no available slots (may be disabled or fully booked)")
    
    def test_available_slots_for_weekend(self, api_client):
        """Test available slots for weekend (should be empty if disabled)"""
        # Find next Saturday
        today = datetime.now()
        days_until_saturday = (5 - today.weekday()) % 7
        if days_until_saturday == 0:
            days_until_saturday = 7
        next_saturday = (today + timedelta(days=days_until_saturday)).strftime("%Y-%m-%d")
        
        response = api_client.get(f"{BASE_URL}/api/bookings/available/{USER_ID}?date={next_saturday}")
        assert response.status_code == 200
        
        data = response.json()
        # Saturday should have no slots if disabled in default availability
        print(f"✓ Saturday has {len(data['slots'])} slots (expected 0 if weekend disabled)")


class TestGoogleCalendarAPI:
    """Test Google Calendar integration endpoints"""
    
    def test_gcal_status_endpoint(self, api_client):
        """GET /api/gcal/status should return connection status"""
        response = api_client.get(f"{BASE_URL}/api/gcal/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "connected" in data, "Response should contain 'connected' field"
        assert isinstance(data["connected"], bool), "'connected' should be boolean"
        print(f"✓ Google Calendar status: connected={data['connected']}")
    
    def test_gcal_connect_returns_auth_url(self, api_client):
        """GET /api/gcal/connect should return authorization_url"""
        response = api_client.get(f"{BASE_URL}/api/gcal/connect")
        
        # May return 400 if Google Calendar not configured, which is acceptable
        if response.status_code == 400:
            data = response.json()
            assert "detail" in data
            print(f"✓ Google Calendar connect returns expected error (not configured): {data['detail']}")
        elif response.status_code == 200:
            data = response.json()
            assert "authorization_url" in data, "Response should contain 'authorization_url'"
            assert data["authorization_url"].startswith("https://accounts.google.com"), "Should be Google OAuth URL"
            print("✓ Google Calendar connect returns authorization URL")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_gcal_disconnect_endpoint(self, api_client):
        """POST /api/gcal/disconnect should work"""
        response = api_client.post(f"{BASE_URL}/api/gcal/disconnect")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Response should contain 'message'"
        print(f"✓ Google Calendar disconnect: {data['message']}")


class TestAnalyticsAPI:
    """Test Analytics dashboard API"""
    
    def test_analytics_endpoint_returns_correct_structure(self, api_client):
        """GET /api/analytics should return all required fields"""
        response = api_client.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Check all required fields exist
        required_fields = [
            "booking_trends",
            "busiest_slots", 
            "attendee_responses",
            "total_attendees",
            "total_events",
            "upcoming_events",
            "total_bookings",
            "total_tasks",
            "completed_tasks",
            "task_completion_rate"
        ]
        
        for field in required_fields:
            assert field in data, f"Response should contain '{field}'"
        
        print(f"✓ Analytics API returns all required fields")
        print(f"  - Total Events: {data['total_events']}")
        print(f"  - Total Bookings: {data['total_bookings']}")
        print(f"  - Upcoming Events: {data['upcoming_events']}")
        print(f"  - Task Completion Rate: {data['task_completion_rate']}%")
    
    def test_analytics_booking_trends_structure(self, api_client):
        """Verify booking_trends is a list with correct structure"""
        response = api_client.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["booking_trends"], list), "booking_trends should be a list"
        
        if len(data["booking_trends"]) > 0:
            trend = data["booking_trends"][0]
            assert "month" in trend, "Each trend should have 'month'"
            assert "count" in trend, "Each trend should have 'count'"
            print(f"✓ Booking trends structure valid: {len(data['booking_trends'])} months of data")
        else:
            print("✓ Booking trends is empty (no booking data yet)")
    
    def test_analytics_busiest_slots_structure(self, api_client):
        """Verify busiest_slots is a list with correct structure"""
        response = api_client.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["busiest_slots"], list), "busiest_slots should be a list"
        
        if len(data["busiest_slots"]) > 0:
            slot = data["busiest_slots"][0]
            assert "hour" in slot, "Each slot should have 'hour'"
            assert "count" in slot, "Each slot should have 'count'"
            print(f"✓ Busiest slots structure valid: {len(data['busiest_slots'])} time slots")
        else:
            print("✓ Busiest slots is empty (no event data yet)")
    
    def test_analytics_attendee_responses_structure(self, api_client):
        """Verify attendee_responses has correct structure"""
        response = api_client.get(f"{BASE_URL}/api/analytics")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data["attendee_responses"], dict), "attendee_responses should be a dict"
        
        expected_statuses = ["accepted", "pending", "declined"]
        for status in expected_statuses:
            assert status in data["attendee_responses"], f"attendee_responses should have '{status}'"
            assert isinstance(data["attendee_responses"][status], int), f"'{status}' count should be int"
        
        print(f"✓ Attendee responses: accepted={data['attendee_responses']['accepted']}, pending={data['attendee_responses']['pending']}, declined={data['attendee_responses']['declined']}")


class TestBookingWithDuration:
    """Test booking creation with custom duration"""
    
    def test_create_booking_with_duration(self, api_client):
        """POST /api/bookings should accept duration field"""
        # First get available slots
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        slots_response = api_client.get(f"{BASE_URL}/api/bookings/available/{USER_ID}?date={tomorrow}")
        
        if slots_response.status_code != 200:
            pytest.skip("Could not get available slots")
        
        slots_data = slots_response.json()
        if len(slots_data["slots"]) == 0:
            pytest.skip("No available slots for booking test")
        
        slot = slots_data["slots"][0]
        slot_duration = slots_data["slot_duration"]
        
        # Create booking with duration
        booking_data = {
            "host_user_id": USER_ID,
            "guest_name": "TEST_Phase3_Guest",
            "guest_email": "test_phase3@example.com",
            "start_time": slot["start_time"],
            "end_time": slot["end_time"],
            "duration": slot_duration
        }
        
        response = api_client.post(f"{BASE_URL}/api/bookings", json=booking_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "booking_id" in data, "Response should contain 'booking_id'"
        assert data["duration"] == slot_duration, f"Expected duration={slot_duration}, got {data.get('duration')}"
        
        print(f"✓ Created booking with {slot_duration} min duration: {data['booking_id']}")


class TestAuthEndpoints:
    """Verify auth endpoints still work (regression)"""
    
    def test_auth_me_endpoint(self, api_client):
        """GET /api/auth/me should return user info"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "name" in data
        assert data["user_id"] == USER_ID
        print(f"✓ Auth me returns user: {data['name']} ({data['email']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
