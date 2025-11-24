from sqlalchemy import create_engine, event, pool
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings
import logging
import time

logger = logging.getLogger(__name__)

"""
Database Configuration

🔒 PRODUCTION OPTIMIZATIONS:
1. Connection pooling is configured based on environment
2. Pool pre-ping is enabled to verify connections
3. Pool recycling prevents stale connections
4. Slow query logging is enabled in production
5. Automatic rollback on errors
"""

# Connection pool settings
# 🔒 PRODUCTION: Larger pool for handling more concurrent requests
POOL_SIZE = 20 if settings.is_production else 5
MAX_OVERFLOW = 30 if settings.is_production else 10
POOL_TIMEOUT = 30  # seconds
POOL_RECYCLE = 3600  # Recycle connections after 1 hour (prevents stale connections)

# Async engine for FastAPI endpoints
async_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # 🔒 PRODUCTION: Will be False (no SQL logging)
    future=True,
    pool_size=POOL_SIZE,
    max_overflow=MAX_OVERFLOW,
    pool_timeout=POOL_TIMEOUT,
    pool_recycle=POOL_RECYCLE,
    pool_pre_ping=True,  # Verify connections before using (prevents stale connections)
)

# Async session maker
AsyncSessionLocal = sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Don't expire objects after commit
    autoflush=False,  # Manual control over flushing
    autocommit=False,  # Manual control over commits
)

# Sync engine for Alembic migrations
sync_engine = create_engine(
    settings.DATABASE_URL_SYNC,
    echo=settings.DEBUG,  # 🔒 PRODUCTION: Will be False
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=POOL_RECYCLE,
)

# Base class for all models
Base = declarative_base()


# Dependency to get DB session
async def get_db():
    """
    FastAPI dependency for database sessions
    
    Provides automatic:
    - Session management
    - Commit on success
    - Rollback on error
    - Connection cleanup
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()  # Auto-commit if no errors
        except Exception as e:
            await session.rollback()  # Auto-rollback on any error
            logger.error(f"Database error: {e}")
            raise
        finally:
            await session.close()  # Always cleanup


# 🔒 PRODUCTION: Slow query logging
if settings.is_production:
    """
    Log queries that take longer than 1 second
    Helps identify performance bottlenecks
    """
    @event.listens_for(sync_engine, "before_cursor_execute")
    def receive_before_cursor_execute(conn, cursor, statement, params, context, executemany):
        conn.info.setdefault('query_start_time', []).append(time.time())

    @event.listens_for(sync_engine, "after_cursor_execute")
    def receive_after_cursor_execute(conn, cursor, statement, params, context, executemany):
        total = time.time() - conn.info['query_start_time'].pop()
        if total > 1.0:  # Log queries taking over 1 second
            logger.warning(f"Slow query ({total:.2f}s): {statement[:200]}...")  # Truncate long queries


# Database initialization
async def init_db():
    """
    Initialize database (create tables if they don't exist)
    
    🔒 PRODUCTION: Use Alembic migrations instead of this
    This is only for development/testing
    """
    if settings.is_development:
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created (development mode)")


async def close_db():
    """
    Cleanup database connections on shutdown
    """
    await async_engine.dispose()
    logger.info("Database connections closed")