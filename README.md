# Queue Cure

Digital waiting room for neighbourhood clinics. Receptionists run the queue from one screen. Patients check status on a phone or display. Updates are live over WebSockets.

## Features

- **Check-in:** enter a name, press Enter, token is assigned
- **Live sync:** Socket.io broadcasts `queue:update` to every connected client
- **Wait estimates:** `patientsAhead × effectiveAvgMinutes`, using a rolling average of the last 20 completed visits (falls back to the receptionist-set average until enough data exists)

## Screens

- `/` Reception: add patients, call next, complete visits, set average consultation time
- `/waiting` Waiting room: current token, queue position, estimated wait

Open both URLs in separate tabs to see sync in action.

## Tech stack

- Backend: Node.js, Express, Socket.io, MongoDB (Mongoose)
- Frontend: React, Vite, Socket.io client

## Quick start

### Prerequisites

- Node.js 18+
- MongoDB optional: Docker, [MongoDB Atlas](https://www.mongodb.com/atlas), or in-memory mode for local dev

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API: `http://localhost:3001`

`USE_MEMORY_DB=true` in `backend/.env` runs an embedded MongoDB locally. For production, use Atlas and set `USE_MEMORY_DB=false`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: `http://localhost:5173`

### Docker MongoDB

```bash
docker compose up -d
```

### Tests

With the backend running:

```bash
npm test
```

## Project structure

```
queue-cure/
├── backend/          Express API, Socket.io, MongoDB
├── frontend/         React app (reception + waiting room)
├── docs/
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
| PATCH | `/api/settings/avg-consultation` | Set baseline avg minutes |
| POST | `/api/queue/reset-day` | End-of-day reset |

Mutating endpoints broadcast `queue:update` over WebSocket.

## Docs

- [Socket events](docs/SOCKET_DIAGRAM.md)
- [Architecture](docs/ARCHITECTURE.md)

## License

MIT
