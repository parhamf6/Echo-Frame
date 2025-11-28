# Echo Frame

> **A synchronized video watch party platform with real-time chat and voice powered by LiveKit**

Echo Frame enables groups to watch videos together in perfect sync, with integrated text and voice chat. Built for self-hosting, it's ideal for movie nights, study groups, or any shared viewing experience with friends and family.

[![GitHub](https://img.shields.io/badge/github-Echo--Frame-blue?logo=github)](https://github.com/parhamf6/Echo-Frame)
[![Python](https://img.shields.io/badge/python-3.11+-blue?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black?logo=next.js)](https://nextjs.org/)
[![LiveKit](https://img.shields.io/badge/LiveKit-enabled-purple?logo=livekit)](https://livekit.io/)

---

## ✨ Features

### 🎬 **Synchronized Video Playback**
- **Perfect sync:** All users watch at the same timestamp
- **Admin/Moderator controls:** Play, pause, seek, and switch videos for everyone
- **Individual control:** Users can pause personally and sync back when ready
- **Adaptive streaming:** HLS with multiple quality options (1080p, 720p, 480p, 360p)
- **Multi-language subtitles:** Support for .srt, .vtt, and .ass formats

### 💬 **Real-Time Communication (Powered by LiveKit)**
- **Text chat:** Messages, replies, and emoji reactions (👍❤️😂🔥💯)
- **Voice chat:** Crystal-clear audio using SFU WebRTC architecture
- **Scalable:** Supports large groups without performance degradation
- **Reliable:** Built on battle-tested LiveKit infrastructure

### 👥 **Role-Based Access Control**
- **3 roles:** Viewer, Moderator, Admin
- **Granular permissions:** Admin/Moderator can toggle chat and voice access per user
- **Flexible management:** Promote viewers to moderators, kick disruptive users

### 🔒 **Security & Anti-Abuse**
- **Browser fingerprinting:** Tracks users across sessions
- **IP tracking & banning:** Kicked users stay banned until room ends
- **Rate limiting:** Prevents spam (3 join requests per hour per IP)
- **Session management:** Secure JWT-based authentication with refresh tokens

### 📱 **Mobile-First Design**
- **Responsive UI:** Optimized for phones, tablets, and desktops
- **Touch-friendly:** Intuitive controls for mobile devices
- **Background voice:** Voice chat continues when app is in background

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Admin Device │  │Guest Devices │  │  CLI Tool    │ │
│  │  (Browser)   │  │  (Browser)   │  │  (FFmpeg)    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             ↓
          ┌─────────────────────────────────────┐
          │         NGINX REVERSE PROXY         │
          │  • HTTPS/SSL Termination            │
          │  • HLS Video Streaming              │
          │  • WebSocket Proxy (LiveKit)        │
          └─────────┬───────────────────────────┘
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
┌─────────┐  ┌─────────────┐  ┌──────────┐
│ FastAPI │  │  LiveKit    │  │  Nginx   │
│   API   │  │   Server    │  │  (HLS)   │
│         │  │  • Voice    │  │          │
│  • Auth │  │  • Text     │  │  Videos  │
│  • Room │  │  • WebRTC   │  │  Static  │
│  • User │  │             │  │          │
└────┬────┘  └─────────────┘  └──────────┘
     │
     ├───────────┬───────────┐
     ↓           ↓           ↓
┌──────────┐ ┌───────┐ ┌──────────┐
│PostgreSQL│ │ Redis │ │File      │
│          │ │       │ │System    │
│ • Users  │ │ • Chat│ │          │
│ • Rooms  │ │ • Bans│ │ • Videos │
│ • Videos │ │ • Rate│ │ • Subs   │
│ • Logs   │ │ • Sess│ │          │
└──────────┘ └───────┘ └──────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Docker** 24+ and **Docker Compose** 2.20+
- **Python** 3.11+ (for CLI tool)
- **FFmpeg** (for video processing)
- **4GB RAM** minimum
- **50GB+ storage** (for videos)

### 1. Clone Repository

```bash
git clone https://github.com/parhamf6/Echo-Frame.git
cd Echo-Frame
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your settings
nano .env
```

**Key settings to change:**
- `SECRET_KEY`: Generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- `POSTGRES_PASSWORD`: Strong random password
- `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`: Generate from LiveKit dashboard

### 3. Start Services

```bash
# Start all services (FastAPI, PostgreSQL, Redis, LiveKit, Nginx)
docker-compose up -d

# Check services are running
docker-compose ps
```

### 4. Create Admin User

```bash
# Navigate to backend
cd backend/echoframe_api

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create admin
python scripts/create_admin.py --username admin --password YourSecurePassword
```

### 5. Access Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000/docs (Swagger UI)
- **LiveKit:** http://localhost:7880

**Default Admin Credentials:**
- Username: `admin`
- Password: `YourSecurePassword` (what you set above)

---

## 📹 Video Processing (CLI Tool)

Echo Frame uses a CLI tool to process videos into HLS format on your local machine, then uploads them to the server.

### Install CLI Tool

```bash
cd cli-tool
pip install -e .
```

### Configure CLI

```bash
# Create config file
echo-frame config --server-url http://localhost:8000 --token YOUR_ADMIN_ACCESS_TOKEN
```

### Process & Upload Video

```bash
# Process video with auto-detected qualities + subtitles
echo-frame process movie.mp4 \
  --subtitles en:english.srt es:spanish.srt ar:arabic.srt \
  --output ./processed/

# Upload to server
echo-frame upload ./processed/ --title "Movie Night - Episode 1"
```

**Output:**
- Multiple quality streams (1080p, 720p, 480p, 360p)
- HLS manifest (.m3u8) and segments (.ts)
- Converted subtitles (.vtt)
- Auto-generated thumbnail

---

## 🎮 How It Works

### Admin Workflow

1. **Create Room**
   - Admin logs in → Dashboard → "Create Room"
   - Only 1 active room at a time

2. **Upload Videos**
   - Process videos locally with CLI tool
   - Upload to server → Videos added to global playlist

3. **Manage Guests**
   - Guests send join requests
   - Admin approves/rejects from dashboard
   - Set permissions: toggle chat/voice per user
   - Promote viewers to moderators
   - Kick disruptive users (banned until room closes)

4. **Control Playback**
   - Select video from playlist
   - Play/pause/seek controls sync to all users
   - Switch between videos seamlessly

5. **Close Room**
   - Click "End Room" → 60-second countdown
   - All users disconnected
   - Data archived for analytics

### Guest Workflow

1. **Join Room**
   - Visit `/room`
   - Enter username → Browser fingerprint generated
   - Wait for admin approval

2. **Watch & Interact**
   - Video syncs automatically with admin/moderator
   - Can pause individually → "Sync Now" button to catch up
   - Can only rewind (no forward seeking past live position)
   - Chat and voice (if permissions granted)

3. **Permissions**
   - **Viewer (default):** Watch video, limited controls
   - **Moderator (promoted):** Control playback, kick users, manage permissions

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **State:** Zustand
- **Video Player:** Video.js with HLS.js
- **Real-time:** LiveKit React SDK

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Database:** PostgreSQL 15+ (SQLAlchemy ORM)
- **Cache:** Redis 7+ (chat messages, sessions, bans)
- **Migrations:** Alembic
- **Authentication:** JWT (access + refresh tokens)
- **Real-time:** LiveKit Server

### Video Processing
- **Tool:** FFmpeg (via Python CLI)
- **Format:** HLS (HTTP Live Streaming)
- **Qualities:** 1080p, 720p, 480p, 360p (adaptive)
- **Subtitles:** .srt, .vtt, .ass support

### Infrastructure
- **Containerization:** Docker + Docker Compose
- **Web Server:** Nginx (reverse proxy + HLS streaming)
- **Voice/Chat:** LiveKit (self-hosted, SFU WebRTC)

---

## 📁 Project Structure

```
echo-frame/
├── frontend/echo-frame-front/     # Next.js application
│   ├── app/                       # App Router pages
│   ├── components/                # React components
│   ├── lib/                       # Utilities (API, LiveKit)
│   ├── hooks/                     # Custom React hooks
│   ├── store/                     # Zustand state
│   └── types/                     # TypeScript types
│
├── backend/echoframe_api/         # FastAPI application
│   ├── app/
│   │   ├── api/v1/               # API routes
│   │   ├── core/                 # Config, database, security
│   │   ├── models/               # SQLAlchemy models
│   │   ├── schemas/              # Pydantic schemas
│   │   ├── services/             # Business logic
│   │   └── utils/                # Helpers
│   ├── alembic/                  # Database migrations
│   ├── scripts/                  # Utility scripts
│   └── storage/                  # Uploaded videos
│
├── cli-tool/                      # FFmpeg video processor
│   ├── echo_frame_cli/           # CLI package
│   └── README.md                 # CLI documentation
│
├── nginx/                         # Nginx configuration
├── livekit/                       # LiveKit configuration
├── docs/                          # Documentation
└── docker-compose.yml            # Service orchestration
```

---

## 🔧 Development Setup

### Backend Development

```bash
cd backend/echoframe_api

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8000
```

### Frontend Development

```bash
cd frontend/echo-frame-front

# Install dependencies
pnpm install

# Start development server
pnpm run dev
```


---

## 📊 Database Schema

### Core Tables

**admins**
- Admin user accounts (hashed passwords)

**room**
- Single active room (created_at, ended_at, is_active)

**guests**
- Guest users with session tokens, fingerprints, IP addresses
- Roles: viewer, moderator
- Permissions: can_chat, can_voice (JSONB)
- Join status: pending, accepted, rejected

**videos**
- Video metadata (title, HLS manifest path, duration)
- Global playlist order

**subtitles**
- Multi-language subtitle tracks per video

**analytics_logs**
- Event logging (user joins, video plays, messages)

---

## 🔒 Security Features

### Authentication
- **JWT tokens:** Access (15 min) + Refresh (7 days)
- **HTTP-only cookies:** Refresh tokens stored securely
- **Bcrypt hashing:** All passwords hashed with 12 rounds

### Anti-Abuse
- **Browser fingerprinting:** FingerprintJS for user tracking
- **IP tracking:** All requests logged with IP
- **Rate limiting:** 3 join requests per hour per IP (Redis-based)
- **Bans:** Kicked users banned by IP + fingerprint until room ends
- **Duplicate detection:** Same fingerprint with different IPs blocked

### Data Protection
- **Session tokens:** Unique per guest, invalidated on kick
- **CORS:** Configurable allowed origins
- **Input validation:** Pydantic schemas on all endpoints
- **SQL injection:** Protected by SQLAlchemy ORM

---


### Monitoring

- **Logs:** `docker-compose logs -f`
- **Health checks:** `/api/v1/health`
- **LiveKit dashboard:** Monitor voice/chat usage

---

## 🤝 Contributing

Contributions are welcome! This is an MVP project focused on core functionality.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


---

## 📝 API Documentation

Full API documentation available at:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc


---

## 📜 License

This project is currently under development. License to be determined.

---

## 🙏 Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Next.js](https://nextjs.org/) - React framework
- [LiveKit](https://livekit.io/) - Real-time communication infrastructure
- [Video.js](https://videojs.com/) - HTML5 video player
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components

---

## 📧 Contact

- **GitHub:** [@parhamf6](https://github.com/parhamf6)
- **Repository:** [Echo-Frame](https://github.com/parhamf6/Echo-Frame)

---

**⭐ Star this repo if you find it useful!**

---

*Echo Frame - Watch together, anywhere.*