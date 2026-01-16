"""
Database client for productivity agent/todo list.

This module provides a client interface for interacting with the database
to store and retrieve todos and related data.
"""

import sqlite3
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from abc import ABC, abstractmethod


class DatabaseClient(ABC):
    """
    Abstract base class for database client.
    
    This class defines the interface for interacting with the database.
    """
    
    def __init__(
        self,
        connection_string: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize the database client.
        
        Args:
            connection_string: Database connection string
            **kwargs: Additional configuration parameters
        """
        self.connection_string = connection_string
        self.config = kwargs
    
    @abstractmethod
    def connect(self) -> None:
        """
        Establish connection to the database.
        """
        pass
    
    @abstractmethod
    def disconnect(self) -> None:
        """
        Close the database connection.
        """
        pass
    
    @abstractmethod
    def create_todo(self, todo: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new todo item.
        
        Args:
            todo: Dictionary containing todo data (title, description, etc.)
            
        Returns:
            Created todo dictionary with ID
        """
        pass
    
    @abstractmethod
    def get_todo(self, todo_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a todo by ID.
        
        Args:
            todo_id: Unique identifier for the todo
            
        Returns:
            Todo dictionary or None if not found
        """
        pass
    
    @abstractmethod
    def get_all_todos(self) -> List[Dict[str, Any]]:
        """
        Retrieve all todos.
        
        Returns:
            List of todo dictionaries
        """
        pass
    
    @abstractmethod
    def update_todo(self, todo_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Update an existing todo.
        
        Args:
            todo_id: Unique identifier for the todo
            updates: Dictionary containing fields to update
            
        Returns:
            Updated todo dictionary or None if not found
        """
        pass
    
    @abstractmethod
    def delete_todo(self, todo_id: str) -> bool:
        """
        Delete a todo by ID.
        
        Args:
            todo_id: Unique identifier for the todo
            
        Returns:
            True if deleted, False if not found
        """
        pass
    
    @abstractmethod
    def mark_complete(self, todo_id: str) -> Optional[Dict[str, Any]]:
        """
        Mark a todo as complete.
        
        Args:
            todo_id: Unique identifier for the todo
            
        Returns:
            Updated todo dictionary or None if not found
        """
        pass
    
    @abstractmethod
    def create_tag(self, tag: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new tag."""
        pass
    
    @abstractmethod
    def get_all_tags(self) -> List[Dict[str, Any]]:
        """Retrieve all tags."""
        pass
    
    @abstractmethod
    def delete_tag(self, tag_id: int) -> bool:
        """Delete a tag by ID."""
        pass
    
    @abstractmethod
    def get_assistant_id(self, user_id: str) -> Optional[str]:
        """Get assistant_id for user."""
        pass
    
    @abstractmethod
    def set_assistant_id(self, user_id: str, assistant_id: str) -> None:
        """Set assistant_id for user."""
        pass
    
    @abstractmethod
    def get_active_thread(self, user_id: str) -> Optional[Tuple[str, datetime]]:
        """Get active thread for user."""
        pass
    
    @abstractmethod
    def set_active_thread(self, user_id: str, thread_id: str, expires_at: datetime) -> None:
        """Set active thread for user."""
        pass
    
    @abstractmethod
    def clear_active_thread(self, user_id: str) -> None:
        """Clear active thread for user."""
        pass


class SQLiteDatabaseClient(DatabaseClient):
    """
    Concrete implementation of database client using SQLite.
    
    TODO: Implement actual SQLite integration.
    """
    
    def __init__(
        self,
        connection_string: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize the SQLite database client.
        
        Args:
            connection_string: Path to SQLite database file
            **kwargs: Additional configuration
        """
        super().__init__(connection_string, **kwargs)
        self.connection = None
        self.db_path = connection_string or "productivity_agent.db"
    
    def connect(self) -> None:
        """Establish connection to SQLite database."""
        self.connection = sqlite3.connect(self.db_path)
        self.connection.row_factory = sqlite3.Row
        self._create_tables()
    
    def _create_tables(self) -> None:
        """Create database tables if they don't exist."""
        cursor = self.connection.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                completed BOOLEAN DEFAULT 0,
                date TEXT,
                created_at TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                color TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS todo_tags (
                todo_id INTEGER,
                tag_id INTEGER,
                PRIMARY KEY (todo_id, tag_id),
                FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS backboard_assistants (
                user_id TEXT PRIMARY KEY,
                assistant_id TEXT NOT NULL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS backboard_threads (
                user_id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
        """)
        
        self.connection.commit()
    
    def disconnect(self) -> None:
        """Close the SQLite database connection."""
        if self.connection:
            self.connection.close()
    
    def create_todo(self, todo: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new todo item."""
        cursor = self.connection.cursor()
        cursor.execute(
            "INSERT INTO todos (title, description, completed, date, created_at) VALUES (?, ?, ?, ?, ?)",
            (todo.get('title'), todo.get('description'), False, todo.get('date'), datetime.now(timezone.utc).isoformat())
        )
        todo_id = cursor.lastrowid
        
        # Handle tags
        if 'tags' in todo:
            for tag in todo['tags']:
                tag_id = tag.get('id') or self._get_or_create_tag(tag['name'], tag['color'])
                cursor.execute("INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)", (todo_id, tag_id))
        
        self.connection.commit()
        return self.get_todo(str(todo_id))
    
    def _get_or_create_tag(self, name: str, color: str) -> int:
        """Get existing tag or create new one."""
        cursor = self.connection.cursor()
        cursor.execute("SELECT id FROM tags WHERE name = ?", (name,))
        row = cursor.fetchone()
        if row:
            return row['id']
        cursor.execute("INSERT INTO tags (name, color) VALUES (?, ?)", (name, color))
        return cursor.lastrowid
    
    def get_todo(self, todo_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a todo by ID."""
        cursor = self.connection.cursor()
        cursor.execute("SELECT * FROM todos WHERE id = ?", (todo_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        todo = dict(row)
        todo['tags'] = self._get_todo_tags(int(todo_id))
        return todo
    
    def _get_todo_tags(self, todo_id: int) -> List[Dict[str, Any]]:
        """Get all tags for a todo."""
        cursor = self.connection.cursor()
        cursor.execute("""
            SELECT t.id, t.name, t.color
            FROM tags t
            JOIN todo_tags tt ON t.id = tt.tag_id
            WHERE tt.todo_id = ?
        """, (todo_id,))
        return [dict(row) for row in cursor.fetchall()]
    
    def get_all_todos(self) -> List[Dict[str, Any]]:
        """Retrieve all todos."""
        cursor = self.connection.cursor()
        cursor.execute("SELECT * FROM todos ORDER BY created_at DESC")
        todos = [dict(row) for row in cursor.fetchall()]
        for todo in todos:
            todo['tags'] = self._get_todo_tags(todo['id'])
        return todos
    
    def update_todo(self, todo_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing todo."""
        cursor = self.connection.cursor()
        
        # Handle tags separately
        tags = updates.pop('tags', None)
        
        if updates:
            set_clause = ", ".join([f"{key} = ?" for key in updates.keys()])
            values = list(updates.values()) + [todo_id]
            cursor.execute(f"UPDATE todos SET {set_clause} WHERE id = ?", values)
        
        if tags is not None:
            cursor.execute("DELETE FROM todo_tags WHERE todo_id = ?", (todo_id,))
            for tag in tags:
                tag_id = tag.get('id') or self._get_or_create_tag(tag['name'], tag['color'])
                cursor.execute("INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?)", (todo_id, tag_id))
        
        self.connection.commit()
        return self.get_todo(todo_id)
    
    def delete_todo(self, todo_id: str) -> bool:
        """Delete a todo by ID."""
        cursor = self.connection.cursor()
        cursor.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        self.connection.commit()
        return cursor.rowcount > 0
    
    def mark_complete(self, todo_id: str) -> Optional[Dict[str, Any]]:
        """Mark a todo as complete."""
        return self.update_todo(todo_id, {"completed": True})
    
    def create_tag(self, tag: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new tag."""
        cursor = self.connection.cursor()
        cursor.execute("INSERT INTO tags (name, color) VALUES (?, ?)", (tag['name'], tag['color']))
        tag_id = cursor.lastrowid
        self.connection.commit()
        return {"id": tag_id, "name": tag['name'], "color": tag['color']}
    
    def get_all_tags(self) -> List[Dict[str, Any]]:
        """Retrieve all tags."""
        cursor = self.connection.cursor()
        cursor.execute("SELECT * FROM tags ORDER BY name")
        return [dict(row) for row in cursor.fetchall()]
    
    def delete_tag(self, tag_id: int) -> bool:
        """Delete a tag by ID."""
        cursor = self.connection.cursor()
        cursor.execute("DELETE FROM tags WHERE id = ?", (tag_id,))
        self.connection.commit()
        return cursor.rowcount > 0
    
    def get_assistant_id(self, user_id: str) -> Optional[str]:
        """Get assistant_id for user."""
        cursor = self.connection.cursor()
        cursor.execute("SELECT assistant_id FROM backboard_assistants WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        return row['assistant_id'] if row else None
    
    def set_assistant_id(self, user_id: str, assistant_id: str) -> None:
        """Set assistant_id for user."""
        cursor = self.connection.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO backboard_assistants (user_id, assistant_id) VALUES (?, ?)",
            (user_id, assistant_id)
        )
        self.connection.commit()
    
    def get_active_thread(self, user_id: str) -> Optional[Tuple[str, datetime]]:
        """Get active thread for user."""
        cursor = self.connection.cursor()
        cursor.execute("SELECT thread_id, expires_at FROM backboard_threads WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        expires_at = datetime.fromisoformat(row['expires_at'])
        if datetime.now(timezone.utc) >= expires_at:
            self.clear_active_thread(user_id)
            return None
        
        return (row['thread_id'], expires_at)
    
    def set_active_thread(self, user_id: str, thread_id: str, expires_at: datetime) -> None:
        """Set active thread for user."""
        cursor = self.connection.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO backboard_threads (user_id, thread_id, expires_at) VALUES (?, ?, ?)",
            (user_id, thread_id, expires_at.isoformat())
        )
        self.connection.commit()
    
    def clear_active_thread(self, user_id: str) -> None:
        """Clear active thread for user."""
        cursor = self.connection.cursor()
        cursor.execute("DELETE FROM backboard_threads WHERE user_id = ?", (user_id,))
        self.connection.commit()


def create_database_client(
    connection_string: Optional[str] = None,
    client_type: str = "sqlite",
    **kwargs
) -> DatabaseClient:
    """
    Factory function to create a database client instance.
    
    Args:
        connection_string: Database connection string
        client_type: Type of database client ("sqlite", "postgresql", etc.)
        **kwargs: Additional configuration
        
    Returns:
        Configured DatabaseClient instance
    """
    if client_type == "sqlite":
        return SQLiteDatabaseClient(connection_string=connection_string, **kwargs)
    else:
        raise ValueError(f"Unsupported database client type: {client_type}")

