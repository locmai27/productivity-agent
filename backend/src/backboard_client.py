"""
Backboard client wrapper for managing user assistants and sessions.

This module provides a wrapper around the Backboard API client to manage:
- Long-term user assistants (memory + permanent documents)
- Temporary session threads (chat + temporary documents)
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Protocol, Tuple


# ---------------------------
# Storage interface
# ---------------------------

class BackboardStore(Protocol):
    """Persist ONLY ids + session metadata (not the memory text)."""

    def get_assistant_id(self, user_id: str) -> Optional[str]: ...
    def set_assistant_id(self, user_id: str, assistant_id: str) -> None: ...
    def get_active_thread(self, user_id: str) -> Optional[Tuple[str, datetime]]: ...
    def set_active_thread(self, user_id: str, thread_id: str, expires_at: datetime) -> None: ...
    def clear_active_thread(self, user_id: str) -> None: ...


# ---------------------------
# In-memory store implementation
# ---------------------------

class InMemoryBackboardStore:
    def __init__(self) -> None:
        self._assistant_by_user: Dict[str, str] = {}
        self._thread_by_user: Dict[str, Tuple[str, datetime]] = {}

    def get_assistant_id(self, user_id: str) -> Optional[str]:
        return self._assistant_by_user.get(user_id)

    def set_assistant_id(self, user_id: str, assistant_id: str) -> None:
        self._assistant_by_user[user_id] = assistant_id

    def get_active_thread(self, user_id: str) -> Optional[Tuple[str, datetime]]:
        rec = self._thread_by_user.get(user_id)
        if not rec:
            return None
        thread_id, expires_at = rec
        if datetime.now(timezone.utc) >= expires_at:
            self._thread_by_user.pop(user_id, None)
            return None
        return rec

    def set_active_thread(self, user_id: str, thread_id: str, expires_at: datetime) -> None:
        self._thread_by_user[user_id] = (thread_id, expires_at)

    def clear_active_thread(self, user_id: str) -> None:
        self._thread_by_user.pop(user_id, None)


# ---------------------------
# Backboard client protocol
# ---------------------------

class BackboardClientProto(Protocol):
    async def create_assistant(self, **kwargs) -> Any: ...
    async def create_thread(self, assistant_id: str, **kwargs) -> Any: ...
    async def add_message(self, **kwargs) -> Any: ...
    async def delete_thread(self, thread_id: str, **kwargs) -> Any: ...
    async def add_memory(self, **kwargs) -> Any: ...
    async def upload_document_to_assistant(self, **kwargs) -> Any: ...
    async def upload_document_to_thread(self, **kwargs) -> Any: ...


# ---------------------------
# Configuration
# ---------------------------

@dataclass(frozen=True)
class BackboardDefaults:
    system_prompt: str = "You are a helpful assistant. Be concise."
    assistant_name_prefix: str = "user"
    session_ttl_minutes: int = 120
    default_memory_mode: str = "Readonly"


# ---------------------------
# Wrapper class
# ---------------------------

class BackboardWrapper:
    """
    Manages user assistants (long-term) and session threads (temporary).
    
    Pattern:
      - assistant_id per user (long-term profile: memory + permanent docs)
      - thread_id per session (temporary chat + temporary docs; delete on end)
    """

    def __init__(
        self,
        client: BackboardClientProto,
        store: BackboardStore,
        defaults: BackboardDefaults = BackboardDefaults(),
    ) -> None:
        self.client = client
        self.store = store
        self.defaults = defaults

    async def ensure_assistant(
        self,
        user_id: str,
        *,
        system_prompt: Optional[str] = None,
        name: Optional[str] = None,
        embedding_provider: Optional[str] = None,
        embedding_model_name: Optional[str] = None,
        embedding_dims: Optional[int] = None,
    ) -> str:
        existing = self.store.get_assistant_id(user_id)
        if existing:
            return existing

        assistant_kwargs: Dict[str, Any] = {
            "name": name or f"{self.defaults.assistant_name_prefix}-{user_id}",
            "system_prompt": system_prompt or self.defaults.system_prompt,
        }
        if embedding_provider:
            assistant_kwargs["embedding_provider"] = embedding_provider
        if embedding_model_name:
            assistant_kwargs["embedding_model_name"] = embedding_model_name
        if embedding_dims:
            assistant_kwargs["embedding_dims"] = embedding_dims

        assistant = await self.client.create_assistant(**assistant_kwargs)
        assistant_id = getattr(assistant, "assistant_id", None) or assistant["assistant_id"]
        self.store.set_assistant_id(user_id, assistant_id)
        return assistant_id

    async def remember(
        self,
        user_id: str,
        fact: str,
        *,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        assistant_id = await self.ensure_assistant(user_id)
        await self.client.add_memory(
            assistant_id=assistant_id,
            content=fact,
            metadata=metadata or {},
        )

    async def upload_permanent_doc(self, user_id: str, file_path: str) -> Any:
        assistant_id = await self.ensure_assistant(user_id)
        return await self.client.upload_document_to_assistant(
            assistant_id=assistant_id,
            file_path=file_path,
        )

    async def start_session(
        self,
        user_id: str,
        *,
        ttl_minutes: Optional[int] = None,
        force_new: bool = False,
    ) -> str:
        if not force_new:
            active = self.store.get_active_thread(user_id)
            if active:
                return active[0]

        assistant_id = await self.ensure_assistant(user_id)
        thread = await self.client.create_thread(assistant_id)

        thread_id = getattr(thread, "thread_id", None) or thread["thread_id"]
        ttl = ttl_minutes if ttl_minutes is not None else self.defaults.session_ttl_minutes
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl)
        self.store.set_active_thread(user_id, thread_id, expires_at)
        return thread_id

    def get_session_thread_id(self, user_id: str) -> Optional[str]:
        active = self.store.get_active_thread(user_id)
        return active[0] if active else None

    async def upload_session_doc(self, user_id: str, file_path: str) -> Any:
        thread_id = await self.start_session(user_id)
        return await self.client.upload_document_to_thread(
            thread_id=thread_id,
            file_path=file_path,
        )

    async def chat(
        self,
        user_id: str,
        text: str,
        *,
        remember: bool = False,
        memory_mode: Optional[str] = None,
        llm_provider: Optional[str] = None,
        model_name: Optional[str] = None,
        stream: bool = False,
        extra: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Send a chat message. Defaults to Readonly memory mode.
        Set remember=True or memory_mode="Auto" to persist memories.
        """
        thread_id = await self.start_session(user_id)

        if memory_mode is not None:
            memory = memory_mode
        else:
            memory = "Auto" if remember else self.defaults.default_memory_mode

        payload: Dict[str, Any] = {
            "thread_id": thread_id,
            "content": text,
            "memory": memory,
            "stream": stream,
        }
        if llm_provider:
            payload["llm_provider"] = llm_provider
        if model_name:
            payload["model_name"] = model_name
        if extra:
            payload.update(extra)

        resp = await self.client.add_message(**payload)
        return getattr(resp, "content", None) or resp["content"]

    async def end_session(self, user_id: str, *, delete_thread: bool = True) -> None:
        active = self.store.get_active_thread(user_id)
        if not active:
            return
        thread_id, _expires_at = active

        if delete_thread:
            await self.client.delete_thread(thread_id)

        self.store.clear_active_thread(user_id)
