"""
shared/database.py
Single Motor client shared across ALL modules.
Import ONLY this — never create your own MongoClient.

The database name is parsed from the URI path, e.g.:
  mongodb://localhost:27017/mediloop   →  db name = "mediloop"
  mongodb+srv://...atlas.../mediloop   →  db name = "mediloop"
If no path is present, defaults to "mediloop".
"""
import os
from urllib.parse import urlparse
import motor.motor_asyncio
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/mediloop")

# Extract db name from the URI path; strip leading slash and any query string
_parsed_db = urlparse(MONGO_URI).path.lstrip("/").split("?")[0] or "mediloop"

_client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
db = _client[_parsed_db]
