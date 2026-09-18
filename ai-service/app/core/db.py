from pymongo import MongoClient
from app.core.config import settings

_client = None


def db():
    global _client
    if _client is None:
        _client = MongoClient(settings.mongo_uri)
    try:
        database = _client.get_default_database()
        if database is not None:
            return database
    except Exception:
        pass
    return _client["studycompanion"]

