# Thought Process Sheet — Queue Cure '26

## Problem framing

Indian neighbourhood clinics lose 2–3 hours of patient goodwill to opaque paper queues. The fix is not "an app" — it is **shared truth**: one queue state, two views, zero refresh, wait times patients can trust.

## Design decisions

### 1. Full snapshot over granular events (40% — live sync)

**Choice:** Broadcast complete `queue:update` snapshots instead of per-field deltas.

**Why:** Two screens must never disagree. A snapshot guarantees receptionist and waiting room see identical state after every action. Reconnecting clients get `queue:sync` with the same shape.

**Trade-off:** Slightly more bytes per event; negligible at clinic scale (<100 patients/day).

### 2. Wait time from real data (25%)

**Formula:**
```
estimatedWaitMinutes = patientsAhead × effectiveAvgMinutes
```

Where:
- `patientsAhead` = position in waiting list + 1 if someone is currently in consultation
- `effectiveAvgMinutes` = rolling mean of last **20 completed** consultation durations
- **Fallback:** receptionist-set baseline until enough completions exist

**Why not hardcode 15 min?** After a few "Done" clicks, averages reflect *this doctor, today* — fast visits pull estimates down; complex cases pull them up.

**Data captured on complete:** `calledAt` → `completedAt` → stored in `ConsultationRecord` for rolling average.

### 3. Receptionist speed & mistake-proofing (20%)

| Feature | Purpose |
|---------|---------|
| Single name field + Enter | Sub-10-second token issue |
| Auto-increment tokens | No manual numbering errors |
| "Call next" blocked if consultation open | Prevents double-call |
| Atomic `findOneAndUpdate` with sort | Lowest token always called first |
| Done / No-show / Remove | Recover from mistakes without paper chaos |
| Keyboard shortcut `N` | Hands stay on keyboard during rush |
| Reset day | Clean start tomorrow |

### 4. Concurrency & edge cases (15%)

| Scenario | Handling |
|----------|----------|
| Two receptionists click "Call Next" | MongoDB `findOneAndUpdate` is atomic — only one wins; other gets 409 "Finish current first" or 404 "No patients waiting" |
| Patient leaves while waiting | Receptionist removes from queue; wait times recalculate for everyone via broadcast |
| No-show at consultation | Mark no-show, slot freed, next can be called |
| Socket disconnect | Client reconnects → `queue:sync` restores full state; optional REST `/api/queue` fallback in hook |
| Server restart | MongoDB persists queue; clients reconnect and sync |
| Empty queue call-next | 404 with clear message — no silent failure |
| End of day | Reset clears waiting + in-consultation, resets token counter to 1 |

### 5. Why MongoDB?

- Document model fits queue entries + settings naturally
- Atomic find-and-update for ordered dequeue
- Hackathon explicitly signals MongoDB + Express

### 6. What I'd add with more time

- Multi-clinic `clinicId` from URL (schema already supports it)
- Patient self-check-in via QR code
- SMS/WhatsApp when token is 2 away
- Admin analytics dashboard for doctors
- Rate limiting on public waiting room endpoint

## Evaluation mapping

| Criteria | Weight | Our approach |
|----------|--------|--------------|
| Live queue updates | 40% | Socket.io room broadcast on every mutation |
| Real wait time | 25% | Rolling avg from completed consultations |
| Fast receptionist UX | 20% | Minimal form, guards, keyboard shortcut |
| Concurrency / edge cases | 15% | This document + atomic DB ops |

## Demo script (2 minutes)

1. Open `/` and `/waiting` side by side.
2. Add 3 patients quickly — show tokens appearing live on waiting room.
3. Point out wait estimates (position × avg).
4. Call next → waiting room "Now serving" flips instantly.
5. Click Done — complete a visit; add more patients; show avg switching to "from last visits".
6. Close with the one-liner from README.
