from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
    db = client[os.getenv("MONGO_DB_NAME", "mediloop")]
    patient = await db.patients.find_one({"phone": "+919876540004"})
    print(patient)

asyncio.run(test())
