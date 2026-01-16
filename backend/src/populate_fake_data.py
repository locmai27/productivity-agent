"""
Script to populate the database with fake sample data.
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from database_client import create_database_client

def populate_fake_data(user_id: str = "demo-user-123"):
    """Populate database with fake tasks and tags."""
    
    # Connect to database
    db_path = os.getenv("DB_PATH", "productivity_agent.db")
    db = create_database_client(connection_string=db_path, client_type="sqlite")
    db.connect()
    
    print(f"Populating database for user: {user_id}")
    
    # Create some tags
    tags_data = [
        {"name": "work", "color": "#3b82f6"},
        {"name": "health", "color": "#22c55e"},
        {"name": "meeting", "color": "#a855f7"},
        {"name": "important", "color": "#ef4444"},
        {"name": "personal", "color": "#f59e0b"},
        {"name": "urgent", "color": "#ec4899"},
    ]
    
    created_tags = []
    for tag_data in tags_data:
        try:
            tag = db.create_tag(tag_data)
            created_tags.append(tag)
            print(f"Created tag: {tag['name']} (id: {tag['id']})")
        except Exception as e:
            # Tag might already exist, try to get it
            all_tags = db.get_all_tags()
            existing_tag = next((t for t in all_tags if t['name'] == tag_data['name']), None)
            if existing_tag:
                created_tags.append(existing_tag)
                print(f"Tag already exists: {tag_data['name']} (id: {existing_tag['id']})")
            else:
                print(f"Error creating tag {tag_data['name']}: {e}")
    
    # Get today's date and create tasks for various dates
    today = datetime.now(timezone.utc)
    
    tasks_data = [
        {
            "user_id": user_id,
            "title": "Team standup meeting",
            "description": "Daily sync with the development team at 9:00 AM",
            "date": today.strftime("%Y-%m-%d"),
            "tags": [created_tags[0], created_tags[2]] if len(created_tags) >= 3 else [],
        },
        {
            "user_id": user_id,
            "title": "Review pull requests",
            "description": "Check and review pending PRs on GitHub",
            "date": today.strftime("%Y-%m-%d"),
            "tags": [created_tags[0], created_tags[3]] if len(created_tags) >= 4 else [],
        },
        {
            "user_id": user_id,
            "title": "Gym session",
            "description": "Morning workout at the gym",
            "date": today.strftime("%Y-%m-%d"),
            "tags": [created_tags[1]] if len(created_tags) >= 2 else [],
        },
        {
            "user_id": user_id,
            "title": "Project planning meeting",
            "description": "Quarterly planning session with stakeholders",
            "date": (today + timedelta(days=1)).strftime("%Y-%m-%d"),
            "tags": [created_tags[0], created_tags[2], created_tags[3]] if len(created_tags) >= 4 else [],
        },
        {
            "user_id": user_id,
            "title": "Doctor appointment",
            "description": "Annual checkup at 2:00 PM",
            "date": (today + timedelta(days=2)).strftime("%Y-%m-%d"),
            "tags": [created_tags[1], created_tags[4]] if len(created_tags) >= 5 else [],
        },
        {
            "user_id": user_id,
            "title": "Code review session",
            "description": "Review team member's code changes",
            "date": (today + timedelta(days=1)).strftime("%Y-%m-%d"),
            "tags": [created_tags[0]] if len(created_tags) >= 1 else [],
        },
        {
            "user_id": user_id,
            "title": "Grocery shopping",
            "description": "Buy groceries for the week",
            "date": (today + timedelta(days=3)).strftime("%Y-%m-%d"),
            "tags": [created_tags[4]] if len(created_tags) >= 5 else [],
        },
        {
            "user_id": user_id,
            "title": "Client presentation",
            "description": "Present Q1 results to client at 3:00 PM",
            "date": (today + timedelta(days=4)).strftime("%Y-%m-%d"),
            "tags": [created_tags[0], created_tags[2], created_tags[3], created_tags[5]] if len(created_tags) >= 6 else [],
        },
        {
            "user_id": user_id,
            "title": "Yoga class",
            "description": "Evening yoga session at the studio",
            "date": (today + timedelta(days=5)).strftime("%Y-%m-%d"),
            "tags": [created_tags[1], created_tags[4]] if len(created_tags) >= 5 else [],
        },
        {
            "user_id": user_id,
            "title": "Bug fix - critical issue",
            "description": "Fix critical bug reported in production",
            "date": today.strftime("%Y-%m-%d"),
            "tags": [created_tags[0], created_tags[3], created_tags[5]] if len(created_tags) >= 6 else [],
        },
        {
            "user_id": user_id,
            "title": "Write documentation",
            "description": "Document the new API endpoints",
            "date": (today + timedelta(days=2)).strftime("%Y-%m-%d"),
            "tags": [created_tags[0]] if len(created_tags) >= 1 else [],
        },
        {
            "user_id": user_id,
            "title": "Dinner with friends",
            "description": "Catch up with college friends at 7:00 PM",
            "date": (today + timedelta(days=6)).strftime("%Y-%m-%d"),
            "tags": [created_tags[4]] if len(created_tags) >= 5 else [],
        },
        {
            "user_id": user_id,
            "title": "Sprint retrospective",
            "description": "Team retrospective meeting",
            "date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
            "tags": [created_tags[0], created_tags[2]] if len(created_tags) >= 3 else [],
        },
        {
            "user_id": user_id,
            "title": "Complete project proposal",
            "description": "Finish and submit the project proposal",
            "date": (today + timedelta(days=3)).strftime("%Y-%m-%d"),
            "tags": [created_tags[0], created_tags[3]] if len(created_tags) >= 4 else [],
        },
        {
            "user_id": user_id,
            "title": "Morning run",
            "description": "5K morning run in the park",
            "date": (today + timedelta(days=1)).strftime("%Y-%m-%d"),
            "tags": [created_tags[1]] if len(created_tags) >= 2 else [],
        },
    ]
    
    # Create some completed tasks
    completed_tasks = [
        {
            "user_id": user_id,
            "title": "Submit weekly report",
            "description": "Weekly status report submitted",
            "date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
            "tags": [created_tags[0]] if len(created_tags) >= 1 else [],
            "completed": True,
        },
        {
            "user_id": user_id,
            "title": "Team lunch",
            "description": "Team lunch at the new restaurant",
            "date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
            "tags": [created_tags[0], created_tags[4]] if len(created_tags) >= 5 else [],
            "completed": True,
        },
    ]
    
    all_tasks = tasks_data + completed_tasks
    
    print(f"\nCreating {len(all_tasks)} tasks...")
    created_count = 0
    
    for task_data in all_tasks:
        try:
            # Handle completed status
            completed = task_data.pop("completed", False)
            todo = db.create_todo(task_data)
            
            # Mark as completed if needed
            if completed:
                db.mark_complete(str(todo["id"]))
            
            created_count += 1
            print(f"Created task: {todo['title']} (id: {todo['id']}, date: {todo['date']})")
        except Exception as e:
            print(f"Error creating task {task_data.get('title', 'unknown')}: {e}")
    
    print(f"\n✅ Successfully created {created_count} tasks and {len(created_tags)} tags!")
    print(f"Database populated for user: {user_id}")
    
    # Disconnect
    db.disconnect()

if __name__ == "__main__":
    # Get user_id from command line or use default
    user_id = sys.argv[1] if len(sys.argv) > 1 else "demo-user-123"
    populate_fake_data(user_id)


