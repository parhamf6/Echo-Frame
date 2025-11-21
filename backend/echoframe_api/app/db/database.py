# backend/echoframe_api/app/db/database.py
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings  # your pydantic Settings instance

# Engine with basic pooling options
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=int(getattr(settings, "DB_POOL_SIZE", 10)),
    max_overflow=int(getattr(settings, "DB_MAX_OVERFLOW", 20)),
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# FastAPI dependency to get DB session
def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
