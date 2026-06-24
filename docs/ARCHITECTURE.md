# Architecture

## Problem

Many small clinics still use paper tokens. Patients do not know their place in line or how long they will wait. Reception and waiting room need the same queue state without manual refresh.

## Real-time sync

The server sends a full `queue:update` snapshot after every change instead of partial field updates.

Both screens always get the same data. Reconnecting clients receive `queue:sync` with the same payload shape. The trade-off is a slightly larger message per event, which is fine at clinic scale.

## Wait time

```
estimatedWaitMinutes = patientsAhead × effectiveAvgMinutes
```

- `patientsAhead`: position in the waiting list, plus 1 if someone is in consultation
- `effectiveAvgMinutes`: mean of the last 20 completed consultation durations
- fallback: receptionist-set average until enough visits are recorded

On complete, `calledAt` and `completedAt` are saved to `ConsultationRecord` for the rolling average.

## Receptionist UI

| Feature | Purpose |
|---------|---------|
| Single name field + Enter | Fast token issue |
| Auto-increment tokens | No manual numbering |
| Block call-next during consultation | Prevents double-call |
| Atomic `findOneAndUpdate` with sort | Lowest token called first |
| Done / no-show / remove | Handle mistakes |
| Shortcut `N` | Call next from keyboard |
| Reset day | Clear queue for next day |

## Concurrency and edge cases

| Scenario | Handling |
|----------|----------|
| Two call-next clicks | `findOneAndUpdate` is atomic; second request gets 409 or 404 |
| Patient leaves | Remove from queue; broadcast recalculates wait times |
| No-show | Mark no-show, free the slot |
| Socket disconnect | Reconnect gets `queue:sync`; REST fallback in hook |
| Server restart | Queue persisted in MongoDB |
| Empty queue call-next | 404 with error message |
| End of day | Reset clears active queue, token counter back to 1 |

## Why MongoDB

- Documents fit queue entries and settings
- Atomic find-and-update for ordered dequeue
- Works well with Express for a single-clinic deploy

## Roadmap

- Multi-clinic support via `clinicId` in URL
- QR self check-in
- SMS when two patients ahead
- Doctor analytics dashboard
- Rate limiting on public waiting room
