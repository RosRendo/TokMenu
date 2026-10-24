import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import HTTPException  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("tokmenu")

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
db_name = os.environ.get("DB_NAME", "test_database")

use_mock = mongo_url.lower() == "mock"
if not use_mock:
    try:
        import pymongo
        _probe = pymongo.MongoClient(mongo_url, serverSelectionTimeoutMS=800)
        _probe.admin.command("ping")
        _probe.close()
        client = AsyncIOMotorClient(mongo_url, tz_aware=True)
        db = client[db_name]
        logger.info("Connected to MongoDB at %s", mongo_url)
    except Exception as _e:
        logger.warning("Local MongoDB not reachable at %s (%s). Using in-memory database fallback for local dev.", mongo_url, type(_e).__name__)
        use_mock = True

if use_mock:
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
    db = client[db_name]

APP_NAME = "tokmenu"


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


def clean(doc):
    """Strip Mongo _id and convert datetimes to ISO strings, recursively."""
    if isinstance(doc, list):
        return [clean(d) for d in doc]
    if isinstance(doc, dict):
        return {k: clean(v) for k, v in doc.items() if k != "_id"}
    if isinstance(doc, datetime):
        if doc.tzinfo is None:
            doc = doc.replace(tzinfo=timezone.utc)
        return doc.isoformat()
    return doc


class ApiError(HTTPException):
    def __init__(self, status: int, code: str, message: str, **extra):
        super().__init__(status_code=status, detail={"code": code, "message": message, **extra})


def client_ip(request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def request_host(headers) -> str:
    return (headers.get("x-forwarded-host") or headers.get("host") or "").split(",")[0].strip()


def app_base_url(request) -> str:
    configured = os.environ.get("APP_URL")
    if configured:
        return configured.rstrip("/")
    return f"https://{request_host(request.headers)}"


async def rate_limit(key: str, limit: int, window_seconds: int):
    since = now() - timedelta(seconds=window_seconds)
    count = await db.rate_limits.count_documents({"key": key, "at": {"$gte": since}})
    if count >= limit:
        raise ApiError(429, "RATE_LIMITED", "Too many requests. Please wait a moment and try again.")
    await db.rate_limits.insert_one({"key": key, "at": now()})


async def audit(action, *, actor=None, restaurant_id=None, target_type=None, target_id=None, meta=None):
    await db.audit_logs.insert_one({
        "id": new_id(),
        "action": action,
        "actor_user_id": actor["id"] if actor else None,
        "actor_email": actor.get("email") if actor else None,
        "restaurant_id": restaurant_id,
        "target_type": target_type,
        "target_id": target_id,
        "meta": meta or {},
        "created_at": now(),
    })
