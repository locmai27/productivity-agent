"""
Backboard API client implementation.
"""

import json
import os
import aiohttp
import mimetypes
from typing import Any, Dict, Optional

class BackboardAPIClient:
    """Implementation of BackboardClientProto using Backboard API."""
    
    def __init__(self, api_key: str, base_url: str = "https://app.backboard.io/api"):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.headers = {
            # Backboard uses API key header auth (per docs)
            "X-API-Key": api_key,
        }
    
    async def create_assistant(self, **kwargs) -> Dict[str, Any]:
        """Create a new assistant."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/assistants",
                    headers=self.headers,
                    json=kwargs
                ) as resp:
                    resp.raise_for_status()
                    return await resp.json()
        except aiohttp.ClientConnectorError as e:
            raise RuntimeError(
                f"Cannot connect to Backboard API at {self.base_url}. "
                "Check BACKBOARD_BASE_URL and your network/DNS connectivity."
            ) from e

    async def update_assistant(self, assistant_id: str, **kwargs) -> Dict[str, Any]:
        """Update an existing assistant (best-effort)."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.put(
                    f"{self.base_url}/assistants/{assistant_id}",
                    headers={**self.headers, "Accept": "application/json"},
                    json=kwargs,
                ) as resp:
                    text = await resp.text()
                    if resp.status >= 400:
                        raise RuntimeError(f"Backboard update assistant failed ({resp.status}): {text[:400]}")
                    return json.loads(text) if text else {}
        except aiohttp.ClientConnectorError as e:
            raise RuntimeError(
                f"Cannot connect to Backboard API at {self.base_url}. "
                "Check BACKBOARD_BASE_URL and your network/DNS connectivity."
            ) from e
    
    async def create_thread(self, assistant_id: str, **kwargs) -> Dict[str, Any]:
        """Create a new thread."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/assistants/{assistant_id}/threads",
                    headers=self.headers,
                    json=kwargs
                ) as resp:
                    resp.raise_for_status()
                    return await resp.json()
        except aiohttp.ClientConnectorError as e:
            raise RuntimeError(
                f"Cannot connect to Backboard API at {self.base_url}. "
                "Check BACKBOARD_BASE_URL and your network/DNS connectivity."
            ) from e
    
    async def add_message(self, **kwargs) -> Dict[str, Any]:
        """Add a message to a thread."""
        thread_id = kwargs.pop("thread_id")
        # Backboard expects multipart/form-data for messages.
        # We'll send it as form-data to support optional attachments later.
        form = aiohttp.FormData()
        for key, value in kwargs.items():
            if value is None:
                continue
            # Backboard docs accept booleans/strings; send as strings for safety
            if isinstance(value, bool):
                form.add_field(key, "true" if value else "false")
            elif isinstance(value, (dict, list)):
                # Backboard expects metadata as JSON string; also safe for other structured fields
                form.add_field(key, json.dumps(value))
            else:
                form.add_field(key, str(value))
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/threads/{thread_id}/messages",
                    headers=self.headers,
                    data=form
                ) as resp:
                    resp.raise_for_status()
                    return await resp.json()
        except aiohttp.ClientConnectorError as e:
            raise RuntimeError(
                f"Cannot connect to Backboard API at {self.base_url}. "
                "Check BACKBOARD_BASE_URL and your network/DNS connectivity."
            ) from e
    
    async def delete_thread(self, thread_id: str, **kwargs) -> None:
        """Delete a thread."""
        async with aiohttp.ClientSession() as session:
            async with session.delete(
                f"{self.base_url}/threads/{thread_id}",
                headers=self.headers
            ) as resp:
                resp.raise_for_status()

    async def get_thread(self, thread_id: str) -> Dict[str, Any]:
        """Retrieve a thread (including messages)."""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/threads/{thread_id}",
                headers={**self.headers, "Accept": "application/json"},
            ) as resp:
                text = await resp.text()
                if resp.status >= 400:
                    raise RuntimeError(f"Backboard get_thread failed ({resp.status}): {text[:400]}")
                return json.loads(text) if text else {}

    async def list_thread_documents(self, thread_id: str) -> Any:
        """List documents attached to a thread."""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/threads/{thread_id}/documents",
                headers={**self.headers, "Accept": "application/json"},
            ) as resp:
                text = await resp.text()
                if resp.status >= 400:
                    raise RuntimeError(f"Backboard list_thread_documents failed ({resp.status}): {text[:400]}")
                return json.loads(text) if text else []

    async def get_document_status(self, document_id: str) -> Any:
        """Get document indexing status."""
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self.base_url}/documents/{document_id}/status",
                headers={**self.headers, "Accept": "application/json"},
            ) as resp:
                text = await resp.text()
                if resp.status >= 400:
                    raise RuntimeError(f"Backboard get_document_status failed ({resp.status}): {text[:400]}")
                return json.loads(text) if text else {}
    
    async def add_memory(self, **kwargs) -> Dict[str, Any]:
        """Add memory to an assistant."""
        assistant_id = kwargs.pop('assistant_id')
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/assistants/{assistant_id}/memories",
                headers=self.headers,
                json=kwargs
            ) as resp:
                resp.raise_for_status()
                return await resp.json()
    
    async def upload_document_to_assistant(self, **kwargs) -> Dict[str, Any]:
        """Upload document to assistant."""
        assistant_id = kwargs.pop("assistant_id")
        file_path = kwargs.pop("file_path")
        url = f"{self.base_url}/assistants/{assistant_id}/documents"
        headers = {"X-API-Key": self.api_key, "Accept": "application/json"}

        form = aiohttp.FormData()
        filename = os.path.basename(file_path)
        mime, _enc = mimetypes.guess_type(filename)
        content_type = mime or "application/octet-stream"
        with open(file_path, "rb") as f:
            data = f.read()
        # Backboard expects `file` (singular) for document upload (per 422 error shape).
        form.add_field("file", data, filename=filename, content_type=content_type)
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, data=form) as resp:
                text = await resp.text()
                if resp.status >= 400:
                    raise RuntimeError(f"Backboard upload assistant doc failed ({resp.status}): {text[:400]}")
                return json.loads(text)
    
    async def upload_document_to_thread(self, **kwargs) -> Dict[str, Any]:
        """Upload document to thread."""
        thread_id = kwargs.pop("thread_id")
        file_path = kwargs.pop("file_path")
        url = f"{self.base_url}/threads/{thread_id}/documents"
        headers = {"X-API-Key": self.api_key, "Accept": "application/json"}

        form = aiohttp.FormData()
        filename = os.path.basename(file_path)
        mime, _enc = mimetypes.guess_type(filename)
        content_type = mime or "application/octet-stream"
        with open(file_path, "rb") as f:
            data = f.read()
        # Backboard expects `file` (singular) for document upload (per API 422 error shape).
        form.add_field("file", data, filename=filename, content_type=content_type)
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, data=form) as resp:
                text = await resp.text()
                if resp.status >= 400:
                    raise RuntimeError(f"Backboard upload thread doc failed ({resp.status}): {text[:400]}")
                return json.loads(text)

    async def submit_tool_outputs(self, **kwargs) -> Dict[str, Any]:
        """
        Submit tool outputs for a run:
          POST /threads/{thread_id}/runs/{run_id}/submit-tool-outputs?stream=false
        """
        thread_id = kwargs.pop("thread_id")
        run_id = kwargs.pop("run_id")
        tool_outputs = kwargs.pop("tool_outputs")
        stream = kwargs.pop("stream", False)

        url = f"{self.base_url}/threads/{thread_id}/runs/{run_id}/submit-tool-outputs?stream={'true' if stream else 'false'}"
        headers = {"X-API-Key": self.api_key, "Accept": "application/json", "Content-Type": "application/json"}
        payload = {"tool_outputs": tool_outputs}

        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload) as resp:
                text = await resp.text()
                if resp.status >= 400:
                    raise RuntimeError(f"Backboard submit tool outputs failed ({resp.status}): {text[:400]}")
                return json.loads(text)

