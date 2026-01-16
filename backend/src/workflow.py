"""
Workflow for productivity agent with Backboard integration.

This module orchestrates the todo list agent workflow using Backboard for memory
and LLM tool calling for todo operations.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from database_client import SQLiteDatabaseClient
from backboard_client import BackboardWrapper, BackboardClientProto


class TodoAgentWorkflow:
    """Orchestrates user requests with Backboard and database operations."""
    
    def __init__(
        self,
        backboard: BackboardWrapper,
        db_client: SQLiteDatabaseClient,
        llm_provider: str = "openai",
        model_name: str = "gpt-4o-mini",
    ):
        self.backboard = backboard
        self.db = db_client
        self.llm_provider = llm_provider
        self.model_name = model_name
        self.tools = self._define_tools()
    
    def _define_tools(self) -> List[Dict[str, Any]]:
        """Define available tools for LLM to manipulate todos."""
        return [
            {
                "name": "create_todo",
                "description": "Create a new todo item",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "date": {"type": "string", "description": "ISO date string"},
                        "tags": {"type": "array", "items": {"type": "object"}},
                    },
                    "required": ["title"],
                },
            },
            {
                "name": "get_all_todos",
                "description": "Retrieve all todo items",
                "parameters": {"type": "object", "properties": {}},
            },
            {
                "name": "update_todo",
                "description": "Update an existing todo",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "todo_id": {"type": "string"},
                        "updates": {"type": "object"},
                    },
                    "required": ["todo_id", "updates"],
                },
            },
            {
                "name": "delete_todo",
                "description": "Delete a todo by ID",
                "parameters": {
                    "type": "object",
                    "properties": {"todo_id": {"type": "string"}},
                    "required": ["todo_id"],
                },
            },
            {
                "name": "mark_complete",
                "description": "Mark a todo as complete",
                "parameters": {
                    "type": "object",
                    "properties": {"todo_id": {"type": "string"}},
                    "required": ["todo_id"],
                },
            },
            {
                "name": "analyze_todos",
                "description": "Get summary statistics and insights about todos",
                "parameters": {"type": "object", "properties": {}},
            },
        ]
    
    def _execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Execute a tool call and return the result."""
        if tool_name == "create_todo":
            return self.db.create_todo(arguments)
        elif tool_name == "get_all_todos":
            return self.db.get_all_todos()
        elif tool_name == "update_todo":
            return self.db.update_todo(arguments["todo_id"], arguments["updates"])
        elif tool_name == "delete_todo":
            return self.db.delete_todo(arguments["todo_id"])
        elif tool_name == "mark_complete":
            return self.db.mark_complete(arguments["todo_id"])
        elif tool_name == "analyze_todos":
            return self._analyze_todos()
        else:
            raise ValueError(f"Unknown tool: {tool_name}")
    
    def _analyze_todos(self) -> Dict[str, Any]:
        """Analyze todos and return insights."""
        todos = self.db.get_all_todos()
        total = len(todos)
        completed = sum(1 for t in todos if t["completed"])
        pending = total - completed
        
        tags_count = {}
        for todo in todos:
            for tag in todo.get("tags", []):
                tags_count[tag["name"]] = tags_count.get(tag["name"], 0) + 1
        
        return {
            "total": total,
            "completed": completed,
            "pending": pending,
            "tags_distribution": tags_count,
        }
    
    async def process_message(
        self,
        user_id: str,
        message: str,
        *,
        remember: bool = False,
    ) -> str:
        """
        Process user message through Backboard with tool calling.
        
        Args:
            user_id: User identifier
            message: User's message
            remember: Whether to persist this interaction in long-term memory
            
        Returns:
            Assistant's response
        """
        # Ensure assistant and thread exist
        await self.backboard.start_session(user_id)
        
        # Build context with current todos
        todos = self.db.get_all_todos()
        context = f"\n\nCurrent todos: {todos}" if todos else "\n\nNo todos yet."
        
        # Prepare message with tools
        full_message = f"{message}{context}\n\nYou have access to tools to manage todos. Use them as needed."
        
        # Send to Backboard (assuming it handles tool calls internally)
        response = await self.backboard.chat(
            user_id=user_id,
            text=full_message,
            remember=remember,
            llm_provider=self.llm_provider,
            model_name=self.model_name,
            extra={"tools": self.tools},
        )
        
        return response
    
    async def process_with_tool_execution(
        self,
        user_id: str,
        message: str,
        *,
        remember: bool = False,
    ) -> str:
        """
        Process message with explicit tool execution loop.
        Use this if Backboard doesn't handle tool calls automatically.
        """
        await self.backboard.start_session(user_id)
        
        todos = self.db.get_all_todos()
        context = f"\n\nCurrent todos: {todos}" if todos else "\n\nNo todos yet."
        full_message = f"{message}{context}"
        
        # First LLM call
        response = await self.backboard.chat(
            user_id=user_id,
            text=full_message,
            remember=remember,
            llm_provider=self.llm_provider,
            model_name=self.model_name,
            extra={"tools": self.tools},
        )
        
        # TODO: Parse response for tool calls and execute them
        # This depends on your LLM's tool calling format
        # Example pseudo-code:
        # if has_tool_calls(response):
        #     results = [self._execute_tool(call.name, call.args) for call in tool_calls]
        #     final_response = await self.backboard.chat(
        #         user_id=user_id,
        #         text=f"Tool results: {results}",
        #         remember=remember,
        #     )
        #     return final_response
        
        return response


async def run_workflow(
    user_id: str,
    message: str,
    backboard_client: BackboardClientProto,
    db_path: str = "productivity_agent.db",
) -> str:
    """
    Convenience function to run the workflow.
    
    Args:
        user_id: User identifier
        message: User's message
        backboard_client: Backboard API client
        db_path: Path to SQLite database
        
    Returns:
        Assistant's response
    """
    # Initialize components
    db = SQLiteDatabaseClient(db_path)
    db.connect()
    
    backboard = BackboardWrapper(client=backboard_client, store=db)
    workflow = TodoAgentWorkflow(backboard=backboard, db_client=db)
    
    try:
        response = await workflow.process_message(user_id, message)
        return response
    finally:
        db.disconnect()

