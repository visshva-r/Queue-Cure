# Architecture & Design — Queue Cure

## Problem framing

Indian neighbourhood clinics lose hours of patient goodwill to opaque paper queues. The fix is not "an app" — it is **shared truth**: one queue state, two views, zero refresh, wait times patients can trust.

## Design decisions

### 1. Full snapshot over granular events

**Choice:** Broadcast complete `queue:update` snapshots instead of per-field deltas.

**Why:** Two screens must never disagree. A snapshot guarantees receptionist and waiting room see identical state after every action. Reconnecting clients get `queue:sync` with the same shape.

**Trade-off:** Slightly more bytes per event; negligible at clinic scale (<100 patients/day).

### 2. Wait time from real data

**Formula:**
```
estimatedWaitMinutes = patientsAhead × effectiveAvgMinutes
```

Where:
- `patientsAhead` = position in waiting list + 1 if someone is currently in consultation
- `effectiveAvgMinutes` = rolling mean of last **20 completed** consultation durations
- **Fallback:** receptionist-set baseline until enough completions exist

**Why not hardcode a fixed average?** After a few completed visits, averages reflect *this doctor, today* — fast visits pull estimates down; complex cases pull them up.

**Data captured on complete:** `calledAt` → `completedAt` → stored in `ConsultationRecord` for rolling average.

### 3. Receptionist speed & mistake-proofing

| Feature | Purpose |
|---------|---------|
| Single name field + Enter | Sub-10-second token issue |
| Auto-increment tokens | No manual numbering errors |
| "Call next" blocked if consultation open | Prevents double-call |
| Atomic `findOneAndUpdate` with sort | Lowest token always called first |
| Done / No-show / Remove | Recover from mistakes without paper chaos |
| Keyboard shortcut `N` | Hands stay on keyboard during rush |
| Reset day | Clean start tomorrow |

### 4. Concurrency & edge cases

| Scenario | Handling |
|----------|----------|
| Two receptionists click "Call Next" | MongoDB `findOneAndUpdate` is atomic — only one wins; other gets 409 "Finish current first" or 404 "No patients waiting" |
| Patient leaves while waiting | Receptionist removes from queue; wait times recalculate for everyone via broadcast |
| No-show at consultation | Mark no-show, slot freed, next can be called |
| Socket disconnect | Client reconnects → `queue:sync` restores full state; REST `/api/queue` fallback in hook |
| Server restart | MongoDB persists queue; clients reconnect and sync |
| Empty queue call-next | 404 with clear message — no silent failure |
| End of day | Reset clears waiting + in-consultation, resets token counter to 1 |

### 5. Why MongoDB?

- Document model fits queue entries + settings naturally
- Atomic find-and-update for ordered dequeue
- Pairs well with Express for a small-clinic deployment

### 6. Roadmap

- Multi-clinic `clinicId` from URL (schema already supports it)
- Patient self-check-in via QR code
- SMS/WhatsApp when token is 2 away
- Admin analytics dashboard for doctors
- Rate limiting on public waiting room endpoint
