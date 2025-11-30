# app/core/socketio_manager.py

import socketio
from typing import Dict, Set
import logging

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


@sio.event
async def connect(sid, environ, auth):
    """Client connected"""
    logger.info(f"Client connected: {sid}")
    await sio.emit('connected', {'message': 'Connected to server'}, to=sid)


@sio.event
async def disconnect(sid):
    """Client disconnected"""
    logger.info(f"Client disconnected: {sid}")
    
    # Remove from room tracking
    for room_id, users in room_connections.items():
        for guest_id, user_sid in list(users.items()):
            if user_sid == sid:
                del users[guest_id]
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
        
        await sio.emit('user_left', {'guest_id': guest_id}, room=room_id)
        logger.info(f"Guest {guest_id} left room {room_id}")


# Utility functions for emitting events
async def emit_permission_changed(room_id: str, guest_id: str, permissions: dict):
    """Notify specific user about permission changes"""
    if room_id in room_connections and guest_id in room_connections[room_id]:
        sid = room_connections[room_id][guest_id]
        await sio.emit('permissions_updated', {'permissions': permissions}, to=sid)
        logger.info(f"Sent permission update to {guest_id}")


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