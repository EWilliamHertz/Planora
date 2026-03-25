"""
Test Session Persistence Fix - Vercel Cookie Bug
Tests the fix for events disappearing on page refresh due to cross-origin 3rd-party cookies being blocked.
The fix: store session_token in localStorage and use Authorization: Bearer header for all API calls.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://collab-planner-12.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "testvercel@planora.com"
TEST_PASSWORD = "test123"


class TestSessionPersistenceFix:
    """Tests for the session persistence bug fix"""
    
    @pytest.fixture(scope="class")
    def session_data(self):
        """Login and get session token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data
    
    def test_login_returns_session_token_in_json(self, session_data):
        """Verify login endpoint returns session_token in JSON response body"""
        assert "session_token" in session_data, "session_token not in login response"
        assert session_data["session_token"].startswith("sess_"), "session_token should start with 'sess_'"
        assert len(session_data["session_token"]) > 20, "session_token should be a valid length"
        print(f"✓ Login returns session_token: {session_data['session_token'][:20]}...")
    
    def test_login_returns_user_data(self, session_data):
        """Verify login returns user data along with session token"""
        assert "user_id" in session_data, "user_id not in login response"
        assert "email" in session_data, "email not in login response"
        assert "name" in session_data, "name not in login response"
        assert session_data["email"] == TEST_EMAIL, "Email mismatch"
        print(f"✓ Login returns user data: {session_data['email']}")
    
    def test_auth_me_with_bearer_token(self, session_data):
        """Verify /api/auth/me works with Bearer token authentication"""
        token = session_data["session_token"]
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"/api/auth/me failed: {response.text}"
        data = response.json()
        assert data["email"] == TEST_EMAIL, "Email mismatch in /api/auth/me"
        assert data["user_id"] == session_data["user_id"], "user_id mismatch"
        print(f"✓ /api/auth/me works with Bearer token: {data['email']}")
    
    def test_auth_me_without_token_returns_401(self):
        """Verify /api/auth/me returns 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/auth/me returns 401 without token")
    
    def test_create_event_with_bearer_token(self, session_data):
        """Verify event creation works with Bearer token"""
        token = session_data["session_token"]
        event_data = {
            "title": "TEST_Session_Persistence_Event",
            "description": "Testing session persistence fix",
            "start_time": "2026-01-20T14:00:00Z",
            "end_time": "2026-01-20T15:00:00Z",
            "color": "emerald"
        }
        response = requests.post(
            f"{BASE_URL}/api/events",
            json=event_data,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
        )
        assert response.status_code == 200, f"Event creation failed: {response.text}"
        data = response.json()
        assert data["title"] == event_data["title"], "Event title mismatch"
        assert "event_id" in data, "event_id not in response"
        # Store event_id for cleanup
        session_data["test_event_id"] = data["event_id"]
        print(f"✓ Event created with Bearer token: {data['event_id']}")
    
    def test_get_events_with_bearer_token(self, session_data):
        """Verify getting events works with Bearer token (simulates page reload)"""
        token = session_data["session_token"]
        response = requests.get(
            f"{BASE_URL}/api/events",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get events failed: {response.text}"
        events = response.json()
        assert isinstance(events, list), "Events should be a list"
        # Check if our test event is in the list
        test_event = next((e for e in events if e.get("title") == "TEST_Session_Persistence_Event"), None)
        assert test_event is not None, "Test event not found after 'page reload' simulation"
        print(f"✓ Events persist after simulated page reload: {len(events)} events found")
    
    def test_events_without_token_returns_401(self):
        """Verify /api/events returns 401 without authentication"""
        response = requests.get(f"{BASE_URL}/api/events")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ /api/events returns 401 without token")
    
    def test_tasks_with_bearer_token(self, session_data):
        """Verify tasks API works with Bearer token"""
        token = session_data["session_token"]
        response = requests.get(
            f"{BASE_URL}/api/tasks",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get tasks failed: {response.text}"
        tasks = response.json()
        assert isinstance(tasks, list), "Tasks should be a list"
        print(f"✓ Tasks API works with Bearer token: {len(tasks)} tasks found")
    
    def test_availability_with_bearer_token(self, session_data):
        """Verify availability API works with Bearer token"""
        token = session_data["session_token"]
        response = requests.get(
            f"{BASE_URL}/api/availability",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get availability failed: {response.text}"
        data = response.json()
        assert "schedule" in data, "schedule not in availability response"
        print("✓ Availability API works with Bearer token")
    
    def test_analytics_with_bearer_token(self, session_data):
        """Verify analytics API works with Bearer token"""
        token = session_data["session_token"]
        response = requests.get(
            f"{BASE_URL}/api/analytics",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Get analytics failed: {response.text}"
        data = response.json()
        assert "total_events" in data, "total_events not in analytics response"
        print("✓ Analytics API works with Bearer token")
    
    def test_cleanup_test_event(self, session_data):
        """Cleanup: Delete test event"""
        if "test_event_id" in session_data:
            token = session_data["session_token"]
            response = requests.delete(
                f"{BASE_URL}/api/events/{session_data['test_event_id']}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200, f"Event deletion failed: {response.text}"
            print(f"✓ Test event cleaned up: {session_data['test_event_id']}")


class TestBearerTokenVsCookie:
    """Tests to verify Bearer token takes precedence and works without cookies"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get a fresh session token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        return response.json()["session_token"]
    
    def test_bearer_token_works_without_cookies(self, auth_token):
        """Verify Bearer token works even when no cookies are sent"""
        # Create a new session without cookies
        session = requests.Session()
        session.cookies.clear()
        
        response = session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Bearer token should work without cookies: {response.text}"
        print("✓ Bearer token works without cookies (simulates cross-origin scenario)")
    
    def test_multiple_api_calls_with_same_token(self, auth_token):
        """Verify multiple API calls work with the same token (simulates user session)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Call 1: Get user info
        r1 = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert r1.status_code == 200, "First API call failed"
        
        # Call 2: Get events
        r2 = requests.get(f"{BASE_URL}/api/events", headers=headers)
        assert r2.status_code == 200, "Second API call failed"
        
        # Call 3: Get tasks
        r3 = requests.get(f"{BASE_URL}/api/tasks", headers=headers)
        assert r3.status_code == 200, "Third API call failed"
        
        # Call 4: Get availability
        r4 = requests.get(f"{BASE_URL}/api/availability", headers=headers)
        assert r4.status_code == 200, "Fourth API call failed"
        
        print("✓ Multiple API calls work with same Bearer token")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
