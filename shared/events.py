import os
import json
import redis.asyncio as aioredis
from typing import AsyncGenerator

_redis = None

async def get_redis():
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379'))
    return _redis

async def publish(channel: str, payload: dict):
    r = await get_redis()
    await r.publish(channel, json.dumps(payload))

async def subscribe(channel: str) -> AsyncGenerator:
    r = await get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(channel)
    async for message in pubsub.listen():
        if message['type'] == 'message':
            yield json.loads(message['data'])
