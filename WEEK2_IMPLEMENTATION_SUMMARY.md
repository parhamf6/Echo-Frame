# Week 2 Implementation Summary - EchoFrame Backend

## Overview
Week 2 focuses on **room management** and **guest lifecycle** with comprehensive **security and anti-abuse** features. This document covers all endpoints, request/response formats, and frontend integration details.

---

## Part 1: Authentication (Week 1 Baseline)
*Admin login is prerequisite for room/guest management.*

### Admin Login Flow
**Endpoint:** `POST /api/v1/auth/login`

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin_password"
}
```

**Response (Success - 200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 1800
}
```

**Response Headers:**
```
Set-Cookie: refresh_token=<refresh_jwt>; HttpOnly; Path=/; SameSite=lax; [Secure if DEBUG=False]
```

**Frontend Implementation:**
```javascript
// 1. Login request
const loginResponse = await fetch('http://localhost:8000/api/v1/auth/login', {
  method: 'POST',
  credentials: 'include',  // CRITICAL: sends/receives cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin_password'
  })
});

const { access_token, expires_in } = await loginResponse.json();

// 2. Store access token in memory (or sessionStorage, NOT localStorage for security)
sessionStorage.setItem('accessToken', access_token);
sessionStorage.setItem('tokenExpiry', Date.now() + expires_in * 1000);

// 3. Use access token in all subsequent requests
const headers = {
  'Authorization': `Bearer ${access_token}`,
  'Content-Type': 'application/json'
};
```

---

## Part 2: Room Management

### 2.1 Create Room
**Endpoint:** `POST /api/v1/room`

**Requirements:**
- Admin only (requires valid `Authorization: Bearer <access_token>`)
- Only one active room allowed at a time

**Request Body:** Empty (no payload required)
```json
{}
```

**Response (Success - 200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "is_active": true,
  "created_at": "2025-11-26T10:30:00Z",
  "ended_at": null
}
```

**Error Cases:**
- `401 Unauthorized` - Missing/invalid access token
- `400 Bad Request` - `{"detail": "An active room already exists"}`

**Frontend Implementation:**
```javascript
async function createRoom(accessToken) {
  const response = await fetch('http://localhost:8000/api/v1/room', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to create room: ${response.statusText}`);
  }

  const room = await response.json();
  console.log(`Room created: ${room.id}`);
  return room; // Save room.id for later use
}
```

### 2.2 Get Room Status
**Endpoint:** `GET /api/v1/room/status`

**Requirements:**
- Public (no authentication required)
- Useful to check if room is active and get room_id before guest join

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "is_active": true,
  "current_users_count": 3,
  "created_at": "2025-11-26T10:30:00Z",
  "ended_at": null
}
```

**If no room exists:**
```json
{
  "id": null,
  "is_active": false,
  "current_users_count": 0,
  "created_at": null,
  "ended_at": null
}
```

**Frontend Implementation:**
```javascript
async function checkRoomStatus() {
  const response = await fetch('http://localhost:8000/api/v1/room/status');
  const status = await response.json();
  
  if (status.is_active && status.id) {
    console.log(`Room ${status.id} is live with ${status.current_users_count} guests`);
    return status.id;  // Use this room_id to join
  } else {
    console.log('No active room');
  }
  
  return null;
}

// Poll every 5 seconds while user is on page
setInterval(checkRoomStatus, 5000);
```

### 2.3 Close Room
**Endpoint:** `DELETE /api/v1/room/{room_id}`

**Requirements:**
- Admin only
- Triggers a 60-second countdown before room fully closes
- Guests can still watch during countdown but cannot join

**Path Parameters:**
- `room_id` (UUID) - from the room creation response

**Response (Success - 200):**
```json
{
  "detail": "Room closing",
  "ended_at": "2025-11-26T10:31:00Z"
}
```

**Frontend Implementation:**
```javascript
async function closeRoom(roomId, accessToken) {
  const response = await fetch(`http://localhost:8000/api/v1/room/${roomId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) throw new Error('Failed to close room');
  
  const result = await response.json();
  console.log(`Room closing. Guests have 60 seconds to finish watching.`);
  return result;
}
```

---

## Part 3: Guest Lifecycle

### 3.1 Guest Join (Request Access)
**Endpoint:** `POST /api/v1/guests/join`

**Requirements:**
- No authentication (guests are anonymous)
- Active room must exist
- Guest must provide the room_id they want to join

**Request Body:**
```json
{
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "alice",
  "fingerprint": "abc123def456ghi789"
}
```

**How to Get room_id:**
1. Call `GET /api/v1/room/status` first
2. Extract `id` from response
3. Include that `id` in the join request

**Fingerprint Generation (Frontend Responsibility):**
```javascript
import FingerprintJS from '@fingerprintjs/fingerprintjs';

async function getFingerprint() {
  const fp = await FingerprintJS.load();
  const result = await fp.get();
  return result.visitorId; // unique ID per browser/device
}

// Or use a simpler approach with basic browser info hashing
function getSimpleFingerprint() {
  const navigator_info = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    timezone: new Date().getTimezoneOffset()
  };
  
  const fingerprint = btoa(JSON.stringify(navigator_info));
  return fingerprint;
}
```

**Response (Success - 200):**
```json
{
  "guest_id": "660f9500-f40c-51e5-b827-557766551111",
  "session_token": "K8x9mN2pQ5rS7tU0vW3xY6zA9bC_dEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjK",
  "note": "pending approval"
}
```

**Error Cases:**
- `400 Bad Request` - Invalid room_id format
- `400 Bad Request` - Room not found or not active
- `400 Bad Request` - `{"detail": "Duplicate fingerprint detected from multiple IPs — possible abuse"}` (security: fingerprint used from multiple IPs)

**What Happens:**
1. Guest created in DB with `join_status: "pending"`
2. Session token stored in Redis (24-hour TTL)
3. Fingerprint tracked per room (to detect abuse)
4. **Admin must explicitly accept this guest** before they can join

**Frontend Implementation:**
```javascript
async function requestGuestAccess(username, fingerprint) {
  // 1. First get the active room
  const statusResponse = await fetch('http://localhost:8000/api/v1/room/status');
  const status = await statusResponse.json();
  
  if (!status.is_active || !status.id) {
    throw new Error('No active room available');
  }
  
  const roomId = status.id;
  
  // 2. Request to join that room
  const response = await fetch('http://localhost:8000/api/v1/guests/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room_id: roomId,
      username: username,
      fingerprint: fingerprint
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail);
  }

  const joinData = await response.json();
  
  // Store session token in memory/sessionStorage for subsequent requests
  sessionStorage.setItem('sessionToken', joinData.session_token);
  sessionStorage.setItem('guestId', joinData.guest_id);
  sessionStorage.setItem('roomId', roomId);
  
  // Display waiting message to guest
  showMessage("Request sent. Waiting for moderator approval...");
  
  return joinData;
}
```

### 3.2 Accept Guest (Admin Action)
**Endpoint:** `PATCH /api/v1/guests/{guest_id}/accept`

**Requirements:**
- Admin only
- Guest must be in "pending" status

**Path Parameters:**
- `guest_id` (UUID) - from guest join response

**Request Body:** Empty
```json
{}
```

**Response (Success - 200):**
```json
{
  "id": "660f9500-f40c-51e5-b827-557766551111",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "alice",
  "join_status": "accepted",
  "role": "viewer",
  "kicked": false,
  "created_at": "2025-11-26T10:31:15Z"
}
```

**Frontend (Admin Dashboard):**
```javascript
async function acceptGuest(guestId, adminAccessToken) {
  const response = await fetch(
    `http://localhost:8000/api/v1/guests/${guestId}/accept`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`
      }
    }
  );

  if (!response.ok) throw new Error('Failed to accept guest');
  
  const guest = await response.json();
  console.log(`${guest.username} accepted and can now watch`);
  
  // Optionally notify the guest via WebSocket that they're approved
  return guest;
}
```

**Listing pending requests (new endpoint)**
You can now list pending join requests via the admin-only endpoint:

```
GET /api/v1/guests/pending?room_id=<room_uuid>&limit=50
Authorization: Bearer <admin_access_token>
```

Response is an array of guest objects matching the `GuestResponse` schema.


### 3.3 Reject Guest (Admin Action)
**Endpoint:** `PATCH /api/v1/guests/{guest_id}/reject`

**Requirements:**
- Admin only
- Guest must be in "pending" status

**Response (Success - 200):**
```json
{
  "id": "660f9500-f40c-51e5-b827-557766551111",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "alice",
  "join_status": "rejected",
  "role": "viewer",
  "kicked": false,
  "created_at": "2025-11-26T10:31:15Z"
}
```

**Frontend (Admin Dashboard):**
```javascript
async function rejectGuest(guestId, adminAccessToken) {
  const response = await fetch(
    `http://localhost:8000/api/v1/guests/${guestId}/reject`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`
      }
    }
  );

  if (!response.ok) throw new Error('Failed to reject guest');
  
  const guest = await response.json();
  console.log(`${guest.username} rejected`);
}
```

### 3.4 Update Guest Permissions
**Endpoint:** `PATCH /api/v1/guests/{guest_id}/permissions`

**Requirements:**
- Admin only
- Guest must be accepted

**Request Body (any or all fields):**
```json
{
  "can_chat": true,
  "can_voice": false
}
```

**Response (Success - 200):**
```json
{
  "guest_id": "660f9500-f40c-51e5-b827-557766551111",
  "permissions": {
    "can_chat": true,
    "can_voice": false
  }
}
```

**Frontend (Admin Dashboard):**
```javascript
async function updateGuestPermissions(guestId, permissions, adminAccessToken) {
  const response = await fetch(
    `http://localhost:8000/api/v1/guests/${guestId}/permissions`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(permissions)
    }
  );

  if (!response.ok) throw new Error('Failed to update permissions');
  
  const result = await response.json();
  console.log(`${guestId} permissions updated:`, result.permissions);
}
```

### 3.5 Promote Guest to Moderator
**Endpoint:** `PATCH /api/v1/guests/{guest_id}/promote`

**Requirements:**
- Admin only
- Promotes guest `role` from "viewer" to "moderator"

**Request Body:** Empty
```json
{}
```

**Response (Success - 200):**
```json
{
  "id": "660f9500-f40c-51e5-b827-557766551111",
  "room_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "alice",
  "join_status": "accepted",
  "role": "moderator",
  "kicked": false,
  "created_at": "2025-11-26T10:31:15Z"
}
```

**Frontend (Admin Dashboard):**
```javascript
async function promoteGuest(guestId, adminAccessToken) {
  const response = await fetch(
    `http://localhost:8000/api/v1/guests/${guestId}/promote`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`
      }
    }
  );

  if (!response.ok) throw new Error('Failed to promote guest');
  
  const guest = await response.json();
  console.log(`${guest.username} is now a moderator`);
}
```

### 3.6 Kick Guest (Admin Action)
**Endpoint:** `DELETE /api/v1/guests/{guest_id}`

**Requirements:**
- Admin only
- Sets guest as `kicked: true` and bans IP + fingerprint until room ends

**Response (Success - 200):**
```json
{
  "detail": "Guest kicked and banned until room end"
}
```

**Behavior:**
- Guest is marked `kicked: true` in DB
- Guest's IP banned from joining any room (via Redis key `ban:ip:{room_id}:{ip}`)
- Guest's fingerprint banned from joining any room (via Redis key `ban:fp:{room_id}:{fingerprint}`)
- Bans expire when room countdown ends (60 seconds after close)

**Frontend (Admin Dashboard):**
```javascript
async function kickGuest(guestId, adminAccessToken) {
  const response = await fetch(
    `http://localhost:8000/api/v1/guests/${guestId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminAccessToken}`
      }
    }
  );

  if (!response.ok) throw new Error('Failed to kick guest');
  
  const result = await response.json();
  console.log(`Guest ${guestId} has been kicked and banned`);
}
```

### 3.7 Guest Session Refresh (Client Action)
**Endpoint:** `POST /api/v1/guests/session/refresh`

**Requirements:**
- Guest (uses `session_token` and `fingerprint` instead of JWT)
- Guest must be accepted and not kicked

**Request Body:**
```json
{
  "session_token": "K8x9mN2pQ5rS7tU0vW3xY6zA9bC_dEfGhIjKlMnOpQrStUvWxYzAbCdEfGhIjK",
  "fingerprint": "abc123def456ghi789"
}
```

**Response (Success - 200):**
```json
{
  "detail": "session refreshed"
}
```

**Purpose:**
- Keeps guest session alive (extends Redis TTL by 24 hours)
- Validates fingerprint hasn't changed (anti-spoofing)
- Ensures guest is still accepted and not kicked

**Frontend (Guest Page):**
```javascript
// Periodically refresh session to keep it alive
async function refreshGuestSession(sessionToken, fingerprint) {
  const response = await fetch('http://localhost:8000/api/v1/guests/session/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_token: sessionToken,
      fingerprint: fingerprint
    })
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 401) {
      console.log("Session expired or invalid");
      // Redirect to login/join page
    }
    throw new Error(error.detail);
  }

  console.log("Session refreshed");
}

// Refresh every 30 minutes (before 24-hour expiry)
setInterval(() => {
  refreshGuestSession(sessionToken, fingerprint);
}, 30 * 60 * 1000);
```

---

## Part 4: ID Resolution & Data Model

### How to Get Room ID

**The Proper Way (Recommended):**
```javascript
// 1. Check room status to get the active room_id
const statusResponse = await fetch('http://localhost:8000/api/v1/room/status');
const status = await statusResponse.json();

if (status.is_active && status.id) {
  const roomId = status.id;  // "550e8400-e29b-41d4-a716-446655440000"
  
  // 2. Use this room_id when joining as guest
  const joinResponse = await requestGuestAccess(username, fingerprint, roomId);
  
  // 3. Or when admin needs to close it
  const closeResponse = await closeRoom(roomId, accessToken);
} else {
  console.log('No active room');
}
```

**In Admin Context:**
```javascript
// When admin creates a room, they get the ID immediately
const roomResponse = await createRoom(accessToken);
const roomId = roomResponse.id;  // "550e8400-e29b-41d4-a716-446655440000"
```

**For Guests - Always Get ID from Status Endpoint:**
- Guests should **never** hardcode room_id
- Always call `GET /api/v1/room/status` first
- Extract the `id` field from response
- Include that `id` in the join request

### How to Get Guest ID

**From Guest Join Response:**
```javascript
const joinResponse = await requestGuestAccess(username, fingerprint);
const guestId = joinResponse.guest_id;  // "660f9500-f40c-51e5-b827-557766551111"
const sessionToken = joinResponse.session_token;  // For session refresh
```

### Data Model Summary

**Room:**
- `id` (UUID): unique room identifier
- `is_active` (bool): whether room is currently accepting guests
- `created_at` (datetime): when room was created
- `ended_at` (datetime): when room countdown started (60s remaining)

**Guest:**
- `id` (UUID): unique guest identifier
- `room_id` (UUID): ID of room guest joined
- `username` (string): guest's display name (2-50 chars)
- `session_token` (string): cryptographic token for guest authentication
- `fingerprint` (string): browser/device identifier
- `ip_address` (string): guest's IP (for ban tracking)
- `role` (enum): "viewer" or "moderator"
- `permissions_json` (object): `{"can_chat": bool, "can_voice": bool}`
- `join_status` (enum): "pending", "accepted", or "rejected"
- `kicked` (bool): whether guest has been removed
- `created_at` (datetime): when guest joined

---

## Part 5: Security Features

### Anti-Abuse Protection

**Fingerprint Tracking:**
- Each fingerprint per room is tracked with all IPs it connects from
- If same fingerprint seen from 2+ IPs → guest join is rejected with `400 Bad Request`
- **Purpose:** Prevent single person spoofing as multiple guests

**IP Banning:**
- When guest is kicked, their IP is banned for the room (stored in Redis: `ban:ip:{room_id}:{ip}`)
- Ban expires 60 seconds after room closes

**Fingerprint Banning:**
- When guest is kicked, their fingerprint is banned for the room (stored in Redis: `ban:fp:{room_id}:{fingerprint}`)
- Ban expires 60 seconds after room closes

**Rate Limiting:**
- Guest join attempts are rate-limited to 3 per hour per IP
- Helps prevent brute-force attacks

### Token Security

**Access Token (Admin):**
- JWT-based, stateless
- 30-minute expiry (production: 15 min recommended)
- Sent in Authorization header: `Bearer <token>`
- Contains admin ID

**Refresh Token (Admin):**
- Stored server-side in Redis with unique JTI (JWT ID)
- Sent as HttpOnly cookie (cannot be accessed by JavaScript)
- 7-day expiry
- Auto-rotated on each refresh (old token revoked, new one issued)

**Session Token (Guest):**
- Random 43-character cryptographic string
- Stored in Redis with 24-hour TTL
- Includes associated fingerprint + IP for validation

---

## Part 6: Environment & Configuration

### Required .env Variables

```bash
# Database (PostgreSQL)
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/echoframe
DATABASE_URL_SYNC=postgresql://user:password@localhost:5432/echoframe

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-secret-key-at-least-32-characters-long

# Application
DEBUG=True  # Set to False in production
ENVIRONMENT=development  # Set to 'production' in production
ACCESS_TOKEN_EXPIRE_MINUTES=30  # 15+ recommended for production
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS - Frontend URLs
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
```

### Development Setup

```bash
cd backend/echoframe_api

# Create admin user (one-time)
python scripts/create_admin.py

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Part 7: Frontend Integration Checklist

- [ ] Admin login page → stores access token
- [ ] Admin dashboard to:
  - [ ] Create room
  - [ ] View room status (poll every 5s)
  - [x] List pending guests (`GET /api/v1/guests/pending`)
  - [ ] Accept/reject pending guests
  - [ ] Update guest permissions
  - [ ] Promote guests to moderator
  - [ ] Kick guests
  - [ ] Close room (starts 60s countdown)
- [ ] Guest join page:
  - [ ] Generate fingerprint
  - [ ] Input username
  - [ ] **Call GET /api/v1/room/status to get room_id**
  - [ ] POST to join endpoint with room_id
  - [ ] Display "awaiting approval" message
  - [ ] Poll for acceptance (need status endpoint)
- [ ] Guest watch page:
  - [ ] Refresh session every 30 minutes
  - [ ] Display permissions (can_chat, can_voice)
  - [ ] Check if kicked (poll room/guest status)
  - [ ] Handle room closing countdown
- [ ] Token refresh on expiry (auto-refresh before 30-min expiry)
- [ ] Error handling for 401/403 responses (redirect to login)
- [ ] CORS configuration in frontend (credentials: 'include')

---

## Part 8: Next Steps (Week 2 Remaining)

**Pending Implementation:**
1. **WebSocket integration** - real-time notifications (guest accepted, kicked, promoted, permissions updated)
2. **Global IP ban middleware** - enforces bans at HTTP layer
3. **Global IP ban middleware** - enforces bans at HTTP layer
4. **Session validation middleware** - validates guest session on protected endpoints
5. **Backend unit tests** - ensure all endpoints work correctly
6. **Frontend integration examples** - React/Next.js components

---

