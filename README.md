# Queue Cure '26 — Live Clinic Queue System

Replace paper token slips with a real-time digital waiting room. Built for the Wooble **Queue Cure '26** hackathon.

> All application code lives in this `Project/` folder. The hackathon brief (`Hackathon details.txt`) stays in the parent workspace root.

## The three answers judges care about

| Question | How Queue Cure answers it |
|----------|---------------------------|
| Add a patient in under 10 seconds? | **Yes** — one field, one click (or Enter). Token auto-increments. |
| Patient screen updates live? | **Yes** — Socket.io pushes `queue:update` to all clients instantly. |
| Wait time from real data? | **Yes** — `patientsAhead × effectiveAvgMinutes`, where avg comes from a **rolling average of completed consultations** (last 20), falling back to receptionist-set baseline. |

## Demo moment (one sentence)

> *"Add 'Ravi' on the reception screen — within a second his token #4 appears on the waiting room TV with '~24 min' computed from queue position and today's actual consultation times, and when you hit Call Next both screens flip without anyone refreshing."*

## Live demo

- **Receptionist:** `/` — add patients, call next, complete visits, set avg time  
- **Waiting room:** `/waiting` — large "now serving" display + up-next list with live wait estimates  

Open both routes in two browser tabs to see real-time sync.

## Tech stack

- **Backend:** Node.js, Express, Socket.io, MongoDB (Mongoose)
- **Frontend:** React, Vite, Socket.io client
- **Why this stack:** Matches hackathon skill signals (Express + MongoDB), gives reliable real-time sync, and persists queue state across refreshes.

## Quick start

### Prerequisites

- Node.js 18+
- MongoDB (optional) — local Docker, [MongoDB Atlas](https://www.mongodb.com/atlas), or **in-memory demo mode** (enabled by default in `.env`)

### Quick demo (no MongoDB install)

From the `Project/` folder:

```bash
cd Project   # if you're at the workspace root
cd backend
npm install
npm run dev
```

`USE_MEMORY_DB=true` in `backend/.env` starts an embedded MongoDB for demos. For production/hackathon judging, use real MongoDB Atlas and set `USE_MEMORY_DB=false`.

### Full setup with Docker MongoDB

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:3001`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

## Project structure

```
Queue Cure '26/
├── Hackathon details.txt    # hackathon brief (workspace root)
└── Project/
    ├── backend/             Express API + Socket.io + MongoDB
    ├── frontend/            React — Reception + Waiting Room views
    ├── docs/
    │   ├── SOCKET_DIAGRAM.md
    │   └── THOUGHT_PROCESS.md
    ├── docker-compose.yml
    └── README.md
```

## API overview

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/queue` | Full queue snapshot |
| POST | `/api/patients` | Add patient + issue token |
| POST | `/api/queue/call-next` | Call lowest waiting token |
| POST | `/api/queue/complete` | Finish consultation, record duration |
| POST | `/api/queue/no-show` | Mark current as no-show |
| PATCH | `/api/settings/avg-consultation` | Set baseline avg minutes |
| POST | `/api/queue/reset-day` | End-of-day reset |

Every mutating endpoint broadcasts `queue:update` via WebSocket.

## Submission checklist (Wooble)

- [ ] Live prototype URL or demo video
- [ ] This GitHub repo + README
- [ ] [Socket event diagram](docs/SOCKET_DIAGRAM.md)
- [ ] [Thought process sheet](docs/THOUGHT_PROCESS.md)

## Author

Built for Queue Cure '26 — Full Stack hackathon.
