from fastapi import FastAPI, Depends, Request
from app.core.config import settings
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db, async_engine
from app.core.redis_client import redis_client
from app.api.v1 import api_router
from app.core.database import init_db, close_db
import time
import logging
from collections import defaultdict
from datetime import datetime
import json
from app.core.socketio_manager import sio
import socketio

# ============= LOGGING SETUP =============
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),  # Save to file
        logging.StreamHandler()  # Also print to console
    ]
)
logger = logging.getLogger(__name__)

# ============= REQUEST TRACKING =============
request_stats = {
    "total": 0,
    "by_path": defaultdict(int),
    "by_method": defaultdict(int),
    "by_ip": defaultdict(int),
    "errors": 0,
    "start_time": datetime.now()
}

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

# ============= CORS MIDDLEWARE (MUST BE BEFORE SOCKETIO) =============
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

socket_app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=app,
    socketio_path='/socket.io'
)
# Update Uvicorn run command to use socket_app instead of app
# In your run script: uvicorn app.main:socket_app --reload

# ============= LOGGING MIDDLEWARE =============
@app.middleware("http")
async def log_requests(request: Request, call_next):
    # Increment counters
    request_stats["total"] += 1
    request_stats["by_path"][request.url.path] += 1
    request_stats["by_method"][request.method] += 1
    
    client_ip = request.client.host if request.client else "unknown"
    request_stats["by_ip"][client_ip] += 1
    
    # Log request details
    logger.info("=" * 80)
    logger.info(f"📥 INCOMING REQUEST #{request_stats['total']}")
    logger.info(f"   Method: {request.method}")
    logger.info(f"   Path: {request.url.path}")
    logger.info(f"   Client IP: {client_ip}")
    logger.info(f"   User-Agent: {request.headers.get('user-agent', 'N/A')}")
    logger.info(f"   Referer: {request.headers.get('referer', 'N/A')}")
    
    # Check for suspicious patterns
    if request_stats["by_ip"][client_ip] > 10:
        logger.warning(f"⚠️  HIGH REQUEST COUNT from {client_ip}: {request_stats['by_ip'][client_ip]} requests")
    
    if request_stats["by_path"][request.url.path] > 20:
        logger.warning(f"⚠️  PATH {request.url.path} hit {request_stats['by_path'][request.url.path]} times")
    
    # Time the request
    start_time = time.time()
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log response
        logger.info(f"📤 RESPONSE")
        logger.info(f"   Status: {response.status_code}")
        logger.info(f"   Time: {process_time:.4f}s")
        
        if process_time > 1.0:
            logger.warning(f"⚠️  SLOW REQUEST: {process_time:.4f}s for {request.url.path}")
        
        # Add custom header with processing time
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
        
    except Exception as e:
        request_stats["errors"] += 1
        process_time = time.time() - start_time
        logger.error(f"❌ ERROR in request")
        logger.error(f"   Path: {request.url.path}")
        logger.error(f"   Error: {str(e)}")
        logger.error(f"   Time: {process_time:.4f}s")
        raise

@app.on_event("startup")
async def startup():
    logger.info("🚀 APPLICATION STARTING UP")
    logger.info(f"   App Name: {settings.APP_NAME}")
    logger.info(f"   Debug Mode: {settings.DEBUG}")
    
    # Initialize Redis connection so that refresh tokens and rate limiting work
    try:
        await redis_client.connect()
        logger.info("✅ Redis initialized on startup")
    except Exception as e:
        # In development we log and continue; in production RedisClient may raise
        logger.error(f"Failed to initialize Redis on startup: {e}")
    
    request_stats["start_time"] = datetime.now()

@app.on_event("shutdown")
async def shutdown():
    logger.info("🛑 APPLICATION SHUTTING DOWN")
    await redis_client.disconnect()
    await close_db()

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "EchoFrame API", "status": "running"}

# ============= MONITORING ENDPOINTS =============
@app.get("/api/monitor/stats")
async def get_stats():
    """Get request statistics"""
    uptime = (datetime.now() - request_stats["start_time"]).total_seconds()
    
    return {
        "uptime_seconds": uptime,
        "total_requests": request_stats["total"],
        "errors": request_stats["errors"],
        "requests_per_minute": (request_stats["total"] / uptime * 60) if uptime > 0 else 0,
        "by_path": dict(request_stats["by_path"]),
        "by_method": dict(request_stats["by_method"]),
        "by_ip": dict(request_stats["by_ip"]),
        "top_paths": sorted(
            request_stats["by_path"].items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:10]
    }

@app.get("/api/monitor/health")
async def health_check():
    """Simple health check endpoint"""
    try:
        # You can add checks for DB, Redis, etc.
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "total_requests": request_stats["total"]
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {"status": "unhealthy", "error": str(e)}

@app.post("/api/monitor/reset-stats")
async def reset_stats():
    """Reset statistics (use carefully!)"""
    logger.warning("📊 Statistics reset requested")
    request_stats["total"] = 0
    request_stats["by_path"].clear()
    request_stats["by_method"].clear()
    request_stats["by_ip"].clear()
    request_stats["errors"] = 0
    request_stats["start_time"] = datetime.now()
    return {"message": "Stats reset successfully"}