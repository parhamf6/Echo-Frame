# Week 1 Implementation Summary - EchoFrame Backend

## Overview
Week 1 focuses on **authentication and authorization** with JWT-based tokens, secure token rotation, and role-based access control. This foundation enables all subsequent features in Week 2+ (room management, guest lifecycle, etc.).

---

## Part 1: Authentication System Architecture

### System Design

**Token Types:**

1. **Access Token** (JWT, short-lived)
   - Stateless, verified on each request
   - 30-minute expiry (production: 15 min recommended)
   - Contains: `sub` (admin ID), `type: "access"`
   - Sent in request header: `Authorization: Bearer <token>`
   - Used to authenticate admin actions (create room, manage guests, etc.)

2. **Refresh Token** (JWT, long-lived + Server-stored)
   - Stored server-side in Redis with unique JTI (JWT ID)
   - 7-day expiry
   - Contains: `sub` (admin ID), `jti` (unique ID), `type: "refresh"`
   - Sent as HttpOnly cookie (inaccessible to JavaScript)
   - Used to obtain new access tokens without re-entering password
   - **Auto-rotated:** Old token revoked when new one issued (prevents token replay attacks)

**Why Two Token Types?**
- Access tokens are stateless (fast, scalable) but short-lived (security)
- Refresh tokens are stateful (validated via Redis) but long-lived (convenience)
- Separation of concerns: different expiry times, different security properties

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Week 1 Auth Flow                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Admin Login                                              │
│    POST /api/v1/auth/login                                 │
│    └─> Validate username/password                          │
│    └─> Create access token (JWT, 30min)                   │
│    └─> Create refresh token (JWT, 7day)                   │
│    └─> Store refresh JTI in Redis: refresh:{id}:{jti}    │
│    └─> Set HttpOnly cookie: refresh_token                 │
│    └─> Return access_token in JSON                        │
│                                                             │
│ 2. Protected Requests (use access token)                    │
│    GET/POST /api/v1/room, /api/v1/guests, etc.            │
│    └─> Extract token from Authorization header             │
│    └─> Verify signature & expiry (no DB lookup)            │
│    └─> Extract admin ID from token                         │
│    └─> Load Admin from DB (optional, for user info)        │
│                                                             │
│ 3. Access Token Refresh (before expiry)                     │
│    POST /api/v1/auth/refresh                               │
│    └─> Extract refresh token from cookie                   │
│    └─> Validate JTI exists in Redis                        │
│    └─> Revoke old JTI in Redis                             │
│    └─> Create new access token                             │
│    └─> Create new refresh token & JTI                      │
│    └─> Set new HttpOnly cookie                             │
│    └─> Return new access_token                             │
│                                                             │
│ 4. Logout (revoke tokens)                                   │
│    POST /api/v1/auth/logout                                │
│    └─> Extract refresh token from cookie                   │
│    └─> Revoke JTI in Redis                                 │
│    └─> Clear refresh_token cookie                          │
│    └─> Return logout confirmation                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 2: API Endpoints

### 2.1 Admin Login
**Endpoint:** `POST /api/v1/auth/login`

**Purpose:** Authenticate admin and obtain tokens

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
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ0eXBlIjoiYWNjZXNzIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  "expires_in": 1800
}
```

**Response Headers:**
```
Set-Cookie: refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; 
            HttpOnly; 
            Path=/; 
            SameSite=lax; 
            [Secure if DEBUG=False]
```

**Error Cases:**
- `401 Unauthorized` - `{"detail": "Invalid username or password"}`
- `422 Unprocessable Entity` - Missing or invalid fields

**Key Details:**
- `expires_in` is in seconds (1800 = 30 minutes)
- Refresh token sent as **HttpOnly cookie** (cannot be accessed by JavaScript)
- Access token sent in response body (store in memory or sessionStorage)
- **Credentials mode required:** Frontend must use `credentials: 'include'` to receive cookie

**Frontend Implementation:**
```javascript
// 1. Send login request with credentials mode
const loginResponse = await fetch('http://localhost:8000/api/v1/auth/login', {
  method: 'POST',
  credentials: 'include',  // CRITICAL: sends/receives cookies
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'admin_password'
  })
});

if (!loginResponse.ok) {
  const error = await loginResponse.json();
  throw new Error(`Login failed: ${error.detail}`);
}

// 2. Extract access token from response
const { access_token, expires_in } = await loginResponse.json();

// 3. Store access token in memory (NOT localStorage!)
sessionStorage.setItem('accessToken', access_token);
sessionStorage.setItem('tokenExpiry', Date.now() + expires_in * 1000);

// 4. Refresh token is automatically in cookie (handled by browser)
// No need to manually store it

console.log(`Logged in. Access token expires in ${expires_in}s`);
```

**Storage Best Practices:**
- ❌ DO NOT use `localStorage` for access tokens (vulnerable to XSS)
- ✅ DO use `sessionStorage` or in-memory variable
- ✅ Refresh token goes in HttpOnly cookie (protected by browser)

---

### 2.2 Refresh Access Token
**Endpoint:** `POST /api/v1/auth/refresh`

**Purpose:** Obtain new access token using refresh token before expiry

**Request:** No body required (refresh token read from cookie)

**Response (Success - 200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 1800
}
```

**Response Headers:**
```
Set-Cookie: refresh_token=<NEW_REFRESH_TOKEN>; 
            HttpOnly; 
            Path=/; 
            SameSite=lax
```

**Error Cases:**
- `401 Unauthorized` - `{"detail": "Missing refresh token"}` (cookie not sent)
- `401 Unauthorized` - `{"detail": "Invalid refresh token"}` (malformed or wrong type)
- `401 Unauthorized` - `{"detail": "Refresh token revoked or expired"}` (JTI not in Redis)

**What Happens on Success:**
1. Old refresh token JTI is revoked in Redis
2. New refresh token generated and JTI stored in Redis
3. New refresh token sent as cookie
4. New access token returned in JSON body

**Token Rotation Benefit:** If a refresh token is stolen, it can only be used once. After that, it's revoked and attacker cannot obtain new tokens.

**Frontend Implementation:**
```javascript
// Auto-refresh access token before expiry
async function refreshAccessToken() {
  const response = await fetch('http://localhost:8000/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include'  // CRITICAL: send cookie
  });

  if (!response.ok) {
    const error = await response.json();
    console.log(`Refresh failed: ${error.detail}`);
    // Redirect to login
    window.location.href = '/login';
    return;
  }

  const { access_token, expires_in } = await response.json();
  
  // Update stored token
  sessionStorage.setItem('accessToken', access_token);
  sessionStorage.setItem('tokenExpiry', Date.now() + expires_in * 1000);
  
  console.log(`Token refreshed. New expiry in ${expires_in}s`);
  return access_token;
}

// Refresh 2 minutes before expiry
function scheduleTokenRefresh() {
  const refreshInterval = setInterval(async () => {
    const expiry = parseInt(sessionStorage.getItem('tokenExpiry') || '0');
    const now = Date.now();
    const timeUntilExpiry = expiry - now;
    
    if (timeUntilExpiry < 2 * 60 * 1000) {  // Less than 2 min
      clearInterval(refreshInterval);
      await refreshAccessToken();
      scheduleTokenRefresh();  // Reschedule
    }
  }, 60 * 1000);  // Check every 1 min
}

// Call on app init
scheduleTokenRefresh();
```

---

### 2.3 Logout
**Endpoint:** `POST /api/v1/auth/logout`

**Purpose:** Revoke refresh token and clear session

**Request:** No body required (refresh token read from cookie)

**Response (Success - 200):**
```json
{
  "detail": "Logged out"
}
```

**Response Headers:**
```
Set-Cookie: refresh_token=; Max-Age=0; Path=/
```

**What Happens:**
1. Refresh token JTI is revoked in Redis (cannot be used again)
2. Cookie is cleared (Max-Age=0)
3. Any existing access tokens still valid until expiry (stateless, can't be revoked immediately)
   - This is acceptable because they expire in 30 minutes anyway
   - For better security, app can maintain a blacklist or shorter token lifetime

**Error Handling:**
- If no cookie present, logout still succeeds (idempotent)

**Frontend Implementation:**
```javascript
async function logout() {
  const response = await fetch('http://localhost:8000/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'include'  // CRITICAL: send cookie
  });

  if (!response.ok) {
    console.error('Logout failed');
    // Even on failure, clear local state
  }

  // Clear local storage
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('tokenExpiry');
  
  // Redirect to login
  window.location.href = '/login';
}
```

---

### 2.4 Verify Token (Protected Endpoint)
**Endpoint:** `GET /api/v1/auth/me`

**Purpose:** Test that access token is valid and get basic admin info

**Requirements:**
- Valid access token in `Authorization: Bearer <token>` header
- Admin must exist in database

**Request Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (Success - 200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "admin",
  "created_at": "2025-11-26T10:00:00Z"
}
```

**Error Cases:**
- `401 Unauthorized` - Missing/invalid token
- `401 Unauthorized` - Token expired
- `404 Not Found` - Admin ID in token doesn't exist in DB

**Frontend Implementation:**
```javascript
async function verifyAdminSession(accessToken) {
  const response = await fetch('http://localhost:8000/api/v1/auth/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      console.log('Token invalid or expired');
      // Trigger refresh or redirect to login
    }
    throw new Error('Failed to verify session');
  }

  const admin = await response.json();
  console.log(`Authenticated as: ${admin.username}`);
  return admin;
}

// Check on app startup
const token = sessionStorage.getItem('accessToken');
if (token) {
  try {
    await verifyAdminSession(token);
  } catch (e) {
    console.log('Need to refresh token or login');
    await refreshAccessToken();
  }
}
```

---

## Part 3: Security Implementation Details

### Password Hashing (Bcrypt)

**Storage:**
- Admin passwords stored as bcrypt hashes in database
- Never store plaintext passwords
- Hash includes salt (bcrypt internally generates random salt)

**Verification Flow:**
```
Login Request: admin_password
    ↓
Fetch Admin from DB: hashed_password
    ↓
Compare plaintext with hash using bcrypt
    ↓
Match → Create tokens
No match → Return 401 Unauthorized
```

**Code Reference:**
```python
# app/core/security.py
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hash password on admin creation
hashed = pwd_context.hash(plaintext_password)

# Verify on login
is_valid = pwd_context.verify(plaintext_password, hashed_password)
```

### JWT Token Structure

**Token Format:** `header.payload.signature`

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload (Access Token):**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "type": "access",
  "exp": 1732635000,
  "iat": 1732633200
}
```

**Payload (Refresh Token):**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "jti": "unique-refresh-id-xyz",
  "type": "refresh",
  "exp": 1733240000,
  "iat": 1732633200
}
```

**Signature:**
```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  SECRET_KEY
)
```

**Verification:**
1. Decode header and payload (not verified yet, could be tampered)
2. Recompute signature using SECRET_KEY
3. Compare computed signature with token signature
4. Check expiry (`exp` claim)
5. Extract `sub` (admin ID)

**Code Reference:**
```python
# app/core/security.py
from jose import jwt
from datetime import datetime, timedelta

def create_access_token(data: dict):
    expire = datetime.utcnow() + timedelta(minutes=30)
    to_encode = data.copy()
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")

def decode_token(token: str):
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    return payload
```

---

## Part 4: Cookie Security

### HttpOnly Cookies

**What is HttpOnly?**
- Cookie flag that prevents JavaScript from accessing the cookie
- Cookie is automatically sent by browser on each request
- Protects against XSS (Cross-Site Scripting) attacks

**Example Cookie Header:**
```
Set-Cookie: refresh_token=abc123xyz; 
            HttpOnly; 
            Path=/; 
            SameSite=lax; 
            Secure
```

**Cookie Flags Explained:**

| Flag | Purpose |
|------|---------|
| `HttpOnly` | Prevent JavaScript access (protects against XSS) |
| `Secure` | Only send over HTTPS (production only) |
| `SameSite=lax` | Prevent CSRF attacks; allow cross-site GET |
| `Path=/` | Cookie sent for all paths on domain |
| `Max-Age` | Cookie lifetime in seconds |

**Frontend Cookie Handling:**

```javascript
// ✅ CORRECT: Cookies automatically handled by browser
fetch('http://localhost:8000/api/v1/auth/login', {
  credentials: 'include'  // Required to send/receive cookies
});

// ❌ WRONG: Cannot access refresh_token cookie from JavaScript
const refreshToken = document.cookie;  // Will NOT include HttpOnly cookies!

// ✅ CORRECT: Access token stored in sessionStorage
const accessToken = sessionStorage.getItem('accessToken');
fetch('http://localhost:8000/api/v1/room', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### CORS Configuration

**Why CORS Matters:**
- Frontend and backend may run on different ports/domains
- Browser blocks cross-origin requests by default
- CORS headers tell browser to allow specific origins

**Backend Configuration:**
```python
# app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js dev
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,  # CRITICAL for cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)
```

**Key Setting:**
- `allow_credentials=True` enables cookie sending (required for refresh token cookie)

---

## Part 5: Token Validation Dependency

### How Protected Routes Work

**Dependency Injection Pattern:**
```python
# app/api/deps.py
from fastapi import Depends

async def get_current_admin(token: str = Depends(oauth2_scheme)) -> Admin:
    """
    Validates access token and returns Admin object.
    Used as: admin=Depends(get_current_admin)
    """
    # Decode and validate token
    payload = security.decode_token(token)
    
    # Extract admin ID
    admin_id = payload.get("sub")
    
    # Load Admin from database
    admin = await db.execute(select(Admin).where(Admin.id == admin_id))
    
    # Return admin (or raise 401 if not found)
    return admin
```

**Usage in Routes:**
```python
# app/api/v1/room.py
@router.post("/")
async def create_room(admin=Depends(get_current_admin), db=Depends(get_db)):
    """
    Only admins with valid token can call this.
    FastAPI automatically:
    1. Extracts token from Authorization header
    2. Validates it
    3. Loads Admin from DB
    4. Passes admin object to function
    """
    # admin is guaranteed to be valid
    room = await room_service.create_room(db)
    return room
```

**Error Handling:**
```
If token missing:
  Response: 403 Forbidden
  Body: {"detail": "Not authenticated"}

If token invalid:
  Response: 403 Forbidden
  Body: {"detail": "Invalid token"}

If admin not in DB:
  Response: 401 Unauthorized
  Body: {"detail": "Admin not found"}
```

---

## Part 6: Setup & Configuration

### Environment Variables

**Required `.env` file in `backend/echoframe_api/`:**

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/echoframe
DATABASE_URL_SYNC=postgresql://user:password@localhost:5432/echoframe

# Redis (for refresh token storage)
REDIS_URL=redis://localhost:6379/0

# Security - CHANGE THESE IN PRODUCTION!
SECRET_KEY=your-random-secret-key-min-32-characters-long
ALGORITHM=HS256

# Token Expiry
ACCESS_TOKEN_EXPIRE_MINUTES=30    # Development: 30min, Production: 15min
REFRESH_TOKEN_EXPIRE_DAYS=7

# Application
DEBUG=True                         # Set to False in production
ENVIRONMENT=development            # Set to 'production' in production
APP_NAME=EchoFrame

# CORS - Add your frontend URL
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# Cookie settings
REFRESH_COOKIE_NAME=refresh_token
REFRESH_COOKIE_SAMESITE=lax
```

### Database Models

**Admin Table:**
```python
class Admin(Base):
    __tablename__ = "admins"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### Create Admin User

**One-time setup to create first admin:**

```bash
cd backend/echoframe_api

# Run script
python scripts/create_admin.py

# Follow prompts to enter username and password
```

**Script Code:**
```python
# scripts/create_admin.py
from app.core.security import pwd_context
from app.models.admin import Admin

username = input("Username: ")
password = input("Password: ")

admin = Admin(
    username=username,
    password_hash=pwd_context.hash(password)
)

# Save to DB...
```

### Development Server

```bash
cd backend/echoframe_api

# Install dependencies
pip install -r requirements.txt

# Apply database migrations (if any)
alembic upgrade head

# Create first admin
python scripts/create_admin.py

# Start server (auto-reload on code changes)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

---

## Part 7: Frontend Implementation Guide

### 1. Login Page

```typescript
// pages/admin/login.tsx
import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',  // CRITICAL
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Login failed');
      }

      const { access_token, expires_in } = await response.json();

      // Store token
      sessionStorage.setItem('accessToken', access_token);
      sessionStorage.setItem('tokenExpiry', String(Date.now() + expires_in * 1000));

      // Redirect to dashboard
      window.location.href = '/admin/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
}
```

### 2. Authentication Hook

```typescript
// hooks/useAuth.ts
import { useEffect, useState } from 'react';

export function useAuth() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Load token from storage
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      setAccessToken(token);
      setIsAuthenticated(true);
    }

    // Setup auto-refresh (2 min before expiry)
    const refreshInterval = setInterval(async () => {
      const expiry = parseInt(sessionStorage.getItem('tokenExpiry') || '0');
      if (Date.now() + 2 * 60 * 1000 > expiry) {
        await refreshToken();
      }
    }, 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, []);

  async function refreshToken() {
    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Refresh failed');

      const { access_token, expires_in } = await response.json();
      setAccessToken(access_token);
      sessionStorage.setItem('accessToken', access_token);
      sessionStorage.setItem('tokenExpiry', String(Date.now() + expires_in * 1000));
    } catch (err) {
      logout();
    }
  }

  async function logout() {
    await fetch('http://localhost:8000/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });

    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('tokenExpiry');
    setAccessToken(null);
    setIsAuthenticated(false);
    window.location.href = '/admin/login';
  }

  return { accessToken, isAuthenticated, logout, refreshToken };
}
```

### 3. Protected API Calls

```typescript
// lib/api.ts
export async function apiCall(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string
) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`http://localhost:8000${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (response.status === 401) {
    // Token expired, redirect to login
    window.location.href = '/admin/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'API error');
  }

  return response.json();
}

// Usage in components
const admin = useAuth();
const roomData = await apiCall('/api/v1/room', {}, admin.accessToken);
```

---

## Part 8: Testing the Auth Flow

### Manual Testing with cURL

```bash
# 1. Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin_password"}' \
  -c cookies.txt

# Response includes access token (and refresh cookie in cookies.txt)

# 2. Get me (with token)
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Response: {"id":"...", "username":"admin", "created_at":"..."}

# 3. Refresh token (with cookie)
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -b cookies.txt \
  -c cookies.txt

# Response includes new access token

# 4. Logout
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -b cookies.txt
```

### Testing with Python

```python
import requests

# Session handles cookies automatically
session = requests.Session()

# 1. Login
response = session.post(
    'http://localhost:8000/api/v1/auth/login',
    json={'username': 'admin', 'password': 'admin_password'}
)
token = response.json()['access_token']
print(f"Access token: {token}")

# 2. Call protected endpoint
headers = {'Authorization': f'Bearer {token}'}
response = session.get('http://localhost:8000/api/v1/auth/me', headers=headers)
print(response.json())

# 3. Refresh token (cookies auto-handled by session)
response = session.post('http://localhost:8000/api/v1/auth/refresh')
new_token = response.json()['access_token']
print(f"New token: {new_token}")

# 4. Logout
session.post('http://localhost:8000/api/v1/auth/logout')
```

---

## Part 9: Security Checklist

### Development Security
- ✅ Passwords hashed with bcrypt
- ✅ Access tokens short-lived (30 min)
- ✅ Refresh tokens server-stored in Redis
- ✅ Refresh tokens auto-rotated
- ✅ Tokens signed with HMAC-SHA256
- ✅ HttpOnly cookies prevent XSS access to refresh token
- ✅ CORS configured for specific origins

### Production Checklist
- [ ] Set `DEBUG=False` in .env
- [ ] Set `ENVIRONMENT=production` in .env
- [ ] Use strong `SECRET_KEY` (32+ random characters)
- [ ] Set `ACCESS_TOKEN_EXPIRE_MINUTES=15` (or less)
- [ ] Update `ALLOWED_ORIGINS` with actual frontend domains
- [ ] Enable cookie `Secure` flag (auto with DEBUG=False)
- [ ] Use HTTPS only (required for Secure cookies)
- [ ] Run `settings.validate_secrets()` on startup
- [ ] Use environment variables, not hardcoded values
- [ ] Set up rate limiting on login endpoint
- [ ] Monitor for token reuse/replay attacks
- [ ] Implement audit logging for sensitive actions

---

## Part 10: Common Issues & Troubleshooting

### Issue: Cookies Not Being Sent

**Symptom:** Refresh endpoint returns "Missing refresh token"

**Causes:**
- Frontend not using `credentials: 'include'`
- CORS not configured with `allow_credentials=True`
- Cookie domain/path mismatch

**Solution:**
```javascript
// ✅ Correct
fetch('http://localhost:8000/api/v1/auth/refresh', {
  credentials: 'include'  // Must be included
});
```

### Issue: "Invalid Token" on Every Request

**Symptom:** Every request returns 401 Unauthorized

**Causes:**
- Token not being sent in Authorization header
- Token format wrong (should be `Bearer <token>`, not `<token>`)
- Token signature mismatch (SECRET_KEY changed)

**Solution:**
```javascript
// ✅ Correct format
const headers = {
  'Authorization': `Bearer ${token}`
};

fetch('http://localhost:8000/api/v1/room', { headers });
```

### Issue: CORS Error When Logging In

**Symptom:** Browser console shows CORS error

**Causes:**
- Frontend origin not in `ALLOWED_ORIGINS`
- `allow_credentials=True` not set in CORS middleware

**Solution:**
```python
# app/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,  # REQUIRED for cookies
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["*"],
)
```

### Issue: Token Never Expires

**Symptom:** Admin can use token indefinitely

**Causes:**
- Token expiry not checked in code
- Clock skew between frontend and backend
- Incorrect `exp` claim in token

**Solution:** Ensure server clock is synchronized (NTP). Frontend should refresh before 30 minutes.

---

## Part 11: Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ Week 1 Authentication Architecture                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  FRONTEND (Next.js)                                          │
│  ├─ Login Page                                              │
│  ├─ Token Storage (sessionStorage + HttpOnly cookie)        │
│  ├─ useAuth Hook (auto-refresh, logout)                     │
│  └─ API Wrapper (adds Authorization header)                 │
│                                                              │
│  HTTP/CORS ↔ CORS Middleware (allow_credentials=True)       │
│                                                              │
│  BACKEND (FastAPI)                                           │
│  ├─ POST /api/v1/auth/login                                 │
│  │  └─ Validate credentials                                 │
│  │  └─ Create JWT access token                             │
│  │  └─ Create JWT refresh token & store JTI in Redis       │
│  │  └─ Set HttpOnly cookie                                 │
│  │                                                          │
│  ├─ POST /api/v1/auth/refresh                               │
│  │  └─ Read refresh token from cookie                      │
│  │  └─ Validate JTI in Redis                               │
│  │  └─ Revoke old JTI, issue new token & JTI              │
│  │                                                          │
│  ├─ POST /api/v1/auth/logout                                │
│  │  └─ Revoke JTI in Redis                                 │
│  │  └─ Clear cookie                                        │
│  │                                                          │
│  ├─ Protected Routes                                        │
│  │  └─ Dependency: get_current_admin                       │
│  │  └─ Extracts token, validates signature                 │
│  │  └─ Loads Admin from DB                                 │
│  │                                                          │
│  DATABASE (PostgreSQL)                                       │
│  └─ admins table (id, username, password_hash, created_at) │
│                                                              │
│  CACHE (Redis)                                               │
│  └─ refresh:{admin_id}:{jti} → "1" (with 7d TTL)           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Part 12: Next Steps to Week 2

With Week 1 auth complete, you can now:

1. **Create protected endpoints** that require valid access tokens
2. **Access admin information** via `get_current_admin` dependency
3. **Build admin dashboard** to manage rooms and guests
4. **Implement guest features** with separate session-token auth (Week 2)

**Week 2 builds on this foundation:**
- Room endpoints (protected by `get_current_admin`)
- Guest join/accept/reject (public endpoints, later protected by session token)
- Permission and moderation features (protected by `get_current_admin`)

