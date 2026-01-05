import socketio
from typing import Dict
import logging
from datetime import datetime, timedelta
from app.core.config import settings
from app.core.redis_client import redis_client
import uuid

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=settings.ALLOWED_ORIGINS,
    logger=settings.DEBUG,
    engineio_logger=settings.DEBUG,
)

# Track connected users per room: {room_id: {guest_id: {'sid': sid, 'role': role, 'username': username}}}
room_connections: Dict[str, Dict[str, dict]] = {}

# Track pending requests: {request_id: {type, guest_id, username, room_id, timestamp, seconds?}}
pending_requests: Dict[str, dict] = {}


async def get_user_role(guest_id: str, room_id: str) -> str:
    """Get user role - TODO: Implement proper database lookup"""
    # For now, check room_connections
    if room_id in room_connections and guest_id in room_connections[room_id]:
        return room_connections[room_id][guest_id].get('role', 'viewer')
    return 'viewer'


def is_admin_or_mod(role: str) -> bool:
    """Check if role is admin or moderator"""
    return role in ['admin', 'moderator']


@sio.event
async def connect(sid, environ, auth):
    logger.info(f"Client connected: {sid}")
    await sio.emit('connected', {'message': 'Connected to server'}, to=sid)


@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    
    # Remove from room tracking
    for room_id, users in room_connections.items():
        for guest_id, user_data in list(users.items()):
            if user_data['sid'] == sid:
                username = user_data.get('username', 'User')
                del users[guest_id]
                await sio.emit('user_left', {'guest_id': guest_id, 'username': username}, room=room_id)
                break


@sio.event
async def join_room(sid, data):
    room_id = data.get('room_id')
    guest_id = data.get('guest_id')
    username = data.get('username', 'User')
    role = data.get('role', 'viewer')
    
    if not room_id or not guest_id:
        await sio.emit('error', {'message': 'Missing room_id or guest_id'}, to=sid)
        return
    
    await sio.enter_room(sid, room_id)
    
    if room_id not in room_connections:
        room_connections[room_id] = {}
    
    room_connections[room_id][guest_id] = {
        'sid': sid,
        'role': role,
        'username': username
    }
    
    logger.info(f"Guest {username} ({role}) joined room {room_id}")
    
    await sio.emit('user_joined', {
        'guest_id': guest_id,
        'username': username,
        'role': role
    }, room=room_id, skip_sid=sid)
    
    # Send current video state
    try:
        state = await redis_client.get_video_state(room_id)
        if state:
            logger.info(f"Sending video state to {username}: {state}")
            await sio.emit('video_state', state, to=sid)
        else:
            logger.info(f"No video state found for room {room_id}")
    except Exception as e:
        logger.error(f"Failed to send video state: {e}")


@sio.event
async def leave_room(sid, data):
    room_id = data.get('room_id')
    guest_id = data.get('guest_id')
    
    if room_id and guest_id:
        await sio.leave_room(sid, room_id)
        
        if room_id in room_connections and guest_id in room_connections[room_id]:
            username = room_connections[room_id][guest_id].get('username', 'User')
            del room_connections[room_id][guest_id]
            await sio.emit('user_left', {'guest_id': guest_id, 'username': username}, room=room_id)
            logger.info(f"Guest {username} left room {room_id}")


# ===== Video Control Events (Admin/Mod Only) =====

@sio.on('video:play')
async def video_play(sid, data):
    """Admin/Mod pressed play"""
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        timestamp = data.get('timestamp', 0)
        
        logger.info(f"[video:play] Room: {room_id}, Guest: {guest_id}, Timestamp: {timestamp}")
        
        if not room_id:
            await sio.emit('error', {'message': 'Missing room_id'}, to=sid)
            return
        
        # Verify admin/mod role
        role = await get_user_role(guest_id, room_id)
        if not is_admin_or_mod(role):
            await sio.emit('error', {'message': 'Unauthorized'}, to=sid)
            return
        
        # Get existing state to preserve video_id
        existing = await redis_client.get_video_state(room_id)
        
        new_state = {
            'current_video_id': existing.get('current_video_id') if existing else None,
            'is_playing': True,
            'current_timestamp': float(timestamp),
            'last_updated': datetime.utcnow().isoformat(),
            'controlled_by': guest_id
        }
        
        logger.info(f"[video:play] Broadcasting state: {new_state}")
        
        await redis_client.set_video_state(room_id, new_state)
        await sio.emit('video_state', new_state, room=room_id)
        
    except Exception as e:
        logger.exception(f"Error in video:play: {e}")


@sio.on('video:pause')
async def video_pause(sid, data):
    """Admin/Mod pressed pause"""
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        timestamp = data.get('timestamp', 0)
        
        logger.info(f"[video:pause] Room: {room_id}, Guest: {guest_id}, Timestamp: {timestamp}")
        
        if not room_id:
            await sio.emit('error', {'message': 'Missing room_id'}, to=sid)
            return
        
        # Verify admin/mod role
        role = await get_user_role(guest_id, room_id)
        if not is_admin_or_mod(role):
            await sio.emit('error', {'message': 'Unauthorized'}, to=sid)
            return
        
        # Get existing state
        existing = await redis_client.get_video_state(room_id)
        
        new_state = {
            'current_video_id': existing.get('current_video_id') if existing else None,
            'is_playing': False,
            'current_timestamp': float(timestamp),
            'last_updated': datetime.utcnow().isoformat(),
            'controlled_by': guest_id
        }
        
        logger.info(f"[video:pause] Broadcasting state: {new_state}")
        
        await redis_client.set_video_state(room_id, new_state)
        await sio.emit('video_state', new_state, room=room_id)
        
        # Auto-dismiss pause requests
        global pending_requests
        dismissed = []
        for req_id, req in list(pending_requests.items()):
            if req['room_id'] == room_id and req['type'] == 'pause':
                dismissed.append(req_id)
                del pending_requests[req_id]
        
        if dismissed:
            await sio.emit('requests_dismissed', {'request_ids': dismissed}, room=room_id)
        
    except Exception as e:
        logger.exception(f"Error in video:pause: {e}")


@sio.on('video:seek')
async def video_seek(sid, data):
    """Admin/Mod seeked"""
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        timestamp = data.get('timestamp', 0)
        
        logger.info(f"[video:seek] Room: {room_id}, Guest: {guest_id}, Timestamp: {timestamp}")
        
        if not room_id:
            await sio.emit('error', {'message': 'Missing room_id'}, to=sid)
            return
        
        # Verify admin/mod role
        role = await get_user_role(guest_id, room_id)
        if not is_admin_or_mod(role):
            await sio.emit('error', {'message': 'Unauthorized'}, to=sid)
            return
        
        # Get existing state to preserve play state
        existing = await redis_client.get_video_state(room_id)
        was_playing = existing.get('is_playing', False) if existing else False
        
        new_state = {
            'current_video_id': existing.get('current_video_id') if existing else None,
            'is_playing': was_playing,
            'current_timestamp': float(timestamp),
            'last_updated': datetime.utcnow().isoformat(),
            'controlled_by': guest_id
        }
        
        logger.info(f"[video:seek] Broadcasting state: {new_state}")
        
        await redis_client.set_video_state(room_id, new_state)
        await sio.emit('video_state', new_state, room=room_id)
        
        # Auto-dismiss rewind requests
        global pending_requests
        dismissed = []
        for req_id, req in list(pending_requests.items()):
            if req['room_id'] == room_id and req['type'] == 'rewind':
                dismissed.append(req_id)
                del pending_requests[req_id]
        
        if dismissed:
            await sio.emit('requests_dismissed', {'request_ids': dismissed}, room=room_id)
        
    except Exception as e:
        logger.exception(f"Error in video:seek: {e}")


@sio.on('video:switch')
async def video_switch(sid, data):
    """Admin/Mod switched video"""
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        video_id = data.get('video_id')
        
        logger.info(f"[video:switch] Room: {room_id}, Guest: {guest_id}, Video: {video_id}")
        
        if not room_id or not video_id:
            await sio.emit('error', {'message': 'Missing room_id or video_id'}, to=sid)
            return
        
        # Verify admin/mod role
        role = await get_user_role(guest_id, room_id)
        if not is_admin_or_mod(role):
            await sio.emit('error', {'message': 'Unauthorized'}, to=sid)
            return
        
        new_state = {
            'current_video_id': video_id,
            'is_playing': False,
            'current_timestamp': 0.0,
            'last_updated': datetime.utcnow().isoformat(),
            'controlled_by': guest_id
        }
        
        logger.info(f"[video:switch] Broadcasting state: {new_state}")
        
        await redis_client.set_video_state(room_id, new_state)
        await sio.emit('video_state', new_state, room=room_id)
        await sio.emit('video_switched', {'video_id': video_id}, room=room_id)
        
    except Exception as e:
        logger.exception(f"Error in video:switch: {e}")


# ===== Viewer Request Events =====

@sio.on('request:pause')
async def request_pause(sid, data):
    """Viewer requests pause"""
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        username = data.get('username', 'User')
        
        logger.info(f"[request:pause] From {username} in room {room_id}")
        
        # Create request
        request_id = str(uuid.uuid4())
        request = {
            'id': request_id,
            'type': 'pause',
            'guest_id': guest_id,
            'username': username,
            'room_id': room_id,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        pending_requests[request_id] = request
        
        # Notify admins/mods
        await sio.emit('viewer_request', request, room=room_id)
        
        # Confirm to requester
        await sio.emit('request_sent', {'request_id': request_id, 'type': 'pause'}, to=sid)
        
    except Exception as e:
        logger.exception(f"Error in request:pause: {e}")


@sio.on('request:rewind')
async def request_rewind(sid, data):
    """Viewer requests rewind"""
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        username = data.get('username', 'User')
        seconds = data.get('seconds', 10)
        
        logger.info(f"[request:rewind] From {username} in room {room_id}, {seconds}s")
        
        # Create request
        request_id = str(uuid.uuid4())
        request = {
            'id': request_id,
            'type': 'rewind',
            'guest_id': guest_id,
            'username': username,
            'room_id': room_id,
            'seconds': seconds,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        pending_requests[request_id] = request
        
        # Notify admins/mods
        await sio.emit('viewer_request', request, room=room_id)
        
        # Confirm to requester
        await sio.emit('request_sent', {'request_id': request_id, 'type': 'rewind'}, to=sid)
        
    except Exception as e:
        logger.exception(f"Error in request:rewind: {e}")


@sio.on('request:message')
async def request_message(sid, data):
    """Viewer sends quick message"""
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        username = data.get('username', 'User')
        message = data.get('message', '')
        
        logger.info(f"[request:message] From {username} in room {room_id}: {message}")
        
        # Create notification
        notification = {
            'type': 'quick_message',
            'guest_id': guest_id,
            'username': username,
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Notify admins/mods
        await sio.emit('viewer_request', notification, room=room_id)
        
        # Also send to chat
        await sio.emit('chat_message', {
            'guest_id': guest_id,
            'username': username,
            'message': f"💬 {message}",
            'timestamp': datetime.utcnow().isoformat()
        }, room=room_id)
        
    except Exception as e:
        logger.exception(f"Error in request:message: {e}")


@sio.on('approve:request')
async def approve_request(sid, data):
    """Admin/Mod approves a request"""
    try:
        request_id = data.get('request_id')
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        
        if request_id not in pending_requests:
            await sio.emit('error', {'message': 'Request not found'}, to=sid)
            return
        
        # Verify admin/mod role
        role = await get_user_role(guest_id, room_id)
        if not is_admin_or_mod(role):
            await sio.emit('error', {'message': 'Unauthorized'}, to=sid)
            return
        
        request = pending_requests[request_id]
        
        logger.info(f"[approve:request] {request['type']} request approved by {guest_id}")
        
        # Handle based on request type
        if request['type'] == 'pause':
            # Get current state
            state = await redis_client.get_video_state(room_id)
            current_timestamp = state.get('current_timestamp', 0)
            
            # Pause video
            new_state = {
                'current_video_id': state.get('current_video_id'),
                'is_playing': False,
                'current_timestamp': current_timestamp,
                'last_updated': datetime.utcnow().isoformat(),
                'controlled_by': guest_id
            }
            
            await redis_client.set_video_state(room_id, new_state)
            await sio.emit('video_state', new_state, room=room_id)
            
        elif request['type'] == 'rewind':
            # Get current state
            state = await redis_client.get_video_state(room_id)
            current_timestamp = state.get('current_timestamp', 0)
            seconds = request.get('seconds', 10)
            
            # Rewind video
            new_timestamp = max(0, current_timestamp - seconds)
            new_state = {
                'current_video_id': state.get('current_video_id'),
                'is_playing': state.get('is_playing', False),
                'current_timestamp': new_timestamp,
                'last_updated': datetime.utcnow().isoformat(),
                'controlled_by': guest_id
            }
            
            await redis_client.set_video_state(room_id, new_state)
            await sio.emit('video_state', new_state, room=room_id)
        
        # Remove request
        del pending_requests[request_id]
        
        # Notify room
        await sio.emit('request_approved', {
            'request_id': request_id,
            'type': request['type']
        }, room=room_id)
        
    except Exception as e:
        logger.exception(f"Error in approve:request: {e}")


@sio.on('dismiss:request')
async def dismiss_request(sid, data):
    """Admin/Mod dismisses a request"""
    try:
        request_id = data.get('request_id')
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        
        if request_id not in pending_requests:
            return
        
        # Verify admin/mod role
        role = await get_user_role(guest_id, room_id)
        if not is_admin_or_mod(role):
            await sio.emit('error', {'message': 'Unauthorized'}, to=sid)
            return
        
        logger.info(f"[dismiss:request] Request {request_id} dismissed by {guest_id}")
        
        # Remove request
        del pending_requests[request_id]
        
        # Notify room
        await sio.emit('request_dismissed', {'request_id': request_id}, room=room_id)
        
    except Exception as e:
        logger.exception(f"Error in dismiss:request: {e}")


# ===== Utility Functions =====

async def emit_permission_changed(room_id: str, guest_id: str, permissions: dict):
    if room_id in room_connections and guest_id in room_connections[room_id]:
        sid = room_connections[room_id][guest_id]['sid']
        await sio.emit('permissions_updated', {'permissions': permissions}, to=sid)
        logger.info(f"Sent permission update to {guest_id}")
    else:
        logger.warning(f"Guest {guest_id} not connected yet, permission update won't be delivered immediately")


async def emit_guest_accepted(room_id: str, guest_id: str, permissions: dict):
    """Notify a guest that they were accepted (used after accept_guest)"""
    if room_id in room_connections and guest_id in room_connections[room_id]:
        sid = room_connections[room_id][guest_id]['sid']
        await sio.emit('guest_accepted', {
            'guest_id': guest_id,
            'permissions': permissions,
            'message': 'Your join request was approved!'
        }, to=sid)
        logger.info(f"Sent acceptance notification to {guest_id}")


async def emit_role_changed(room_id: str, guest_id: str, role: str):
    if room_id in room_connections and guest_id in room_connections[room_id]:
        sid = room_connections[room_id][guest_id]['sid']
        room_connections[room_id][guest_id]['role'] = role
        await sio.emit('role_updated', {'role': role}, to=sid)
        logger.info(f"Sent role update to {guest_id}: {role}")


async def emit_user_kicked(room_id: str, guest_id: str):
    if room_id in room_connections and guest_id in room_connections[room_id]:
        sid = room_connections[room_id][guest_id]['sid']
        await sio.emit('kicked', {'message': 'You were removed from the room'}, to=sid)
        logger.info(f"Sent kick notification to {guest_id}")


async def emit_user_list_updated(room_id: str):
    await sio.emit('user_list_updated', {}, room=room_id)
    logger.info(f"Notified room {room_id} of user list update")


async def emit_join_request(room_id: str, guest_data: dict):
    await sio.emit('new_join_request', guest_data, room=room_id)
    logger.info(f"Notified room {room_id} of new join request")


async def emit_room_closed(room_id: str):
    await sio.emit('room_closed', {'message': 'Room has ended'}, room=room_id)
    logger.info(f"Notified room {room_id} that it has been closed")


def get_guest_presence(room_id: str, guest_id: str) -> Dict[str, object]:
    """Return presence info for a guest in a room"""
    if room_id in room_connections and guest_id in room_connections[room_id]:
        return {"online": True, "offline_since": None, "stale": False}
    return {"online": False, "offline_since": None, "stale": False}


# Auto-cleanup old requests every 60 seconds
import asyncio

async def cleanup_old_requests():
    """Remove requests older than 60 seconds"""
    while True:
        try:
            await asyncio.sleep(60)
            now = datetime.utcnow()
            expired = []
            
            for req_id, req in list(pending_requests.items()):
                req_time = datetime.fromisoformat(req['timestamp'])
                if (now - req_time) > timedelta(seconds=60):
                    expired.append(req_id)
            
            for req_id in expired:
                room_id = pending_requests[req_id]['room_id']
                del pending_requests[req_id]
                await sio.emit('request_dismissed', {'request_id': req_id}, room=room_id)
            
            if expired:
                logger.info(f"Cleaned up {len(expired)} expired requests")
                
        except Exception as e:
            logger.error(f"Error in cleanup_old_requests: {e}")

# Start cleanup task
asyncio.create_task(cleanup_old_requests())