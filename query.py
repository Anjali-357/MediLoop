import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
    db = client[os.getenv("MONGO_DB_NAME", "mediloop")]
    count = await db.patients.count_documents({})
    print(f"Total patients: {count}")
    
    docs = await db.patients.find({}).to_list(10)
    for index, d in enumerate(docs):
        print(f"Patient {index}: {d.get('name')} | Phone: {d.get('phone')}")

asyncio.run(test())
