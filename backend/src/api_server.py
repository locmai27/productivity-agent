"""
Flask API server for productivity agent frontend.
"""

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from database_client import SQLiteDatabaseClient, create_database_client
from typing import Dict, Any, List
import os
import threading

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Database path (absolute, so api + websocket share the same DB)
_default_db_path = os.path.join(os.path.dirname(__file__), "productivity_agent.db")
db_path = os.getenv("DB_PATH", _default_db_path)

# Thread-local storage for database connections
_local = threading.local()

def get_db():
    """Get database client for current thread."""
    if not hasattr(_local, 'db_client'):
        _local.db_client = create_database_client(connection_string=db_path, client_type="sqlite")
        _local.db_client.connect()
    return _local.db_client

@app.teardown_appcontext
def close_db(error):
    """Close database connection when request ends."""
    if hasattr(_local, 'db_client'):
        _local.db_client.disconnect()
        delattr(_local, 'db_client')


def convert_todo_to_task(todo: Dict[str, Any]) -> Dict[str, Any]:
    """Convert backend todo format to frontend task format."""
    return {
        "id": str(todo["id"]),
        "title": todo["title"],
        "description": todo.get("description", "") or "",
        "completed": bool(todo.get("completed", False)),
        "date": todo.get("date", ""),
        "tags": [{"id": str(tag["id"]), "name": tag["name"], "color": tag["color"]} for tag in todo.get("tags", [])],
        "reminders": []  # TODO: Add reminders support
    }


def convert_task_to_todo(task: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """Convert frontend task format to backend todo format."""
    return {
        "user_id": user_id,
        "title": task["title"],
        "description": task.get("description", ""),
        "date": task.get("date", ""),
        "tags": task.get("tags", [])
    }


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    """Get all tasks for the authenticated user."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Missing user ID"}), 401
    
    db = get_db()
    todos = db.get_all_todos(user_id=user_id)
    tasks = [convert_todo_to_task(todo) for todo in todos]
    return jsonify(tasks)


@app.route("/api/tasks", methods=["POST"])
def create_task():
    """Create a new task."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Missing user ID"}), 401
    
    data = request.json
    todo_data = convert_task_to_todo(data, user_id)
    db = get_db()
    todo = db.create_todo(todo_data)
    task = convert_todo_to_task(todo)
    return jsonify(task), 201


@app.route("/api/tasks/<task_id>", methods=["PUT"])
def update_task(task_id: str):
    """Update an existing task."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Missing user ID"}), 401
    
    db = get_db()
    # Verify task belongs to user
    todo = db.get_todo(task_id)
    if not todo:
        return jsonify({"error": "Task not found"}), 404
    
    if todo.get("user_id") != user_id:
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.json
    updates = {
        "title": data.get("title"),
        "description": data.get("description", ""),
        "completed": data.get("completed", False),
        "date": data.get("date", ""),
        "tags": data.get("tags", [])
    }
    
    updated_todo = db.update_todo(task_id, updates)
    if not updated_todo:
        return jsonify({"error": "Failed to update task"}), 500
    
    task = convert_todo_to_task(updated_todo)
    return jsonify(task)


@app.route("/api/tasks/<task_id>", methods=["DELETE"])
def delete_task(task_id: str):
    """Delete a task."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Missing user ID"}), 401
    
    db = get_db()
    # Verify task belongs to user
    todo = db.get_todo(task_id)
    if not todo:
        return jsonify({"error": "Task not found"}), 404
    
    if todo.get("user_id") != user_id:
        return jsonify({"error": "Unauthorized"}), 403
    
    success = db.delete_todo(task_id)
    if success:
        return jsonify({"success": True}), 200
    else:
        return jsonify({"error": "Failed to delete task"}), 500


@app.route("/api/tasks/<task_id>/toggle", methods=["POST"])
def toggle_task(task_id: str):
    """Toggle task completion status."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Missing user ID"}), 401
    
    db = get_db()
    # Verify task belongs to user
    todo = db.get_todo(task_id)
    if not todo:
        return jsonify({"error": "Task not found"}), 404
    
    if todo.get("user_id") != user_id:
        return jsonify({"error": "Unauthorized"}), 403
    
    updated_todo = db.mark_complete(task_id)
    if not updated_todo:
        return jsonify({"error": "Failed to toggle task"}), 500
    
    task = convert_todo_to_task(updated_todo)
    return jsonify(task)


@app.route("/api/tags", methods=["GET"])
def get_tags():
    """Get all tags for the authenticated user."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Missing user ID"}), 401
    
    db = get_db()
    tags = db.get_all_tags()
    # Convert to frontend format
    frontend_tags = [{"id": str(tag["id"]), "name": tag["name"], "color": tag["color"]} for tag in tags]
    return jsonify(frontend_tags)


@app.route("/api/tags", methods=["POST"])
def create_tag():
    """Create a new tag."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Missing user ID"}), 401
    
    data = request.json
    tag_data = {
        "name": data["name"],
        "color": data.get("color", "#3b82f6")
    }
    db = get_db()
    tag = db.create_tag(tag_data)
    return jsonify({"id": str(tag["id"]), "name": tag["name"], "color": tag["color"]}), 201


@app.route("/api/tags/<tag_id>", methods=["DELETE"])
def delete_tag(tag_id: str):
    """Delete a tag."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        return jsonify({"error": "Missing user ID"}), 401
    
    db = get_db()
    success = db.delete_tag(int(tag_id))
    if success:
        return jsonify({"success": True}), 200
    else:
        return jsonify({"error": "Failed to delete tag"}), 500


@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

