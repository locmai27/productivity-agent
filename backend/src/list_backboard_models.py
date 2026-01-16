"""
List Backboard models and recommend a good default model_name.

This script prompts for BACKBOARD_API_KEY using hidden input so the key isn't
stored in shell history.

Example:
  python3 list_backboard_models.py --model-type llm --supports-tools true --limit 200
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
from dataclasses import dataclass
from getpass import getpass
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import aiohttp


DEFAULT_BASE_URL = "https://app.backboard.io/api"


@dataclass
class Model:
    name: str
    provider: str
    model_type: str
    context_limit: int
    max_output_tokens: int
    supports_tools: bool


def _to_bool(s: Optional[str]) -> Optional[bool]:
    if s is None:
        return None
    s2 = s.strip().lower()
    if s2 in {"true", "1", "yes", "y"}:
        return True
    if s2 in {"false", "0", "no", "n"}:
        return False
    raise ValueError("supports-tools must be true/false")


async def fetch_models(
    *,
    api_key: str,
    base_url: str,
    model_type: Optional[str],
    provider: Optional[str],
    supports_tools: Optional[bool],
    min_context: Optional[int],
    max_context: Optional[int],
    skip: int,
    limit: int,
) -> Dict[str, Any]:
    params: Dict[str, Any] = {
        "skip": str(skip),
        "limit": str(limit),
    }
    if model_type:
        params["model_type"] = model_type
    if provider:
        params["provider"] = provider
    if supports_tools is not None:
        params["supports_tools"] = "true" if supports_tools else "false"
    if min_context is not None:
        params["min_context"] = str(min_context)
    if max_context is not None:
        params["max_context"] = str(max_context)
    url = f"{base_url.rstrip('/')}/models?{urlencode(params)}"
    headers = {"X-API-Key": api_key, "Accept": "application/json"}

    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as resp:
            text = await resp.text()
            if resp.status >= 400:
                raise RuntimeError(f"Backboard /models failed ({resp.status}): {text[:400]}")
            return json.loads(text)


def recommend_model(models: List[Model]) -> Optional[Model]:
    # Prefer tool-capable LLMs with highest context limit, then max output tokens.
    candidates = [m for m in models if m.model_type == "llm" and m.supports_tools]
    if not candidates:
        candidates = [m for m in models if m.model_type == "llm"]
    if not candidates:
        return None
    candidates.sort(key=lambda m: (m.context_limit, m.max_output_tokens), reverse=True)
    return candidates[0]


def parse_models(payload: Dict[str, Any]) -> List[Model]:
    out: List[Model] = []
    for rec in payload.get("models", []) or []:
        out.append(
            Model(
                name=str(rec.get("name", "")),
                provider=str(rec.get("provider", "")),
                model_type=str(rec.get("model_type", "")),
                context_limit=int(rec.get("context_limit") or 0),
                max_output_tokens=int(rec.get("max_output_tokens") or 0),
                supports_tools=bool(rec.get("supports_tools")),
            )
        )
    return out


async def main_async() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default=os.getenv("BACKBOARD_BASE_URL", DEFAULT_BASE_URL))
    ap.add_argument("--model-type", default="")
    ap.add_argument("--provider", default="")
    ap.add_argument("--supports-tools", default="")
    ap.add_argument("--min-context", type=int, default=None)
    ap.add_argument("--max-context", type=int, default=None)
    ap.add_argument("--skip", type=int, default=0)
    ap.add_argument("--limit", type=int, default=200)
    args = ap.parse_args()

    api_key = os.getenv("BACKBOARD_API_KEY") or getpass("Enter BACKBOARD_API_KEY (input hidden): ")
    supports_tools = _to_bool(args.supports_tools) if args.supports_tools else None

    payload = await fetch_models(
        api_key=api_key,
        base_url=args.base_url,
        model_type=args.model_type or None,
        provider=args.provider or None,
        supports_tools=supports_tools,
        min_context=args.min_context,
        max_context=args.max_context,
        skip=args.skip,
        limit=args.limit,
    )

    models = parse_models(payload)
    total = payload.get("total", len(models))
    rec = recommend_model(models)

    print(f"\nTotal models returned: {total}")
    print("Recommended model_name to copy/paste:")
    if rec:
        print(rec.name)
        print(f"(provider={rec.provider}, context_limit={rec.context_limit}, supports_tools={rec.supports_tools})")
    else:
        print("(none found)")

    print("\nTop 10 matches (exact names):")
    models_sorted = sorted(models, key=lambda m: (m.supports_tools, m.context_limit, m.max_output_tokens), reverse=True)
    for m in models_sorted[:10]:
        print(f"- {m.name}  (provider={m.provider}, ctx={m.context_limit}, tools={m.supports_tools})")

    return 0


def main() -> int:
    return asyncio.run(main_async())


if __name__ == "__main__":
    raise SystemExit(main())


