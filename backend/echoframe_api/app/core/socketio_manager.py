import socketio
from typing import Dict
import logging
from datetime import datetime, timedelta
from app.core.config import settings

logger = logging.getLogger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=settings.ALLOWED_ORIGINS,
    logger=settings.DEBUG,
    engineio_logger=settings.DEBUG,
)

# Track connected users per room
# Format: {room_id: {guest_id: sid}}
room_connections: Dict[str, Dict[str, str]] = {}

# Track when users went offline (in-memory presence)
# Format: {room_id: {guest_id: datetime_utc}}
offline_since: Dict[str, Dict[str, datetime]] = {}

# Track last broadcast time per room (for debouncing)
# Format: {room_id: datetime_utc}
last_broadcast: Dict[str, datetime] = {}

# How long we keep offline users around before treating them as "gone" (seconds)
PRESENCE_TTL_SECONDS = 15 * 60  # 15 minutes

# Debounce threshold: ignore timestamp-only updates within this window
DEBOUNCE_SECONDS = 2.0

# Sync tolerance: only broadcast if timestamp changed by more than this
SYNC_TOLERANCE_SECONDS = 1.0


def _should_broadcast(room_id: str, new_state: dict, existing_state: dict) -> bool:
    """
    Determine if we should broadcast this state change.
    
    Rules:
    1. Always broadcast if video_id changed (video switch)
    2. Always broadcast if is_playing changed (play/pause)
    3. For timestamp-only changes:
       - Only broadcast if delta > SYNC_TOLERANCE_SECONDS
       - AND we haven't broadcasted in the last DEBOUNCE_SECONDS
    """
    # Video switch - always broadcast
    if new_state.get('current_video_id') != existing_state.get('current_video_id'):
        logger.debug(f"[{room_id}] Broadcast: video_id changed")
        return True
    
    # Play/pause state changed - always broadcast
    if new_state.get('is_playing') != existing_state.get('is_playing'):
        logger.debug(f"[{room_id}] Broadcast: is_playing changed")
        return True
    
    # Timestamp-only change - apply debounce and tolerance
    if 'current_timestamp' in new_state:
        try:
            new_ts = float(new_state['current_timestamp'])
            old_ts = float(existing_state.get('current_timestamp', 0))
            delta = abs(new_ts - old_ts)
            
            # Ignore tiny changes
            if delta < SYNC_TOLERANCE_SECONDS:
                logger.debug(f"[{room_id}] Skip: timestamp delta {delta:.2f}s < {SYNC_TOLERANCE_SECONDS}s")
                return False
            
            # Check debounce window
            now = datetime.utcnow()
            last = last_broadcast.get(room_id)
            if last and (now - last).total_seconds() < DEBOUNCE_SECONDS:
                logger.debug(f"[{room_id}] Skip: debounced (last broadcast {(now - last).total_seconds():.1f}s ago)")
                return False
            
            logger.debug(f"[{room_id}] Broadcast: timestamp delta {delta:.2f}s")
            return True
            
        except (ValueError, TypeError):
            # If we can't parse timestamps, be conservative and broadcast
            return True
    
    # No meaningful changes
    logger.debug(f"[{room_id}] Skip: no meaningful changes")
    return False


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

    logger.debug(f"Guest {guest_id} joined room {room_id}")

    # Notify other users (skip the joiner)
    await sio.emit('user_joined', {'guest_id': guest_id}, room=room_id, skip_sid=sid)

    # Send current video state to the new joiner only
    try:
        from app.core.redis_client import redis_client
        video_state_key = f"video_state:{room_id}"
        state_json = await redis_client.get(video_state_key)
        if state_json:
            import json
            state = json.loads(state_json)
            await sio.emit('video_state', state, to=sid)
            logger.debug(f"Sent current video state to {guest_id}")
    except Exception as e:
        logger.debug(f"Failed to send video state to new joiner: {e}")


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


# ===== Video control handlers =====
async def _persist_and_broadcast(room_id: str, new_state: dict, extra_event: tuple | None = None):
    """
    Helper: merge state with existing, persist and broadcast only if meaningfully changed.
    
    extra_event: optional tuple (event_name, payload) to emit alongside video_state
    """
    try:
        from app.core.redis_client import redis_client
        import json
        
        key = f"video_state:{room_id}"
        existing_json = await redis_client.get(key)
        existing = json.loads(existing_json) if existing_json else {}

        # Normalize numeric timestamp in incoming state
        if 'current_timestamp' in new_state:
            try:
                new_state['current_timestamp'] = float(new_state['current_timestamp'])
            except (ValueError, TypeError):
                new_state.pop('current_timestamp', None)

        # Merge states
        merged = {**existing, **new_state}

        # Check if we should broadcast
        if not _should_broadcast(room_id, merged, existing):
            logger.debug(f"Skipping broadcast for room {room_id} (no meaningful change)")
            return existing

        # Persist to Redis with 1 hour TTL
        await redis_client.set(key, json.dumps(merged), expire=3600)
        
        # Update last broadcast time
        last_broadcast[room_id] = datetime.utcnow()

        # Emit extra event if provided (video_switched, video_played, etc.)
        if extra_event:
            await sio.emit(extra_event[0], extra_event[1], room=room_id)
        
        # Broadcast merged state to all clients in room
        await sio.emit('video_state', merged, room=room_id)
        
        logger.info(f"Persisted and broadcast state for room {room_id}: {merged}")
        return merged
        
    except Exception as e:
        logger.exception(f"Failed to persist/broadcast state for {room_id}: {e}")
        return None


@sio.on('video:switch')
async def video_switch(sid, data):
    """Handle admin/moderator requesting a video switch in a room.

    Expected data: { room_id: str, guest_id: str, video_id: str }
    """
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        video_id = data.get('video_id')

        logger.info(f"Received video:switch from {guest_id} in room {room_id} -> {video_id}")
        if not room_id or not video_id:
            await sio.emit('error', {'message': 'Missing room_id or video_id'}, to=sid)
            return

        # Build new state (start at timestamp 0, paused)
        new_state = {
            'current_video_id': video_id,
            'is_playing': False,
            'current_timestamp': 0.0,
            'last_updated': datetime.utcnow().isoformat()
        }

        await _persist_and_broadcast(
            room_id, 
            new_state, 
            extra_event=('video_switched', {'video_id': video_id, 'by': guest_id})
        )
        
    except Exception as e:
        logger.exception(f"Error handling video_switch: {e}")


@sio.on('video:play')
async def video_play(sid, data):
    """Handle play command from admin/moderator.

    Expected data: { room_id: str, guest_id: str, current_timestamp: float }
    """
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        current_ts = data.get('current_timestamp', 0)

        logger.info(f"Received video:play from {guest_id} in room {room_id} at {current_ts}")
        if not room_id:
            await sio.emit('error', {'message': 'Missing room_id'}, to=sid)
            return

        # Store the exact timestamp when play command received
        play_time = datetime.utcnow()
        
        new_state = {
            'is_playing': True,
            'current_timestamp': float(current_ts or 0),
            'play_started_at': play_time.isoformat(),  # Track when playback started
            'last_updated': play_time.isoformat()
        }

        await _persist_and_broadcast(
            room_id, 
            new_state, 
            extra_event=('video_played', {
                'by': guest_id, 
                'current_timestamp': new_state['current_timestamp']
            })
        )
        
    except Exception as e:
        logger.exception(f"Error handling video_play: {e}")


@sio.on('video:pause')
async def video_pause(sid, data):
    """Handle pause command from admin/moderator.

    Expected data: { room_id: str, guest_id: str, current_timestamp: float }
    """
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        current_ts = data.get('current_timestamp', 0)

        logger.info(f"Received video:pause from {guest_id} in room {room_id} at {current_ts}")
        if not room_id:
            await sio.emit('error', {'message': 'Missing room_id'}, to=sid)
            return

        new_state = {
            'is_playing': False,
            'current_timestamp': float(current_ts or 0),
            'last_updated': datetime.utcnow().isoformat()
        }

        await _persist_and_broadcast(
            room_id, 
            new_state, 
            extra_event=('video_paused', {
                'by': guest_id, 
                'current_timestamp': new_state['current_timestamp']
            })
        )
        
    except Exception as e:
        logger.exception(f"Error handling video_pause: {e}")


@sio.on('video:seek')
async def video_seek(sid, data):
    """Handle seek command from admin/moderator.

    Expected data: { room_id: str, guest_id: str, current_timestamp: float }
    """
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        current_ts = data.get('current_timestamp', 0)

        logger.info(f"Received video:seek from {guest_id} in room {room_id} to {current_ts}")
        if not room_id:
            await sio.emit('error', {'message': 'Missing room_id'}, to=sid)
            return

        # Get existing state to preserve is_playing if it's already playing
        from app.core.redis_client import redis_client
        import json
        
        key = f"video_state:{room_id}"
        existing_json = await redis_client.get(key)
        existing = json.loads(existing_json) if existing_json else {}
        
        # Keep the current play state unless explicitly changed
        was_playing = existing.get('is_playing', False)

        new_state = {
            'is_playing': was_playing,  # Preserve play state
            'current_timestamp': float(current_ts or 0),
            'last_updated': datetime.utcnow().isoformat()
        }

        await _persist_and_broadcast(
            room_id, 
            new_state, 
            extra_event=('video_seeked', {
                'by': guest_id, 
                'current_timestamp': new_state['current_timestamp']
            })
        )
        
    except Exception as e:
        logger.exception(f"Error handling video_seek: {e}")


@sio.on('video:heartbeat')
async def video_heartbeat(sid, data):
    """
    Periodic heartbeat from moderator with current playback state.
    Used for passive sync checking without triggering broadcasts.
    
    Expected data: { room_id: str, guest_id: str, current_timestamp: float, is_playing: bool }
    """
    try:
        room_id = data.get('room_id')
        current_ts = data.get('current_timestamp')
        is_playing = data.get('is_playing')

        if not room_id or current_ts is None:
            return

        # Calculate adjusted timestamp if playing
        from app.core.redis_client import redis_client
        import json
        
        key = f"video_state:{room_id}"
        existing_json = await redis_client.get(key)
        existing = json.loads(existing_json) if existing_json else {}

        # If video is playing, calculate current position based on play_started_at
        adjusted_timestamp = float(current_ts)
        
        if is_playing and existing.get('play_started_at'):
            try:
                from dateutil import parser
                play_start = parser.parse(existing['play_started_at'])
                now = datetime.utcnow()
                elapsed = (now - play_start).total_seconds()
                base_timestamp = float(existing.get('current_timestamp', 0))
                adjusted_timestamp = base_timestamp + elapsed
                logger.debug(f"Heartbeat adjusted timestamp: {adjusted_timestamp} (base: {base_timestamp} + elapsed: {elapsed})")
            except Exception:
                pass

        merged = {
            **existing,
            'current_timestamp': adjusted_timestamp,
            'is_playing': is_playing,
            'last_updated': datetime.utcnow().isoformat()
        }
        
        # Only update if meaningful change
        old_ts = float(existing.get('current_timestamp', 0))
        if abs(adjusted_timestamp - old_ts) > SYNC_TOLERANCE_SECONDS:
            await redis_client.set(key, json.dumps(merged), expire=3600)
            logger.debug(f"Heartbeat updated state for room {room_id}")
            
    except Exception as e:
        logger.debug(f"Error handling video_heartbeat: {e}")


@sio.on('user:timestamp')
async def user_timestamp(sid, data):
    """
    Broadcast user's current timestamp to all other users in the room.
    This allows viewers to compare their position with admin/moderator.
    
    Expected data: { room_id: str, guest_id: str, timestamp: float, is_playing: bool }
    """
    try:
        room_id = data.get('room_id')
        guest_id = data.get('guest_id')
        timestamp = data.get('timestamp')
        is_playing = data.get('is_playing')

        if not room_id or timestamp is None:
            return

        # Broadcast to all users in the room (including sender for their own tracking)
        await sio.emit('user_timestamp', {
            'guest_id': guest_id,
            'timestamp': float(timestamp),
            'is_playing': is_playing,
        }, room=room_id)
        
    except Exception as e:
        logger.debug(f"Error handling user:timestamp: {e}")


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