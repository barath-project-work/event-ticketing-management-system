# PHASE 6: Event & Seat Management API

> **Project:** Event Ticketing Management System (High-Concurrency)
> **Status:** ✅ Implemented
> **Last Updated:** 2026-06-22

---

## 1. Overview

Phase 6 delivers the public browsing and admin management APIs for events, seats, and inventory pools. This completes the system's REST surface — enabling clients to discover available events, inspect seat maps with real-time availability, and manage the full event lifecycle.

### What Was Built

- **EventController** — Public endpoints for listing events and browsing seat maps with filtering
- **AdminController** — Privileged endpoints for creating events, bulk-creating seats, managing inventory pools, and updating event status
- **EventService** — Service layer implementing business rules for event lifecycle and inventory queries
- **Database queries** — Aggregation queries for tier breakdowns, seat counts, and filtered seat listings
- **Comprehensive tests** — 52 total tests (18 EventService + 10 EventController + 7 AdminController)

---

## 2. API Endpoints

### 2.1 Public Event Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/events` | List events (optional `?status=` filter) |
| `GET` | `/api/events/{id}` | Full event details with seat/tier breakdown |
| `GET` | `/api/events/{id}/seats` | List seats with optional tier/section/status filters |

### 2.2 Admin Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/admin/events` | Create a new event (starts in DRAFT) | Admin token |
| `POST` | `/api/admin/events/{id}/seats` | Bulk-create seats (auto-activates DRAFT events) | Admin token |
| `POST` | `/api/admin/events/{id}/pools` | Create inventory pool tier | Admin token |
| `PUT` | `/api/admin/events/{id}/status` | Update event status (activate, cancel, etc.) | Admin token |

---

## 3. API Reference

### 3.1 List Events

```
GET /api/events?status=ACTIVE
```

Returns a lightweight list of events with basic seat/ticket counts.

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "name": "Hamilton - Broadway",
    "venue": "Richard Rodgers Theatre",
    "eventDate": "2026-08-06T20:00:00",
    "status": "ACTIVE",
    "inventoryStrategy": "PER_SEAT",
    "availableSeats": 150,
    "totalSeats": 150
  }
]
```

### 3.2 Get Event Details

```
GET /api/events/1
```

Returns comprehensive event information including tier breakdown with per-tier availability.

**Response (200 OK):**
```json
{
  "id": 1,
  "name": "Hamilton - Broadway",
  "description": "The hit musical at the Richard Rodgers Theatre",
  "venue": "Richard Rodgers Theatre",
  "eventDate": "2026-08-06T20:00:00",
  "status": "ACTIVE",
  "inventoryStrategy": "PER_SEAT",
  "holdDurationSeconds": 180,
  "createdAt": "2026-06-22T10:00:00",
  "updatedAt": "2026-06-22T10:00:00",
  "totalSeats": 150,
  "availableSeats": 148,
  "heldSeats": 1,
  "reservedSeats": 1,
  "tiers": [
    {
      "tier": "Orchestra",
      "price": 299.00,
      "totalQuantity": 50,
      "availableQuantity": 49,
      "heldQuantity": 1,
      "reservedQuantity": 0
    }
  ]
}
```

### 3.3 List Seats

```
GET /api/events/1/seats?tier=VIP&status=AVAILABLE&section=Orchestra
```

All filter parameters are optional and composable.

**Response (200 OK):**
```json
[
  {
    "id": 42,
    "label": "A1",
    "section": "Orchestra",
    "rowName": "A",
    "seatNumber": 1,
    "tier": "VIP",
    "price": 299.00,
    "status": "AVAILABLE",
    "version": 0
  }
]
```

### 3.4 Create Event

```
POST /api/admin/events
Content-Type: application/json

{
  "name": "New Broadway Show",
  "description": "A spectacular new production",
  "venue": "Majestic Theatre",
  "eventDate": "2026-09-15T19:30:00",
  "inventoryStrategy": "PER_SEAT",
  "holdDurationSeconds": 180,
  "adminToken": "admin-token-001"
}
```

**Response (201 Created):** Event details with `status: "DRAFT"`.

### 3.5 Bulk-Create Seats

```
POST /api/admin/events/3/seats
Content-Type: application/json

{
  "adminToken": "admin-token-001",
  "seats": [
    {
      "label": "A1",
      "section": "Orchestra",
      "rowName": "A",
      "seatNumber": 1,
      "tier": "VIP",
      "price": 299.00
    }
  ]
}
```

**Response (201 Created):** Array of created seats. **Auto-activates** the event if it was in DRAFT status.

### 3.6 Create Inventory Pool

```
POST /api/admin/events/4/pools?tier=VIP&totalQuantity=500&price=450.00&adminToken=admin-token-001
```

**Response (201 Created):** The created InventoryPool with available quantity.

### 3.7 Update Event Status

```
PUT /api/admin/events/1/status?status=CANCELLED&adminToken=admin-token-001
```

Valid status transitions: DRAFT -> ACTIVE, ACTIVE -> SOLD_OUT/CANCELLED, SOLD_OUT -> ACTIVE, any -> COMPLETED.
Cancelled and COMPLETED events cannot be changed.

---

## 4. Architecture Decisions

### 4.1 Dual-Strategy Event Details

The `getEventDetails` endpoint aggregates availability differently depending on the event's inventory strategy:

| Strategy | Source of Truth | Calculation |
|----------|---------------|-------------|
| **PER_SEAT** | `seats` table | `COUNT WHERE status = AVAILABLE` via `countAvailableSeats()` |
| **AGGREGATED** | `inventory_pools` table | `SUM(pool.availableQuantity)` from pool records |

**Rationale:** Using direct SQL counts avoids loading thousands of seat entities into memory just to compute a count. The aggregation queries run in a single database round-trip per tier group.

### 4.2 DRAFT → ACTIVE Auto-Activation

Creating seats or inventory pools on a DRAFT event automatically transitions it to ACTIVE. This reduces manual steps during event setup — the typical workflow is:

1. `POST /api/admin/events` → event created in DRAFT
2. `POST /api/admin/events/{id}/seats` → seats created, event auto-activated

**Rationale:** A DRAFT event without seats or inventory is meaningless for customers. Forcing a separate activation step after seat creation adds friction without benefit. Event operators who need a delayed activation can create the event with seats pre-configured while keeping the event in DRAFT by using the status override endpoint.

### 4.3 Admin Token Authentication

Admin endpoints use a configurable token (default: `admin-token-001`) passed in the request body or query parameter. The token is resolved from:

1. System property: `-Dapp.admin-token=...`
2. Environment variable: `ADMIN_TOKEN`
3. Hardcoded default: `admin-token-001`

**Rationale for Phase-appropriate auth:** Simple token auth avoids the complexity of OAuth2/JWT setup while being sufficient for development, load testing, and CI pipelines. Production deployments would replace this with proper OAuth2 scopes or API key rotation.

### 4.4 Bulk Seat Creation

Seats are accepted as a batch array rather than individual endpoints:

**Why bulk:** Creating 150 seats one-by-one would require 150 HTTP round-trips. A single request with an array of 150 seat definitions completes in one round-trip and leverages Hibernate's `batch_size: 50` configuration (from `application.yml`) to batch INSERT statements efficiently.

### 4.5 Seat JSON Serialization

The `Seat` entity's `event` association is marked with `@JsonIgnore` to prevent `LazyInitializationException` during serialization (with `spring.jpa.open-in-view: false`). This is safe because:

- The `/api/events/{id}/seats` endpoint already provides the event ID in the URL path
- All other service methods that load seats with their event association use `@Transactional` scopes

---

## 5. Error Responses

All endpoints use the existing `GlobalExceptionHandler` patterns:

| HTTP Status | Error Code | Scenario |
|-------------|------------|----------|
| 400 | `bad_request` | Invalid admin token, non-existent event, invalid status filter |
| 400 | `validation_error` | Missing required fields (Jakarta validation) |
| 409 | `invalid_state` | Invalid state transition (e.g., reactivating cancelled event) |

---

## 6. Test Coverage

### 6.1 EventServiceTest (18 tests)

| Ca
