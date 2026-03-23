"""
Phase 4 Feature Tests for Planora
- Task Categories (work, personal, urgent, health, finance)
- iCal Export endpoint
- Vercel config validation
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "sess_41114b878c1c49ed8ea66640c3c09109"
USER_ID = "user_d1396a53e00d"

@pytest.fixture
def auth_headers():
    return {
        "Authorization": f"Bearer {SESSION_TOKEN}",
        "Content-Type": "application/json"
    }


class TestTaskCategories:
    """Test task category feature - all 5 categories"""
    
    def test_create_task_with_work_category(self, auth_headers):
        """Create task with 'work' category"""
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=auth_headers,
            json={
                "title": "TEST_Work Task",
                "description": "Testing work category",
                "category": "work"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["category"] == "work", f"Expected category 'work', got {data.get('category')}"
        assert data["title"] == "TEST_Work Task"
        assert "task_id" in data
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{data['task_id']}", headers=auth_headers)
    
    def test_create_task_with_personal_category(self, auth_headers):
        """Create task with 'personal' category"""
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=auth_headers,
            json={
                "title": "TEST_Personal Task",
                "description": "Testing personal category",
                "category": "personal"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "personal"
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{data['task_id']}", headers=auth_headers)
    
    def test_create_task_with_urgent_category(self, auth_headers):
        """Create task with 'urgent' category"""
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=auth_headers,
            json={
                "title": "TEST_Urgent Task",
                "description": "Testing urgent category",
                "category": "urgent"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "urgent"
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{data['task_id']}", headers=auth_headers)
    
    def test_create_task_with_health_category(self, auth_headers):
        """Create task with 'health' category"""
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=auth_headers,
            json={
                "title": "TEST_Health Task",
                "description": "Testing health category",
                "category": "health"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "health"
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{data['task_id']}", headers=auth_headers)
    
    def test_create_task_with_finance_category(self, auth_headers):
        """Create task with 'finance' category"""
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=auth_headers,
            json={
                "title": "TEST_Finance Task",
                "description": "Testing finance category",
                "category": "finance"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "finance"
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{data['task_id']}", headers=auth_headers)
    
    def test_create_task_without_category(self, auth_headers):
        """Create task without category (should be null)"""
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=auth_headers,
            json={
                "title": "TEST_No Category Task",
                "description": "Testing no category"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["category"] is None, f"Expected category None, got {data.get('category')}"
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{data['task_id']}", headers=auth_headers)
    
    def test_update_task_category(self, auth_headers):
        """Create task and update its category"""
        # Create task with work category
        create_response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=auth_headers,
            json={
                "title": "TEST_Update Category Task",
                "category": "work"
            }
        )
        assert create_response.status_code == 200
        task_id = create_response.json()["task_id"]
        
        # Update to urgent category
        update_response = requests.put(
            f"{BASE_URL}/api/tasks/{task_id}",
            headers=auth_headers,
            json={"category": "urgent"}
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["category"] == "urgent", f"Expected 'urgent', got {data.get('category')}"
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/tasks", headers=auth_headers)
        tasks = get_response.json()
        updated_task = next((t for t in tasks if t["task_id"] == task_id), None)
        assert updated_task is not None
        assert updated_task["category"] == "urgent"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{task_id}", headers=auth_headers)
    
    def test_list_tasks_returns_list(self, auth_headers):
        """Verify GET /api/tasks returns a list of tasks"""
        response = requests.get(f"{BASE_URL}/api/tasks", headers=auth_headers)
        assert response.status_code == 200
        tasks = response.json()
        assert isinstance(tasks, list)
        # Note: Old tasks created before category feature may not have category field
        # New tasks created with category will have the field


class TestICalExport:
    """Test iCal export endpoint"""
    
    def test_ical_export_returns_valid_content(self, auth_headers):
        """Test /api/export/ical returns valid iCal content"""
        response = requests.get(f"{BASE_URL}/api/export/ical", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "text/calendar" in content_type, f"Expected text/calendar, got {content_type}"
        
        # Check content disposition (file download)
        content_disp = response.headers.get("content-disposition", "")
        assert "attachment" in content_disp, f"Expected attachment header, got {content_disp}"
        assert ".ics" in content_disp, f"Expected .ics filename, got {content_disp}"
    
    def test_ical_export_has_vcalendar_structure(self, auth_headers):
        """Test iCal content has proper VCALENDAR structure"""
        response = requests.get(f"{BASE_URL}/api/export/ical", headers=auth_headers)
        assert response.status_code == 200
        
        content = response.text
        assert "BEGIN:VCALENDAR" in content, "Missing BEGIN:VCALENDAR"
        assert "END:VCALENDAR" in content, "Missing END:VCALENDAR"
        assert "VERSION:2.0" in content, "Missing VERSION:2.0"
        assert "PRODID:" in content, "Missing PRODID"
    
    def test_ical_export_has_vevent(self, auth_headers):
        """Test iCal content has VEVENT entries"""
        response = requests.get(f"{BASE_URL}/api/export/ical", headers=auth_headers)
        assert response.status_code == 200
        
        content = response.text
        assert "BEGIN:VEVENT" in content, "Missing BEGIN:VEVENT"
        assert "END:VEVENT" in content, "Missing END:VEVENT"
        assert "DTSTART:" in content, "Missing DTSTART"
        assert "DTEND:" in content, "Missing DTEND"
        assert "SUMMARY:" in content, "Missing SUMMARY"
        assert "UID:" in content, "Missing UID"
    
    def test_ical_export_has_rrule_for_recurring(self, auth_headers):
        """Test iCal content has RRULE for recurring events"""
        response = requests.get(f"{BASE_URL}/api/export/ical", headers=auth_headers)
        assert response.status_code == 200
        
        content = response.text
        # Seed data has daily and weekly recurring events
        assert "RRULE:FREQ=" in content, "Missing RRULE for recurring events"
        # Check for DAILY or WEEKLY frequency
        has_daily = "FREQ=DAILY" in content
        has_weekly = "FREQ=WEEKLY" in content
        assert has_daily or has_weekly, "Expected DAILY or WEEKLY recurrence rule"
    
    def test_ical_export_has_attendees(self, auth_headers):
        """Test iCal content has ATTENDEE entries"""
        response = requests.get(f"{BASE_URL}/api/export/ical", headers=auth_headers)
        assert response.status_code == 200
        
        content = response.text
        # Seed data has events with attendees
        assert "ATTENDEE;" in content, "Missing ATTENDEE entries"
        assert "mailto:" in content, "Missing mailto: in ATTENDEE"
    
    def test_ical_export_requires_auth(self):
        """Test iCal export requires authentication"""
        response = requests.get(f"{BASE_URL}/api/export/ical")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"


class TestVercelConfig:
    """Test Vercel configuration file"""
    
    def test_vercel_json_exists(self):
        """Verify vercel.json exists"""
        vercel_path = "/app/frontend/vercel.json"
        assert os.path.exists(vercel_path), f"vercel.json not found at {vercel_path}"
    
    def test_vercel_json_valid_structure(self):
        """Verify vercel.json has correct structure"""
        with open("/app/frontend/vercel.json", "r") as f:
            config = json.load(f)
        
        # Check required fields
        assert "buildCommand" in config, "Missing buildCommand"
        assert config["buildCommand"] == "yarn build", f"Expected 'yarn build', got {config['buildCommand']}"
        
        assert "outputDirectory" in config, "Missing outputDirectory"
        assert config["outputDirectory"] == "build", f"Expected 'build', got {config['outputDirectory']}"
        
        assert "framework" in config, "Missing framework"
        assert config["framework"] == "create-react-app"
    
    def test_vercel_json_has_rewrites(self):
        """Verify vercel.json has SPA rewrites"""
        with open("/app/frontend/vercel.json", "r") as f:
            config = json.load(f)
        
        assert "rewrites" in config, "Missing rewrites"
        assert isinstance(config["rewrites"], list), "rewrites should be a list"
        assert len(config["rewrites"]) > 0, "rewrites should not be empty"
        
        # Check for SPA rewrite rule
        spa_rewrite = config["rewrites"][0]
        assert "source" in spa_rewrite, "Missing source in rewrite"
        assert "destination" in spa_rewrite, "Missing destination in rewrite"
        assert spa_rewrite["destination"] == "/index.html", "SPA should redirect to /index.html"
    
    def test_vercel_json_has_headers(self):
        """Verify vercel.json has service worker headers"""
        with open("/app/frontend/vercel.json", "r") as f:
            config = json.load(f)
        
        assert "headers" in config, "Missing headers"
        assert isinstance(config["headers"], list), "headers should be a list"
        
        # Check for service worker header
        sw_header = next((h for h in config["headers"] if "/service-worker.js" in h.get("source", "")), None)
        assert sw_header is not None, "Missing service-worker.js header config"
        
        # Check header values
        header_keys = [h["key"] for h in sw_header.get("headers", [])]
        assert "Cache-Control" in header_keys, "Missing Cache-Control header for service worker"
        assert "Service-Worker-Allowed" in header_keys, "Missing Service-Worker-Allowed header"


class TestNewTasksHaveCategory:
    """Verify newly created tasks have category field"""
    
    def test_new_task_category_persists(self, auth_headers):
        """Create task with category and verify it persists in GET"""
        # Create task with category
        create_response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=auth_headers,
            json={
                "title": "TEST_Category Persistence",
                "category": "health"
            }
        )
        assert create_response.status_code == 200
        task_id = create_response.json()["task_id"]
        
        # Verify category persists in list
        list_response = requests.get(f"{BASE_URL}/api/tasks", headers=auth_headers)
        tasks = list_response.json()
        created_task = next((t for t in tasks if t["task_id"] == task_id), None)
        
        assert created_task is not None, "Created task not found in list"
        assert created_task.get("category") == "health", f"Category not persisted, got {created_task.get('category')}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/tasks/{task_id}", headers=auth_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
