import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from shared.database import db

# Import routers for modules (mocking the others for now as they are owned by other devs)
try:
    from module1_scribe.router import router as scribe_router
except ImportError:
    scribe_router = None

try:
    from module2_recoverbot.router import router as recoverbot_router
    from module2_recoverbot.events import start_subscribers
    from module2_recoverbot.services.scheduler_service import start_scheduler
except ImportError:
    recoverbot_router = None

try:
    from module3_painscan.router import router as painscan_router
except ImportError:
    painscan_router = None

try:
    from module4_caregap.router import router as caregap_router
    from module4_caregap.scanner import setup_scanner as caregap_setup_scanner
except ImportError:
    caregap_router = None

app = FastAPI(title='MediLoop')

# CORS settings
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, '*'], # allowed all for hackathon simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if scribe_router:
    app.include_router(scribe_router, prefix='/api/scribe')
if recoverbot_router:
    app.include_router(recoverbot_router, prefix='/api/recoverbot')
if painscan_router:
    app.include_router(painscan_router, prefix='/api/painscan')
if caregap_router:
    app.include_router(caregap_router, prefix='/api/caregap')

@app.on_event("startup")
async def startup_event():
    # Database connection is initialized in shared/database.py when db is accessed
    try:
        from module2_recoverbot.services.scheduler_service import start_scheduler
        from module2_recoverbot.events import start_subscribers
        start_scheduler()
        import asyncio
        asyncio.create_task(start_subscribers())
        print("✅ RecoverBot events and scheduler started")
    except ImportError:
        pass
        
    try:
        from module4_caregap.scanner import setup_scanner as caregap_setup_scanner
        caregap_setup_scanner()
        print("✅ CareGap events and scheduler started")
    except ImportError as e:
        print(f"Failed to load CareGap: {e}")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "MediLoop API is running"}
