"""MongoDB async database connection with Motor."""

import logging

import motor.motor_asyncio
from pymongo import ASCENDING, IndexModel

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

# Motor async client
client: motor.motor_asyncio.AsyncIOMotorClient | None = None
db: motor.motor_asyncio.AsyncIOMotorDatabase | None = None

# Collection names
USERS = "users"
DOCUMENTS = "documents"
CHUNKS = "chunks"
JOBS = "ingestion_jobs"
MESSAGES = "messages"
CONVERSATIONS = "conversations"


async def connect_db() -> None:
    """Connect to MongoDB and create indexes."""
    global client, db

    if settings.MONGODB_URL.startswith("mongomock://"):
        from mongomock_motor import AsyncMongoMockClient
        client = AsyncMongoMockClient()
    else:
        client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URL)
    
    db = client[settings.MONGODB_DB_NAME]

    # Create indexes
    await db[USERS].create_indexes([
        IndexModel([("email", ASCENDING)], unique=True),
    ])
    await db[DOCUMENTS].create_indexes([
        IndexModel([("owner_id", ASCENDING)]),
        IndexModel([("content_hash", ASCENDING), ("owner_id", ASCENDING)]),
    ])
    await db[CHUNKS].create_indexes([
        IndexModel([("document_id", ASCENDING)]),
        IndexModel([("tenant_id", ASCENDING)]),
    ])
    await db[JOBS].create_indexes([
        IndexModel([("document_id", ASCENDING)]),
    ])
    await db[MESSAGES].create_indexes([
        IndexModel([("user_id", ASCENDING)]),
        IndexModel([("conversation_id", ASCENDING), ("created_at", ASCENDING)]),
    ])
    await db[CONVERSATIONS].create_indexes([
        IndexModel([("user_id", ASCENDING), ("updated_at", ASCENDING)]),
    ])

    logger.info("Connected to MongoDB: %s/%s", settings.MONGODB_URL, settings.MONGODB_DB_NAME)


async def close_db() -> None:
    """Close MongoDB connection."""
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")


def get_db() -> motor.motor_asyncio.AsyncIOMotorDatabase:
    """Get the database instance."""
    if db is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    return db


async def check_database_connection() -> bool:
    """Verify MongoDB connectivity."""
    try:
        if client is None:
            return False
        await client.admin.command("ping")
        return True
    except Exception as e:
        logger.error("MongoDB connection failed: %s", e)
        return False
