# Queue Cure — 2-minute live demo (interviews)

Use **two browser windows** side by side (not one tab switching routes). That mirrors reception + waiting-room displays.

| Role | URL |
|------|-----|
| Reception | https://queue-cure-visshva.vercel.app/ |
| Waiting room | https://queue-cure-visshva.vercel.app/waiting |

**Before you start:** Open the reception URL first and wait until the status pill shows **● Live** (Render free tier may take ~30s on first load after idle). Optional: ping `https://queue-cure-api-3vtt.onrender.com/health` a minute earlier.

## Script (~90 seconds)

1. **Problem (15s)**  
   “Clinics still use paper tokens. Patients don’t know when they’ll be called. Reception needs one fast screen.”

2. **Check-in (20s)**  
   On reception, add **Alice**, **Bob**, **Carol** (Enter after each name). Point out token numbers and the waiting count.

3. **Live sync (25s)**  
   On the waiting room window, show the same three tokens appear **without refresh**. Mention Socket.io `queue:update` after each API mutation.

4. **Call flow (25s)**  
   Reception: **Call next** → waiting room hero shows token **1**. **Done** → completed count increments; next patient moves up. Optionally **Call next** again and **No-show** to show edge handling.

5. **Wait times (15s)**  
   Waiting room: estimated wait and **~call time** use `position × rolling average` from the last completed visits (falls back to reception-set average).

## If something looks stuck

- Pill says **Connecting…** → API waking up; wait or hit `/health` once.
- Pill says **Syncing live updates…** → queue data loaded; socket finishing handshake (should flip to **Live** quickly).
- One window out of date → refresh that tab once; both should stay in sync after.

## Talking points (resume-aligned)

- Real-time sync with **Socket.io** (no polling on the client for queue state).
- **Express + MongoDB** queue service with atomic token issue and broadcast after mutations.
- Wait estimates from **real consultation durations** (rolling window), not a static guess.
- Deployed **React/Vite** on Vercel, API on Render, Atlas MongoDB.
