# Queue Cure

Live digital waiting room for neighbourhood clinics. Reception runs the queue on one screen; patients follow status on a phone or wall display. **Reception and waiting room stay in sync over Socket.io** without manual refresh.

**Live demo:** [Reception](https://queue-cure-visshva.vercel.app/) · [Waiting room](https://queue-cure-visshva.vercel.app/waiting)  
**Repo:** [github.com/visshva-r/Queue-Cure](https://github.com/visshva-r/Queue-Cure)

## Resume highlights

- Built a **real-time clinic queue** with **React**, **Node/Express**, **Socket.io**, and **MongoDB** (Mongoose).
- **Live multi-client sync:** every check-in, call, complete, or remove broadcasts `queue:update` to reception and waiting room.
- **Data-driven wait estimates:** `patientsAhead × effectiveAvgMinutes` using a **rolling average** of the last 20 completed visits (fallback to reception baseline).
- **Production deployment:** Vercel (SPA), Render (API), MongoDB Atlas; health checks and rate limits on the API.
- **Automated smoke tests** (28 checks) covering REST, queue math, socket push, and remove/restore.

## Features

- **Check-in:** name + Enter → token issued (atomic counter, survives API restart).
- **Reception:** call next, done, no-show, remove with undo, keyboard **N** for call next.
- **Waiting room:** now serving, queue position, estimated wait, estimated call time, live consultation timer.
- **Reconnect:** HTTP snapshot on load + socket sync; clear Connecting / Syncing / Live status.

## Screens

| Route | Purpose |
|-------|---------|
| `/` | Reception desk |
| `/waiting` | Patient-facing display (open in a **second window** for demos) |

## Tech stack

- **Backend:** Node.js, Express, Socket.io, Mongoose, MongoDB
- **Frontend:** React, Vite, React Router, Socket.io client

## Quick start

### Prerequisites

- Node.js 18+
- MongoDB optional: Docker, [MongoDB Atlas](https://www.mongodb.com/atlas), or `USE_MEMORY_DB=true` locally

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

App: `http://localhost:5173` (proxies `/api` and `/socket.io` to the backend)

### Tests

With the backend running:

```bash
npm test
```

## Project structure

```
queue-cure/
├── backend/          Express API, Socket.io, MongoDB
├── frontend/         React (reception + waiting room)
├── docs/             Architecture, socket diagram, demo script
├── scripts/
│   └── smoke-test.mjs
└── docker-compose.yml
```

## API

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | `/api/queue` | Full queue snapshot |
| POST | `/api/patients` | Add patient, issue token |
| POST | `/api/queue/call-next` | Call next waiting token |
| POST | `/api/queue/complete` | Finish consultation |
| POST | `/api/queue/no-show` | Mark current as no-show |
| DELETE | `/api/patients/:id` | Remove from waiting queue |
| POST | `/api/patients/:id/restore` | Undo remove |
| PATCH | `/api/settings/avg-consultation` | Set baseline avg minutes |
| POST | `/api/queue/reset-day` | End-of-day reset |

Mutating endpoints broadcast `queue:update` over WebSocket.

## Docs

- [2-minute interview demo script](docs/DEMO_SCRIPT.md)
- [Socket events](docs/SOCKET_DIAGRAM.md)
- [Architecture](docs/ARCHITECTURE.md)

## License

MIT
