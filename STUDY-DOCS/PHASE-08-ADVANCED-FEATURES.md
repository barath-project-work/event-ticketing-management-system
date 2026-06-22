# PHASE 8: Advanced Flash Sale Features

> **Project:** Event Ticketing Management System (High-Concurrency)
> **Status:** ✅ Implemented
> **Last Updated:** 2026-06-22

---

## 1. Overview

Phase 8 adds advanced flash-sale features to handle real-world ticket purchasing scenarios beyond the basic hold-confirm-cancel lifecycle. These features address user experience during high-demand events: extending holds during payment, group bookings, waiting when sold out, real-time availability updates, and refunds for accidental purchases.

### What Was Built

- **Two-Stage Hold Extension** — Users can extend their hold during payment auth
- **Bulk Hold** — Hold multiple seats/tickets in a single atomic transaction
- **Waiting Queue** — In-memory FIFO queue when inventory is exhausted
- **WebSocket Real-Time Availability** — Live seat count updates during flash sales
- **Refund Flow** — Reversal of CONFIRMED reservations with inventory release

---

## 2. Features

### 2.1 Two-Stage Hold Extension

**Problem:** During flash sales, users need time to enter payment details. A single 180s hold may expire before payment completes, causing the user to lose their cart.

**Solution:** The initial hold is 180s (or the event's configured duration). Users can call POST /api/reservations/{id}/extend to add another hold duration period. This gives them time to complete payment while ensuring inventory isn't held indefinitely.

**Flow:**
1. User holds seat → 180s hold created
2. User initiates payment → calls extend endpoint → hold extended by 180s
3. User completes payment → calls confirm endpoint

**Usage:**
```bash
curl -X POST http://localhost:8080/api/reservations/1/extend \
  -H "Content-Type: application/json" \
  -d '{"token":"alice-token-001"}'
```

**Architecture Rationale:**
- Extensions use the event's configured `holdDurationSeconds` (not a global value), allowing flash-sale events to have shorter windows
- Only HELD reservations can be extended (not CONFIRMED, CANCELLED, or EXPIRED)
- The response includes an `extendable` boolean field letting the client know if extension is available
- Audit logging tracks previous and new expiry times for debugging

### 2.2 Bulk Hold

**Problem:** Group bookings require holding multiple seats simultaneously. Making N individual hold requests risks getting partial allocation (some seats held, others contested).

**Solution:** POST /api/reservations/hold/bulk accepts an array of seat/tier entries in a single transaction. Either ALL entries succeed or NONE do (atomic).

**Request:**
```json
{
  "eventId": 1,
  "entries": [
    {"seatId": 1},
    {"seatId": 2},
    {"seatId": 3}
  ],
  "token": "alice-token-001"
}
```

**Architecture Rationale:**
- Single @Transactional boundary ensures atomicity
- Uses @Retryable for optimistic locking conflicts across the batch
- Single BULK_HOLD audit log entry (not N individual HOLD entries) reduces audit log noise
- WebSocket broadcast fires once after all reservations are created

### 2.3 Waiting Queue

**Problem:** When inventory is exhausted during a flash sale, users get a 409 error with no way to know if tickets will become available.

**Solution:** When a hold fails due to SeatNotAvailableException, the user is automatically added to an in-memory FIFO waiting queue. The queue is per (eventId, tier) combination for fair ordering.

**API Endpoints:**
```bash
# Check queue position
curl "http://localhost:8080/api/reservations/waiting-queue?eventId=1&tier=VIP&token=alice-token-001"

# Response:
{"eventId":1,"position":3,"inQueue":true}
```

**Architecture Rationale:**
- ConcurrentLinkedQueue with synchronized dequeue for thread safety
- Per-tier queues prevent VIP contestants from competing with GA contestants
- Phase-appropriate: in-memory only; production deployments would replace with Redis pub/sub or dedicated notification service
- When the sweeper releases seats, queued users could be auto-promoted (future enhancement)

### 2.4 WebSocket Real-Time Availability

**Problem:** Clients polling GET /api/events/{id} for availability creates unnecessary database load and provides stale data between polls.

**Solution:** WebSocket endpoint at /ws/seat-availability/{eventId} streams live availability JSON to connected clients.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8080/ws/seat-availability/1');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Available:', data.available);
};
```

**Broadcast Message:**
```json
{"eventId":1,"available":148,"held":1,"reserved":1,"total":150}
```

**Architecture Rationale:**
- Raw WebSocket (no STOMP/SockJS) for minimal overhead
- Broadcasts triggered by ReservationService after hold/confirm/cancel/refund operations
- Per-event subscriptions using CopyOnWriteArraySet for thread-safe iteration
- Handler is a @Component bean injectable into services
- Allowed origins are open (`*`) for development; restrict in production

### 2.5 Refund Flow

**Problem:** Users who accidentally confirm a reservation have no way to reverse it. The regular cancel endpoint specifically blocks CONFIRMED reservations to prevent bypassing payment checks.

**Solution:** POST /api/reservations/{id}/refund explicitly handles reversal of CONFIRMED reservations, releasing the seat/inventory back to the pool.

**Usage:**
```bash
curl -X POST http://localhost:8080/api/reservations/1/refund \
  -H "Content-Type: application/json" \
  -d '{"token":"alice-token-001"}'
```

**Architecture Rationale:**
- Separate endpoint from cancel for clear semantic meaning
- REFUND audit log action (not CANCEL) for financial traceability
- Releases inventory exactly like cancel would (AVAILABLE seat, incremented pool)
- Only CONFIRMED reservations can be refunded

---

## 3. API Reference

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/reservations/hold/bulk | Hold multiple seats/tickets atomically | Token |
| POST | /api/reservations/{id}/extend | Extend hold duration by event's configured period | Token |
| POST | /api/reservations/{id}/refund | Refund a CONFIRMED reservation | Token |
| GET | /api/reservations/waiting-queue | Check position in waiting queue | Token |
| WS | /ws/seat-availability/{eventId} | Real-time seat availability stream | None |

---

## 4. Configuration

```yaml
reservation:
  hold:
    duration-seconds: 180
```

WebSocket endpoint: /ws/seat-availability/{eventId}

---

## 5. Future Enhancements

- **Redis-backed waiting queue** — Replace in-memory queue with Redis List/Set for persistence across restarts
- **Auto-promotion** — Automatically attempt hold for queued users when sweeper releases inventory
- **Email/SMS notification** — Notify users when they reach the front of the queue
- **STOMP over WebSocket** — Add STOMP protocol support for topic-based subscriptions
- **Refund limits** — Per-user refund rate limiting to prevent abuse
- **Partial refund** — Refund specific tickets from a multi-ticket reservation
