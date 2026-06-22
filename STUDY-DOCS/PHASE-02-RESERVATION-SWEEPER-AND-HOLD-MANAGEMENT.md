# PHASE 2: Reservation Sweeper & Hold Management

> **Project:** Event Ticketing Management System (High-Concurrency)
> **Status:** ✅ Implemented
> **Last Updated:** 2026-06-22

---

## 1. Overview

Phase 2 implements the automatic hold expiry sweeper — a critical piece of inventory management that ensures seats and ticket inventory are released back to the pool when a user's checkout hold expires. Without this, abandoned checkouts would permanently lock inventory, causing revenue loss and poor user experience.

### What Was Built

- **`ReservationSweeperService`** — A scheduled background service that detects and expires stale HELD reservations
- **Unit tests** covering per-seat, aggregated, active-hold, and edge cases
- **Configuration** via `application.yml` (30s sweep interval, 180s hold duration)

---

## 2. The Problem

When a user selects seats during checkout:

1. The system places a **HOLD** on the seats (status = `HELD`)
2. The hold has a **time-to-live** (default: 180 seconds)
3. If the user doesn't complete checkout in time, the hold must be **automatically released**
4. Without a sweeper, inventory would be permanently locked by abandoned sessions

This is the exact mechanism that powers timed cart holds on Ticketmaster, SeatGeek, etc.

---

## 3. Implementation Details

### 3.1 `ReservationSweeperService.java`

**Location:** `src/main/java/com/ticketing/service/`

**How it works:**

1. A scheduled task runs every **30 seconds** (configurable via `reservation.sweeper.fixed-rate-ms`)
2. Queries all reservations where `status = HELD` AND `expiresAt < now()`
3. For each stale reservation, performs these steps **atomically** in a transaction:
   - **Per-seat strategy:** Sets the seat status back to `AVAILABLE`
   - **Aggregated strategy:** Increments the `InventoryPool.availableQuantity` by the held quantity
   - **Reservation:** Sets status to `EXPIRED` and updates `updatedAt`
   - **Audit:** Creates an `AuditLog` entry with action `EXPIRE` and full details (heldAt, expiresAt, seat/pool IDs, quantity)

**Key design decisions:**

| Decision | Rationale |
|----------|-----------|
| **Single transaction** for the whole sweep | Ensures atomicity — partial expiry is not acceptable |
| **Per-reservation error handling** | One bad reservation doesn't block others (try/catch per item) |
| **Lazy loading within transaction** | Seat/InventoryPool associations are loaded on demand, avoiding unnecessary JOINs when not needed |
| **Audit logging on each expiry** | Full audit trail for debugging flash-sale contention issues |
| **Configurable sweep interval** | Can be tuned per deployment (default 30s matches 180s hold for fast release) |

### 3.2 Configuration (`application.yml`)

```yaml
reservation:
  hold:
    duration-seconds: 180      # How long a hold lasts before auto-expiry
  sweeper:
    fixed-rate-ms: 30000       # How often the sweeper runs
```

**Impact of these values:**
- **180s hold** = typical online checkout flow (enter payment info, confirm)
- **30s sweep** = stale holds are released within 30 seconds of expiry, freeing inventory for the next buyer
- Flash sales can tune these down (e.g., 60s hold, 15s sweep)

### 3.3 Test Coverage

| Test | What It Validates |
|------|------------------|
| `shouldExpireStalePerSeatReservation` | Per-seat hold is expired, seat returned to AVAILABLE, audit log created |
| `shouldExpireStaleAggregatedReservation` | Aggregated inventory is released, quantity incremented correctly |
| `shouldNotExpireActiveHolds` | Active (non-expired) holds are NOT touched |
| `shouldHandleEmptyStaleReservations` | No crash when there are no stale holds |

---

## 4. Product Impact

### Revenue Protection
- **Before:** Abandoned checkouts permanently lock inventory → lost sales
- **After:** Stale holds are released within 30 seconds of expiry → inventory returned to market

### User Experience
- Legitimate users with active holds (within 180s window) are never interrupted
- Competitors' buyers get released inventory quickly in flash-sale scenarios
- Full audit trail allows support team to diagnose "where did my hold go?" issues

### Scalability
- Single-threaded scheduled task (default) avoids database contention
- `@Version` optimistic locking on entities prevents double-release race conditions
- Configurable sweep interval allows tuning for peak loads (e.g., 15s during flash sales, 60s during normal operations)

---

## 5. Future Enhancements (Phase 2+

- **Two-stage hold flow:** Implement a shorter initial hold (30s) for payment token capture, then extended hold after auth
- **Redis-backed sweeper:** Replace DB polling with Redis TTL + key expiry callbacks for sub-second release
- **Metrics exposure:** Expose sweeper run count, expired count, and average expiry latency via Micrometer/Prometheus
- **Circuit breaker:** If sweeper consistently fails, alert via health check
