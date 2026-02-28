"""
main.py — RecoverBot standalone dev server.
In production this file is written by the integration manager combining all 4 modules.
"""
import asyncio
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from module2_recoverbot.router import router as recoverbot_router
from module2_recoverbot.events import start_subscribers
from module2_recoverbot.services.scheduler_service import start_scheduler

app = FastAPI(title="MediLoop — Module 2: RecoverBot", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173"), "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recoverbot_router, prefix="/api/recoverbot")


@app.on_event("startup")
async def startup():
    start_scheduler()
    await start_subscribers()
    print("✅  RecoverBot module started")


@app.get("/health")
async def health():
    return {"status": "ok", "module": "recoverbot"}
