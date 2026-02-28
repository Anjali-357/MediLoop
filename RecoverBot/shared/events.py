"""
shared/events.py
Redis pub/sub helpers — used by ALL modules.
Never import redis directly in modules; use publish() and subscribe() here.
"""
import asyncio
import json
import os
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

_redis: aioredis.Redis | None = None


async def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis


async def publish(channel: str, payload: dict) -> None:
    """Publish a JSON payload to a Redis channel."""
    r = await _get_redis()
    await r.publish(channel, json.dumps(payload))


async def subscribe(channel: str, handler) -> None:
    """
    Subscribe to a Redis channel and call handler(payload: dict) for every message.
    Runs forever — wrap in asyncio.create_task() inside @app.on_event('startup').
    """
    r = await aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.subscribe(channel)
    async for message in pubsub.listen():
        if message["type"] == "message":
            try:
                payload = json.loads(message["data"])
                await handler(payload)
            except Exception as exc:
                print(f"[events] handler error on {channel}: {exc}")
