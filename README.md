# Queue Cure — Live Clinic Queue System

Replace paper token slips with a real-time digital waiting room for neighbourhood clinics. Receptionists manage the queue on one screen; patients follow along on their phone or a waiting-room display — no refresh required.

## Features

| Capability | How it works |
|------------|--------------|
| Fast check-in | One field, one click (or Enter). Tokens auto-increment. |
| Live updates | Socket.io pushes `queue:update` to all connected clients instantly. |
| Smart wait times | `patientsAhead × effectiveAvgMinutes` — rolling average of the last 20 completed visits, with a receptionist-set fallback until enough data exists. |

## Screens

- **Reception** (`/`) — add patients, call next, complete visits, set average consultation time
- **Waiting room** (`/waiting`) — current token, queue position, estimated wait

Open both routes in two browser tabs to see real-time sync in action.

## Tech stack

- **Backend:** Node.js, Express, Socket.io, MongoDB (Mongoose)
- **Frontend:** React, Vite, Socket.io client

Express and MongoDB provide reliable real-time sync with persistent queue state across refreshes and restarts.

## Quick start

### Prerequisites

- Node.js 18+
- MongoDB (optional) — local Docker, [MongoDB Atlas](https://www.mongodb.com/atlas), or in-memory mode for local development

### Local development (no MongoDB install)

```bash
cd backend
npm install
npm run dev
```

`USE_MEMORY_DB=true` in `backend/.env` uses an embedded MongoDB for local runs. For production, use MongoDB Atlas and set `USE_MEMORY_DB=false`.

### Full setup with Docker MongoDB

```bash
docker compose up -d
```

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:3001`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

### Automated tests

With the backend running:

```bash
npm test
```

Runs API and live socket sync smoke tests against `http://localhost:3001`.

## Project structure

```
queue-cure/
├── backend/             Express API + Socket.io + MongoDB
├── frontend/            React — Reception + Waiting Room views
├── docs/
│   ├── SOCKET_DIAGRAM.md
│   └── ARCHITECTURE.md
├── scripts/
│   └── smoke-test.mjs
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

## Documentation

- [Socket event diagram](docs/SOCKET_DIAGRAM.md) — real-time sync architecture
- [Architecture & design notes](docs/ARCHITECTURE.md) — wait-time logic, concurrency, edge cases

## License

MIT
