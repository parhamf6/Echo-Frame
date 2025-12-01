# app/core/socketio_manager.py

import socketio
from typing import Dict
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=['http://localhost:3000'],  # Update for production
    logger=True,
    engineio_logger=True
)

# Track connected users per room
# Format: {room_id: {guest_id: sid}}
room_connections: Dict[str, Dict[str, str]] = {}

# Track when users went offline (in-memory presence)
# Format: {room_id: {guest_id: datetime_utc}}
offline_since: Dict[str, Dict[str, datetime]] = {}

# How long we keep offline users around before treating them as "gone" (seconds)
PRESENCE_TTL_SECONDS = 15 * 60  # 15 minutes


@sio.event
async def connect(sid, environ, auth):
    """Client connected"""
    logger.info(f"Client connected: {sid}")
    await sio.emit('connected', {'message': 'Connected to server'}, to=sid)


@sio.event
async def disconnect(sid):
    """Client disconnected"""
    logger.info(f"Client disconnected: {sid}")
    
    # Remove from room tracking and mark offline timestamp
    for room_id, users in room_connections.items():
        for guest_id, user_sid in list(users.items()):
            if user_sid == sid:
                del users[guest_id]

                # Record offline timestamp
                if room_id not in offline_since:
                    offline_since[room_id] = {}
                offline_since[room_id][guest_id] = datetime.utcnow()

                await sio.emit('user_left', {'guest_id': guest_id}, room=room_id)
                break


@sio.event
async def join_room(sid, data):
    """Guest joins a room"""
    room_id = data.get('room_id')
    guest_id = data.get('guest_id')
    
    if not room_id or not guest_id:
        await sio.emit('error', {'message': 'Missing room_id or guest_id'}, to=sid)
        return
    
    # Join Socket.io room
    await sio.enter_room(sid, room_id)
    
    # Track connection
    if room_id not in room_connections:
        room_connections[room_id] = {}
    room_connections[room_id][guest_id] = sid

    # Clear any previous offline timestamp now that user is back online
    if room_id in offline_since and guest_id in offline_since[room_id]:
        del offline_since[room_id][guest_id]
    
    logger.info(f"Guest {guest_id} joined room {room_id}")
    
    # Notify other users
    await sio.emit('user_joined', {'guest_id': guest_id}, room=room_id, skip_sid=sid)


@sio.event
async def leave_room(sid, data):
    """Guest leaves a room"""
    room_id = data.get('room_id')
    guest_id = data.get('guest_id')
    
    if room_id and guest_id:
        await sio.leave_room(sid, room_id)

        if room_id in room_connections and guest_id in room_connections[room_id]:
            del room_connections[room_id][guest_id]

        # Record offline timestamp
        if room_id not in offline_since:
            offline_since[room_id] = {}
        offline_since[room_id][guest_id] = datetime.utcnow()

        await sio.emit('user_left', {'guest_id': guest_id}, room=room_id)
        logger.info(f"Guest {guest_id} left room {room_id}")


# Utility functions for emitting events
async def emit_permission_changed(room_id: str, guest_id: str, permissions: dict):
    """Notify specific user about permission changes"""
    if room_id in room_connections and guest_id in room_connections[room_id]:
        sid = room_connections[room_id][guest_id]
        await sio.emit('permissions_updated', {'permissions': permissions}, to=sid)
        logger.info(f"Sent permission update to {guest_id}")


async def emit_role_changed(room_id: str, guest_id: str, role: str):
    """Notify specific user about role changes (e.g., promoted to moderator)"""
    if room_id in room_connections and guest_id in room_connections[room_id]:
        sid = room_connections[room_id][guest_id]
        await sio.emit('role_updated', {'role': role}, to=sid)
        logger.info(f"Sent role update to {guest_id}: {role}")


async def emit_user_kicked(room_id: str, guest_id: str):
    """Notify user they were kicked"""
    if room_id in room_connections and guest_id in room_connections[room_id]:
        sid = room_connections[room_id][guest_id]
        await sio.emit('kicked', {'message': 'You were removed from the room'}, to=sid)
        logger.info(f"Sent kick notification to {guest_id}")


async def emit_user_list_updated(room_id: str):
    """Notify all users in room to refresh user list"""
    await sio.emit('user_list_updated', {}, room=room_id)
    logger.info(f"Notified room {room_id} of user list update")


async def emit_join_request(room_id: str, guest_data: dict):
    """Notify moderators/admins of new join request"""
    await sio.emit('new_join_request', guest_data, room=room_id)
    logger.info(f"Notified room {room_id} of new join request")


async def emit_room_closed(room_id: str):
    """Notify all users in a room that it has been closed."""
    await sio.emit('room_closed', {'message': 'Room has ended'}, room=room_id)
    logger.info(f"Notified room {room_id} that it has been closed")


def get_guest_presence(room_id: str, guest_id: str) -> Dict[str, object]:
    """
    Return presence info for a guest in a room.

    - online: bool
    - offline_since: datetime | None
    - stale: bool (True if offline for longer than PRESENCE_TTL_SECONDS)
    """
    now = datetime.utcnow()

    # Online if we have an active socket connection
    if room_id in room_connections and guest_id in room_connections[room_id]:
        return {"online": True, "offline_since": None, "stale": False}

    # Otherwise, check offline timestamp
    since = offline_since.get(room_id, {}).get(guest_id)
    if not since:
        return {"online": False, "offline_since": None, "stale": False}

    # Determine if this offline record is stale (older than TTL)
    if (now - since) > timedelta(seconds=PRESENCE_TTL_SECONDS):
        return {"online": False, "offline_since": since, "stale": True}

    return {"online": False, "offline_since": since, "stale": False}