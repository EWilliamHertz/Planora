#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class PlanoraTester:
    def __init__(self, base_url="https://collab-planner-12.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def test_user_registration(self):
        """Test user registration"""
        timestamp = int(datetime.now().timestamp())
        test_user = {
            "name": f"Test User {timestamp}",
            "email": f"test{timestamp}@example.com",
            "password": "TestPass123!"
        }
        
        result = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user
        )
        
        if result:
            self.session_token = result.get('session_token')
            self.user_id = result.get('user_id')
            return test_user
        return None

    def test_user_login(self, user_data):
        """Test user login"""
        if not user_data:
            self.log_test("User Login", False, "No user data from registration")
            return False
            
        login_data = {
            "email": user_data["email"],
            "password": user_data["password"]
        }
        
        result = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if result:
            self.session_token = result.get('session_token')
            self.user_id = result.get('user_id')
            return True
        return False

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        result = self.run_test(
            "Auth Me Endpoint",
            "GET",
            "auth/me",
            200
        )
        return result is not None

    def test_logout(self):
        """Test logout endpoint"""
        result = self.run_test(
            "User Logout",
            "POST",
            "auth/logout",
            200
        )
        if result:
            self.session_token = None
            self.user_id = None
        return result is not None

    def test_seed_data(self):
        """Test seed data creation"""
        result = self.run_test(
            "Seed Data Creation",
            "POST",
            "seed",
            200
        )
        return result is not None

    def test_events_crud(self):
        """Test Events CRUD operations"""
        # Test GET events (should be empty initially or have seed data)
        events = self.run_test(
            "Get Events",
            "GET",
            "events",
            200
        )
        
        if events is None:
            return False

        # Test CREATE regular event
        event_data = {
            "title": "Test Event",
            "description": "Test event description",
            "start_time": (datetime.now() + timedelta(hours=1)).isoformat(),
            "end_time": (datetime.now() + timedelta(hours=2)).isoformat(),
            "color": "indigo",
            "attendees": []
        }
        
        created_event = self.run_test(
            "Create Event",
            "POST",
            "events",
            200,
            data=event_data
        )
        
        if not created_event:
            return False
            
        event_id = created_event.get('event_id')
        
        # Test UPDATE event
        update_data = {
            "title": "Updated Test Event",
            "description": "Updated description"
        }
        
        updated_event = self.run_test(
            "Update Event",
            "PUT",
            f"events/{event_id}",
            200,
            data=update_data
        )
        
        # Test DELETE event
        self.run_test(
            "Delete Event",
            "DELETE",
            f"events/{event_id}",
            200
        )
        
        return True

    def test_recurring_events(self):
        """Test recurring events functionality"""
        # Test CREATE recurring event - daily
        daily_event_data = {
            "title": "Daily Standup Test",
            "description": "Test daily recurring event",
            "start_time": (datetime.now() + timedelta(hours=3)).isoformat(),
            "end_time": (datetime.now() + timedelta(hours=3, minutes=30)).isoformat(),
            "color": "emerald",
            "attendees": [],
            "recurrence": {
                "type": "daily",
                "end_date": (datetime.now() + timedelta(days=7)).isoformat()
            }
        }
        
        daily_event = self.run_test(
            "Create Daily Recurring Event",
            "POST",
            "events",
            200,
            data=daily_event_data
        )
        
        if not daily_event:
            return False
            
        # Verify recurrence field is stored
        if daily_event.get('recurrence', {}).get('type') != 'daily':
            self.log_test("Verify Daily Recurrence Storage", False, "Recurrence type not stored correctly")
            return False
        else:
            self.log_test("Verify Daily Recurrence Storage", True, "")

        # Test CREATE recurring event - weekly
        weekly_event_data = {
            "title": "Weekly Meeting Test",
            "description": "Test weekly recurring event",
            "start_time": (datetime.now() + timedelta(hours=4)).isoformat(),
            "end_time": (datetime.now() + timedelta(hours=5)).isoformat(),
            "color": "sky",
            "attendees": [],
            "recurrence": {
                "type": "weekly",
                "end_date": (datetime.now() + timedelta(weeks=4)).isoformat()
            }
        }
        
        weekly_event = self.run_test(
            "Create Weekly Recurring Event",
            "POST",
            "events",
            200,
            data=weekly_event_data
        )
        
        if not weekly_event:
            return False
            
        # Verify recurrence field is stored
        if weekly_event.get('recurrence', {}).get('type') != 'weekly':
            self.log_test("Verify Weekly Recurrence Storage", False, "Recurrence type not stored correctly")
            return False
        else:
            self.log_test("Verify Weekly Recurrence Storage", True, "")

        # Test CREATE recurring event - monthly
        monthly_event_data = {
            "title": "Monthly Review Test",
            "description": "Test monthly recurring event",
            "start_time": (datetime.now() + timedelta(hours=5)).isoformat(),
            "end_time": (datetime.now() + timedelta(hours=6)).isoformat(),
            "color": "violet",
            "attendees": [],
            "recurrence": {
                "type": "monthly",
                "end_date": (datetime.now() + timedelta(days=90)).isoformat()
            }
        }
        
        monthly_event = self.run_test(
            "Create Monthly Recurring Event",
            "POST",
            "events",
            200,
            data=monthly_event_data
        )
        
        if not monthly_event:
            return False
            
        # Verify recurrence field is stored
        if monthly_event.get('recurrence', {}).get('type') != 'monthly':
            self.log_test("Verify Monthly Recurrence Storage", False, "Recurrence type not stored correctly")
            return False
        else:
            self.log_test("Verify Monthly Recurrence Storage", True, "")

        # Clean up test events
        for event in [daily_event, weekly_event, monthly_event]:
            if event and event.get('event_id'):
                self.run_test(
                    f"Delete Recurring Event {event['event_id']}",
                    "DELETE",
                    f"events/{event['event_id']}",
                    200
                )
        
        return True

    def test_tasks_crud(self):
        """Test Tasks CRUD operations"""
        # Test GET tasks
        tasks = self.run_test(
            "Get Tasks",
            "GET",
            "tasks",
            200
        )
        
        if tasks is None:
            return False

        # Test CREATE task
        task_data = {
            "title": "Test Task",
            "description": "Test task description",
            "due_date": (datetime.now() + timedelta(days=1)).isoformat(),
            "completed": False
        }
        
        created_task = self.run_test(
            "Create Task",
            "POST",
            "tasks",
            200,
            data=task_data
        )
        
        if not created_task:
            return False
            
        task_id = created_task.get('task_id')
        
        # Test UPDATE task (toggle completion)
        update_data = {
            "completed": True
        }
        
        updated_task = self.run_test(
            "Update Task",
            "PUT",
            f"tasks/{task_id}",
            200,
            data=update_data
        )
        
        # Test DELETE task
        self.run_test(
            "Delete Task",
            "DELETE",
            f"tasks/{task_id}",
            200
        )
        
        return True

    def test_availability(self):
        """Test availability endpoints"""
        # Test GET availability
        availability = self.run_test(
            "Get Availability",
            "GET",
            "availability",
            200
        )
        
        if availability is None:
            return False

        # Test UPDATE availability
        schedule_data = {
            "schedule": {
                "monday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "tuesday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "wednesday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "thursday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "friday": {"enabled": True, "start": "09:00", "end": "17:00"},
                "saturday": {"enabled": False, "start": "09:00", "end": "17:00"},
                "sunday": {"enabled": False, "start": "09:00", "end": "17:00"}
            }
        }
        
        updated_availability = self.run_test(
            "Update Availability",
            "PUT",
            "availability",
            200,
            data=schedule_data
        )
        
        return updated_availability is not None

    def test_booking_endpoints(self):
        """Test booking-related endpoints"""
        if not self.user_id:
            self.log_test("Booking Tests", False, "No user_id available")
            return False

        # Test get user booking info
        user_info = self.run_test(
            "Get User Booking Info",
            "GET",
            f"bookings/user/{self.user_id}",
            200
        )
        
        if not user_info:
            return False

        # Test get available slots for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        available_slots = self.run_test(
            "Get Available Slots",
            "GET",
            f"bookings/available/{self.user_id}?date={tomorrow}",
            200
        )
        
        if available_slots is None:
            return False

        # Test create booking (if slots available)
        if available_slots and len(available_slots) > 0:
            slot = available_slots[0]
            booking_data = {
                "host_user_id": self.user_id,
                "guest_name": "Test Guest",
                "guest_email": "guest@example.com",
                "start_time": slot["start_time"],
                "end_time": slot["end_time"]
            }
            
            created_booking = self.run_test(
                "Create Booking",
                "POST",
                "bookings",
                200,
                data=booking_data
            )
            
            # Test get bookings
            bookings = self.run_test(
                "Get Bookings",
                "GET",
                "bookings",
                200
            )
        else:
            self.log_test("Create Booking", False, "No available slots to test booking creation")
            self.log_test("Get Bookings", False, "Skipped due to no booking created")

        return True

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Planora API Tests")
        print(f"📍 Testing against: {self.base_url}")
        print("=" * 60)

        # Test user registration and authentication flow
        user_data = self.test_user_registration()
        
        if user_data:
            # Test login with the same user
            self.test_user_login(user_data)
            
            # Test authenticated endpoints
            self.test_auth_me()
            self.test_seed_data()
            self.test_events_crud()
            self.test_recurring_events()
            self.test_tasks_crud()
            self.test_availability()
            self.test_booking_endpoints()
            
            # Test logout
            self.test_logout()
        else:
            print("❌ Registration failed, skipping authenticated tests")

        # Print summary
        print("=" * 60)
        print(f"📊 Tests completed: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return 1

def main():
    tester = PlanoraTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())