# PHASE 3: REST API & Reservation Flow

> **Project:** Event Ticketing Management System (High-Concurrency)
> **Status:** ✅ Implemented
> **Last Updated:** 2026-06-22

---

## 1. Overview

Phase 3 implements the core REST API for the reservation lifecycle — the critical user-facing functionality that allows customers to discover, hold, confirm, and cancel ticket reservations. This is the first phase where the system becomes usable via HTTP endpoints.

### What Was Built

- **`ReservationService`** — Business logic for the full reservation lifecycle
- **`ReservationController`** — REST endpoints for hold, confirm, cancel, and query operations
- **`TokenAuthService`** — Simple token-based authentication for API access
- **Request/Response DTOs** — Structured data contracts for API communication
- **Comprehensive tests** — Service unit tests and controller integration tests

---

## 2. API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/reservations/hold` | Hold a seat (per-seat) or tickets (aggregated) | Token |
| `POST` | `/api/reservations/{id}/confirm` | Confirm a held reservation | Token |
| `POST` | `/api/reservations/{id}/cancel` | Cancel a held reservation | Token |
| `GET` | `/api/reservations/{id}` | Get reservation details | Token |

### 2.1 Hold Seat / Tickets

**Request:**
```json
{
  "eventId": 1,
  "seatId": 42,           // Required for PER_SEAT
  "tier": "VIP",           // Required for AGGREGATED
  "quantity": 2,          // Required for AGGREGATED (default: 1)
  "token": "user-api-token-123"
}
```

**Response (201 Created):**
```json
{
  "id": 100,
  "eventId": 1,
  "eventName": "Broadway Show",
  "venue": "Grand Theater",
  "eventDate": "2026-07-22T20:00:00",
  "userId": 5,
  "userEmail": "buyer@example.com",
  "seatId": 42,
  "seatLabel": "A1",
  "section": "Orchestra",
  "tier": "VIP",
  "price": 200.00,
  "status": "HELD",
  "heldAt": "2026-06-22T10:00:00",
  "expiresAt": "2026-06-22T10:03:00"
}
```

### 2.2 Confirm Reservation

**Request:** `POST /api/reservations/{id}/confirm`
```json
{
  "token": "user-api-token-123"
}
```

**Response (200 OK):** Full reservation DTO with `status: "CONFIRMED"`

### 2.3 Cancel Reservation

**Request:** `POST /api/reservations/{id}/cancel`
```json
{
  "token": "user-api-token-123"
}
```

**Response (200 OK):** Full reservation DTO with `status: "CANCELLED"`, seat released back to AVAILABLE

### 2.4 Get Reservation

**Request:** `GET /api/reservations/{id}?token=user-api-token-123`

**Response (200 OK):** Full reservation DTO with current status

---

## 3. Architecture & Design Decisions

### 3.1 Reservation Lifecycle

```
AVAILABLE (Seat)
    │
    │  POST /hold
    ▼
HELD (Reservation, 180s TTL)
    │                    │
    │ POST /confirm     │ (sweeper expires)
    ▼                    ▼
CONFIRMED             EXPIRED
    │
    │ (future: refund flow)
    ▼
CANCELLED
```

### 3.2 Dual-Strategy Support

The `ReservationService` automatically routes requests based on the event's `inventoryStrategy`:

| Strategy | Hold Behavior | Release Behavior |
|----------|---------------|------------------|
| **PER_SEAT** | Sets `Seat.status = HELD`, creates Reservation | Sets `Seat.status = AVAILABLE` |
| **AGGREGATED** | Decrements `InventoryPool.availableQuantity` by `quantity`, creates Reservation | Increments `InventoryPool.availableQuantity` by `quantity` |

### 3.3 Retryable Optimistic Locking

The `holdSeat` method is annotated with `@Retryable` for `ObjectOptimisticLockingFailureException`:
- **maxAttempts:** 4 (1 original + 3 retries)
- **Backoff:** 50ms → 100ms → 200ms → 400ms (capped at 500ms)
- **Rationale:** Under high concurrency, multiple users may try to hold the same seat. The retry gives the next user a fair chance without failing hard.

### 3.4 Authentication

- Each user has a unique API `token` (stored in the `users` table)
- Tokens are passed in the request body or query parameter
- `TokenAuthService` resolves the token to a `User` entity
- Invalid tokens return `400 Bad Request` with an explanatory message

### 3.5 Audit Logging

Every state transition is logged to the `audit_logs` table:

| Action | When | Details Stored |
|--------|------|---------------|
| `HOLD` | Seat/tickets held | strategy, seatId, tier, quantity, expiresAt |
| `CONFIRM` | Reservation confirmed | seatId, quantity, confirmedAt |
| `CANCEL` | Reservation cancelled | seatId, quantity, cancelled status |

---

## 4. Test Coverage

### Service Tests (`ReservationServiceTest`)

| Test | Validates |
|------|----------|
| `shouldHoldPerSeatSuccessfully` | Per-seat hold creates HELD reservation, seat status updated |
| `shouldThrowWhenSeatNotAvailable` | Hold on ALREADY HELD seat throws `SeatNotAvailableException` |
| `shouldHoldAggregatedSuccessfully` | Aggregated hold decrements inventory pool correctly |
| `shouldConfirmReservation` | Confirm sets status to CONFIRMED, seat to RESERVED |
| `shouldCancelReservation` | Cancel sets status to CANCELLED, seat back to AVAILABLE |
| `shouldRejectInvalidToken` | Invalid token throws IllegalArgumentException |
| `shouldRejectExpiredReservationConfirmation` | Attempting to confirm past TTL throws error |

### Controller Tests (`ReservationControllerTest`)

| Test | HTTP Expected |
|------|--------------|
| `shouldReturn201OnHold` | POST /hold → 201 CREATED with HELD status |
| `shouldReturn200OnConfirm` | POST /confirm → 200 OK with CONFIRMED status |
| `shouldReturn200OnCancel` | POST /cancel → 200 OK with CANCELLED status |
| `shouldReturn409OnStaleHoldConfirm` | Confirm expired hold → 409 CONFLICT |
| `shouldReturn400OnMissingFields` | POST with empty body → 400 BAD REQUEST |

---

## 5. Product Impact

### Customer Experience
- **End-to-end reservation flow:** Users can now browse, hold, confirm, and cancel reservations via REST API
- **Clear error messages:** English-language error descriptions returned in JSON format
- **Timeout visibility:** Each hold response includes `expiresAt` so clients can display countdown timers

### Business Logic
- **Inventory integrity:** Seat/pool state and reservation state are updated atomically within transactions
- **Retry safety:** Idempotency keys and optimistic locking prevent double-booking under concurrent load
- **Full audit trail:** Every action is logged for customer support and fraud analysis

### Developer Experience
- **Clean API contract:** Request/response DTOs with Jakarta validation annotations
- **Consistent error format:** All exceptions map to structured JSON errors via `GlobalExceptionHandler`
- **Dual strategy flexibility:** Single unified API for both per-seat and aggregated events

---

## 6. Future Enhancements

- **Bulk hold endpoint:** For holding multiple seats in a single request (group booking)
- **Pagination for event/seat listing:** GET /events/{id}/seats with filtering by tier/section
- **OAuth2/JWT integration:** Replace simple token auth with industry-standard JWT
- **Rate limiting:** Protect hold endpoint from brute-force reservation attempts
- **WebSocket notifications:** Real-time seat availability updates during checkout
