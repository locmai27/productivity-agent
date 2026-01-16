"""
Workflow for productivity agent with Backboard integration.

This module orchestrates the todo list agent workflow using Backboard for memory
and LLM tool calling for todo operations.
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import re
import os
import json
from database_client import SQLiteDatabaseClient
from backboard_client import BackboardWrapper, BackboardClientProto


class TodoAgentWorkflow:
    """Orchestrates user requests with Backboard and database operations."""
    
    def __init__(
        self,
        backboard: BackboardWrapper,
        db_client: SQLiteDatabaseClient,
        llm_provider: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        self.backboard = backboard
        self.db = db_client
        # If None, we let Backboard use its own defaults / configured providers
        self.llm_provider = llm_provider or None
        self.model_name = model_name or None
        self.tools = self._define_tools()
    
    def _define_tools(self) -> List[Dict[str, Any]]:
        """Define available tools for LLM to manipulate todos."""
        return [
            {
                "name": "create_todo",
                "description": (
                    "Create a new calendar task for the user. "
                    "Use ISO date format (YYYY-MM-DD) for `date`. "
                    "Tags are objects with `name` and `color` (hex)."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string", "description": "Short task title"},
                        "description": {"type": "string", "description": "Optional details or time range"},
                        "date": {"type": "string", "description": "ISO date string (YYYY-MM-DD)"},
                        "tags": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "color": {"type": "string", "description": "Hex color, e.g. #3b82f6"},
                                },
                            },
                        },
                    },
                    "required": ["title"],
                },
            },
            {
                "name": "get_all_todos",
                "description": "List all tasks for the current user (useful before edits).",
                "parameters": {"type": "object", "properties": {}},
            },
            {
                "name": "update_todo",
                "description": "Update an existing task by ID (title/description/date/tags/completed).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "todo_id": {"type": "string", "description": "Task ID to update"},
                        "updates": {
                            "type": "object",
                            "description": "Fields to update",
                            "properties": {
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "date": {"type": "string", "description": "YYYY-MM-DD"},
                                "completed": {"type": "boolean"},
                                "tags": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "name": {"type": "string"},
                                            "color": {"type": "string"},
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "required": ["todo_id", "updates"],
                },
            },
            {
                "name": "delete_todo",
                "description": "Delete a task by ID (permanent).",
                "parameters": {
                    "type": "object",
                    "properties": {"todo_id": {"type": "string"}},
                    "required": ["todo_id"],
                },
            },
            {
                "name": "mark_complete",
                "description": "Mark a task as completed by ID.",
                "parameters": {
                    "type": "object",
                    "properties": {"todo_id": {"type": "string"}},
                    "required": ["todo_id"],
                },
            },
            {
                "name": "analyze_todos",
                "description": "Get summary stats about the user's tasks (counts, tag distribution).",
                "parameters": {"type": "object", "properties": {}},
            },
        ]
    
    def _execute_tool(self, user_id: str, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Execute a tool call and return the result."""
        if tool_name == "create_todo":
            arguments = dict(arguments)
            arguments["user_id"] = user_id
            if not arguments.get("date"):
                arguments["date"] = datetime.now().strftime("%Y-%m-%d")
            return self.db.create_todo(arguments)
        elif tool_name == "get_all_todos":
            return self.db.get_all_todos(user_id=user_id)
        elif tool_name == "update_todo":
            todo = self.db.get_todo(arguments["todo_id"])
            if not todo or todo.get("user_id") != user_id:
                return {"error": "unauthorized_or_not_found"}
            return self.db.update_todo(arguments["todo_id"], arguments["updates"])
        elif tool_name == "delete_todo":
            todo = self.db.get_todo(arguments["todo_id"])
            if not todo or todo.get("user_id") != user_id:
                return {"error": "unauthorized_or_not_found"}
            return self.db.delete_todo(arguments["todo_id"])
        elif tool_name == "mark_complete":
            todo = self.db.get_todo(arguments["todo_id"])
            if not todo or todo.get("user_id") != user_id:
                return {"error": "unauthorized_or_not_found"}
            return self.db.mark_complete(arguments["todo_id"])
        elif tool_name == "analyze_todos":
            return self._analyze_todos(user_id=user_id)
        else:
            raise ValueError(f"Unknown tool: {tool_name}")

    def _extract_tool_calls(self, resp: Dict[str, Any]) -> Tuple[Optional[str], List[Dict[str, Any]]]:
        """
        Normalize tool calls from various formats.
        Returns (run_id, calls) where calls items are {tool_call_id, name, arguments_dict}.
        """
        run_id = resp.get("run_id")
        calls_raw = resp.get("tool_calls") or []
        calls: List[Dict[str, Any]] = []

        for c in calls_raw:
            if not isinstance(c, dict):
                continue
            tool_call_id = c.get("tool_call_id") or c.get("id") or c.get("toolCallId")
            name = c.get("name")
            args = c.get("arguments")

            # OpenAI-ish: {id, function:{name, arguments:"{...json...}"}}
            if not name and isinstance(c.get("function"), dict):
                name = c["function"].get("name")
                args = c["function"].get("arguments")

            # Args may be JSON string
            args_dict: Dict[str, Any] = {}
            if isinstance(args, dict):
                args_dict = args
            elif isinstance(args, str) and args.strip():
                try:
                    args_dict = json.loads(args)
                except Exception:
                    args_dict = {"raw": args}

            if tool_call_id and name:
                calls.append({"tool_call_id": str(tool_call_id), "name": str(name), "arguments": args_dict})

        return run_id, calls
    
    def _analyze_todos(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Analyze todos and return insights."""
        todos = self.db.get_all_todos(user_id=user_id) if user_id else self.db.get_all_todos()
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
        progress_cb: Optional[Any] = None,
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
        # Ensure assistant and thread exist (and push latest prompt/tools)
        merge_prompt = os.getenv("BACKBOARD_MERGE_PROMPT", "true").lower() in {"1", "true", "yes"}
        if merge_prompt:
            # Use a minimal system prompt on the assistant and include full instructions in the message.
            await self.backboard.ensure_assistant(user_id, tools=self.tools, system_prompt="")
        else:
            await self.backboard.ensure_assistant(user_id, tools=self.tools)
        await self.backboard.start_session(user_id)
        
        # Build context with current todos + uploaded docs (so the model knows it can use them)
        todos = self.db.get_all_todos(user_id=user_id)
        context = f"\n\nCurrent todos: {todos}" if todos else "\n\nNo todos yet."

        try:
            thread_id = await self.backboard.get_thread_id(user_id)
            docs = await self.backboard.client.list_thread_documents(thread_id)
            if docs:
                doc_lines = []
                for d in docs:
                    doc_lines.append(
                        f"- {d.get('filename','(file)')} (status={d.get('status')}, summary={d.get('summary','')})"
                    )
                context += "\n\nUploaded documents available in this thread:\n" + "\n".join(doc_lines)
        except Exception:
            # Non-fatal
            pass
        
        # ReAct-style loop (explicit Thought -> Action -> Observation -> Final)
        tools_text = json.dumps(self.tools, ensure_ascii=True)
        debug_prompt = os.getenv("BACKBOARD_DEBUG_PROMPT", "true").lower() in {"1", "true", "yes"}
        scratchpad = ""

        if progress_cb:
            progress_cb("Thinking...")

        for step in range(5):
            react_instructions = (
                "You are a ReAct agent. Use tools when needed.\n"
                "Respond ONLY with a single JSON object using one of the forms:\n"
                "Single action:\n"
                '{"thought":"...","action":"create_todo|update_todo|delete_todo|mark_complete|get_all_todos|analyze_todos|final",'
                '"action_input":{... or null},"final":"..."}\n'
                "Multiple actions:\n"
                '{"thought":"...","actions":[{"action":"create_todo|update_todo|delete_todo|mark_complete|get_all_todos|analyze_todos",'
                '"action_input":{...}}, ...], "final":"..."}\n'
                "If action is final, set action_input to null and put the user-facing response in final."
            )

            if merge_prompt:
                full_message = (
                    f"{self.backboard.defaults.system_prompt}\n\n"
                    f"User: {message}{context}\n\n"
                    f"TOOLS_SCHEMA:\n{tools_text}\n\n"
                    f"{react_instructions}\n\n"
                    f"SCRATCHPAD:\n{scratchpad}"
                )
            else:
                full_message = (
                    f"User: {message}{context}\n\n"
                    f"TOOLS_SCHEMA:\n{tools_text}\n\n"
                    f"{react_instructions}\n\n"
                    f"SCRATCHPAD:\n{scratchpad}"
                )

            if debug_prompt:
                print(f"[workflow] step={step} full_message:\n{full_message}")
                print(f"[workflow] tools_sent={len(self.tools)} tools={self.tools}")

            resp = await self.backboard.chat_raw(
                user_id=user_id,
                text=full_message,
                remember=remember,
                llm_provider=self.llm_provider,
                model_name=self.model_name,
                extra={},
            )

            content = resp.get("content") if isinstance(resp, dict) else str(resp)
            parsed = self._parse_react_json(content)
            if not parsed:
                return content

            thought = parsed.get("thought", "")

            if parsed.get("action") == "final":
                return parsed.get("final") or content

            # Normalize to a list of actions
            actions = []
            if isinstance(parsed.get("actions"), list):
                actions = parsed["actions"]
            elif parsed.get("action"):
                actions = [{"action": parsed.get("action"), "action_input": parsed.get("action_input") or {}}]

            if progress_cb:
                progress_cb(f"Step {step + 1}: {thought}")

            for act in actions:
                action = act.get("action")
                action_input = act.get("action_input") or {}
                if not action:
                    continue

                if progress_cb:
                    progress_cb(f"Calling tool: {action} with {json.dumps(action_input, default=str)}")

                try:
                    result = self._execute_tool(user_id, action, action_input)
                except Exception as e:
                    result = {"error": str(e)}

                if progress_cb:
                    progress_cb(f"Observation: {json.dumps(result, default=str)}")
                    if action in {"create_todo", "update_todo", "delete_todo", "mark_complete"}:
                        progress_cb("__CALENDAR_UPDATED__")

                scratchpad += (
                    f"\nThought: {thought}\n"
                    f"Action: {action}\n"
                    f"Action Input: {json.dumps(action_input, default=str)}\n"
                    f"Observation: {json.dumps(result, default=str)}\n"
                )

        return "I couldn't complete the request within the allowed steps. Please try again."

    def _parse_react_json(self, content: Optional[str]) -> Optional[Dict[str, Any]]:
        """
        Parse a single JSON object with keys: thought, action, action_input, final.
        """
        if not content:
            return None
        cleaned = content.strip()
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            return None
        try:
            payload = json.loads(match.group(0))
        except Exception:
            payload = None
        if not isinstance(payload, dict):
            payload = None
        if payload and ("action" in payload or "actions" in payload):
            return payload

        # Fallback: parse action blocks with a permissive regex
        actions: List[Dict[str, Any]] = []
        for m in re.finditer(
            r"\{[^{}]*\"action\"\s*:\s*\"(?P<action>[^\"]+)\"[^{}]*"
            r"\"action_input\"\s*:\s*(?P<input>\{[^{}]*\})[^{}]*\}",
            cleaned,
            flags=re.DOTALL,
        ):
            action = m.group("action")
            raw_input = m.group("input")
            try:
                action_input = json.loads(raw_input)
            except Exception:
                action_input = {}
            actions.append({"action": action, "action_input": action_input})

        # Last-resort: delete_todo with a list of todo_id values
        if not actions and "delete_todo" in cleaned:
            ids = re.findall(r"\"todo_id\"\s*:\s*\"([^\"]+)\"", cleaned)
            actions = [{"action": "delete_todo", "action_input": {"todo_id": tid}} for tid in ids]

        if not actions:
            return None

        thought_match = re.search(r"\"thought\"\s*:\s*\"(.*?)\"", cleaned, re.DOTALL)
        final_match = re.search(r"\"final\"\s*:\s*\"(.*?)\"", cleaned, re.DOTALL)
        return {
            "thought": thought_match.group(1) if thought_match else "",
            "actions": actions,
            "final": final_match.group(1) if final_match else "",
        }
    
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
        
        todos = self.db.get_all_todos(user_id=user_id)
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

