# Event Ticketing Management System — Master Revival Document

> **Last Updated:** 2026-06-22
> **Tech Stack:** Java 21, Spring Boot 3.4.1, PostgreSQL 16, JPA/Hibernate, Maven, Docker, Testcontainers, JUnit 5, k6
> **Project Root:** `C:\Users\workm\OneDrive\Documents\event-ticketing-management`

---

## 1. Project Overview

A high-concurrency event ticketing system designed for flash-sale traffic. Supports both **per-seat** (assigned seating for theaters/stadiums) and **aggregated** (tier-based inventory for festivals) strategies with optimistic locking, retryable operations, automatic hold expiry sweepers, and a REST API.

---

## 2. What Has Been Implemented

### PHASE 1 — Project Scaffolding & Data Model [✅ Complete]

**Files:** `STUDY-DOCS/PHASE-01-PROJECT-SCAFFOLDING-AND-DATA-MODEL.md`

| Component | Details |
|-----------|---------|
| **pom.xml** | Spring Boot 3.4.1, spring-boot-starter-web/data-jpa/validation/actuator/security/aop, spring-retry, PostgreSQL, H2 (test), Micrometer Prometheus, Lombok, Testcontainers |
| **Docker Compose** | PostgreSQL 16 Alpine on port 5432 with healthcheck |
| **JPA Entities (6)** | `Event` (hybrid strategy, holdDurationSeconds=180 default), `Seat` (per-seat, @Version), `InventoryPool` (aggregated, unique event+tier), `Reservation` (dual references, idempotencyKey), `User` (token-based), `AuditLog` |
| **Enums (3)** | `SeatStatus` (AVAILABLE/HELD/RESERVED), `ReservationStatus` (HELD/CONFIRMED/CANCELLED/EXPIRED), `EventStatus` (DRAFT/ACTIVE/SOLD_OUT/CANCELLED/COMPLETED) |
| **Repositories (6)** | With optimized queries: `findExpiredHoldsWithDetails` (JOIN FETCH), `confirmReservation`, `expireStaleReservations`, `findByEventIdAndTier`, `findByToken` |
| **Config (4)** | `RetryConfig` (4 attempts, 50ms→500ms exponential backoff), `MetricsConfig` (Prometheus tags), `SchedulingConfig` (@EnableScheduling), `SecurityConfig` (stateless, /actuator + /api/public + /api/reservations public) |
| **Exceptions (3)** | `SeatNotAvailableException` (409), `ReservationExpiredException` (410), `GlobalExceptionHandler` (validation 400, illegal arg 400, illegal state 409, generic 500) |
| **Application YAML** | HikariCP pool 50, JPA batch_size 50, order_inserts/updates, stats enabled, retry & reservation config values |

### PHASE 2 — Reservation Sweeper & Hold Management [✅ Complete]

**Files:** `STUDY-DOCS/PHASE-02-RESERVATION-SWEEPER-AND-HOLD-MANAGEMENT.md`

| Component | Details |
|-----------|---------|
| **ReservationSweeperService** | `@Scheduled(fixedRate=30s)`, `@Transactional`, finds stale HELD reservations, releases seats (AVAILABLE) or inventory (+quantity), expires reservation, logs EXPIRE audit entry |
| **Performance Fix** | Added `@EntityGraph findWithDetailsById` eliminating N+1 lazy loads |
| **Tests (4)** | Per-seat expiry, aggregated expiry, active holds untouched, empty case |

### PHASE 3 — REST API & Reservation Flow [✅ Complete]

**Files:** `STUDY-DOCS/PHASE-03-REST-API-AND-RESERVATION-FLOW.md`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reservations/hold` | POST | Hold seat (PER_SEAT) or tickets (AGGREGATED), returns 201 |
| `/api/reservations/{id}/confirm` | POST | Confirm held reservation, seat→RESERVED, returns 200 |
| `/api/reservations/{id}/cancel` | POST | Cancel hold, release seat/inventory, returns 200 |
| `/api/reservations/{id}` | GET | Get reservation details (token in query param) |

| Component | Details |
|-----------|---------|
| **ReservationService** | `@Retryable` for optimistic locking, dual-strategy routing, idempotency keys, audit logging on every state transition |
| **TokenAuthService** | Resolves user from API token, throws 400 on invalid |
| **DTOs (3)** | `HoldSeatRequest`, `ReservationResponse` (full details), `ConfirmRequest` |
| **Tests (12)** | 7 service + 5 controller tests: hold, confirm, cancel, expired confirm, missing fields, invalid token, concurrent holds |

### PHASE 4 — PostgreSQL Integration, Testcontainers & Seed Data [✅ Complete]

**Files:** `STUDY-DOCS/PHASE-04-POSTGRESQL-INTEGRATION-AND-SEED-DATA.md`

| Component | Details |
|-----------|---------|
| **TestcontainersConfig** | PostgreSQL 16 Alpine via `@ServiceConnection`, activated via `integration-test` profile |
| **DataSeeder** | CommandLineRunner (dev profile): 2 users, Hamilton event (150 seats, 3 tiers), Summer Festival (3 pools, 5700 tickets), draft event |
| **Test Tokens** | `alice-token-001`, `bob-token-002` |
| **Integration Tests (6)** | Full lifecycle (PER_SEAT HOLD→CONFIRM), aggregated HOLD→CANCEL, concurrent holds, expired confirmation rejection, details query, inventory exhaustion |

### PHASE 5 — k6 Load Test Harness [✅ Complete]

**Files:** `STUDY-DOCS/PHASE-05-K6-LOAD-TESTING.md`

| Component | Details |
|-----------|---------|
| **k6 Installation** | k6 v2.0.0 installed via winget; ready for load testing |
| **Shared Config** | `k6/config.js` — Base URL, thresholds (p95<500ms, http_req_failed<1%), scenario templates (ramping-vus, ramping-arrival-rate, constant-vus) |
| **API Helpers** | `k6/helpers.js` — Wrappers for hold/confirm/cancel/get, response parsing, token rotation, custom metrics tagging |
| **Smoke Test** | `k6/scenarios/smoke-test.js` — 1-VU validation of all API endpoints including edge cases (409, 400) |
| **Per-Seat Flash Sale** | `k6/scenarios/per-seat-hold.js` — ramping-arrival-rate to 200 req/s, 500 max VUs, random seat contention |
| **Aggregated Flash Sale** | `k6/scenarios/aggregated-hold.js` — Tier-based inventory exhaustion simulation (VIP/GA/Student) |
| **Confirm Lifecycle** | `k6/scenarios/confirm-flow.js` — Hold→confirm→GET verify lifecycle under 50-VU ramp |
| **Mixed User Flow** | `k6/scenarios/mixed-flow.js` — 3-minute constant 30 VU simulation: 40% hold, 20% agg hold, 15% confirm, 10% cancel, 15% contention |
| **Custom Metrics (11)** | `seat_hold_success_rate`, `agg_hold_exhausted_rate`, `lifecycle_success_rate`, `mix_*_rate`, etc. |
| **Prometheus Output** | `--out output-prometheus-rw` for real-time metric push |

### PHASE 6 — Event & Seat Management API [✅ Complete]

**Files:** `STUDY-DOCS/PHASE-06-EVENT-MANAGEMENT-API.md`

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/events` | GET | List events (filterable by `?status=`) | Public |
| `/api/events/{id}` | GET | Full event details with tier breakdown | Public |
| `/api/events/{id}/seats` | GET | List seats (filterable by tier/section/status) | Public |
| `/api/admin/events` | POST | Create event in DRAFT status | Admin token |
| `/api/admin/events/{id}/seats` | POST | Bulk-create seats (auto-activates) | Admin token |
| `/api/admin/events/{id}/pools` | POST | Create inventory pool tier | Admin token |
| `/api/admin/events/{id}/status` | PUT | Update event status | Admin token |

| Component | Details |
|-----------|---------|
| **EventController** | Public browsing with optional composable filters (tier, section, status) |
| **AdminController** | Admin namespace with token auth, bulk seat creation, pool management |
| **EventService** | Aggregation queries for tier breakdowns, held/reserved counts, auto-activation on seat creation |
| **DTOs (4)** | `EventResponse` (with nested `TierInfo`), `EventSummaryResponse`, `CreateEventRequest`, `CreateSeatRequest` (with nested `SeatEntry`) |
| **Repository Enhancements** | Aggregation queries: `countByTier`, `countAvailableSeats`, `findByEventIdWithFilters` (optional params) |
| **Tests (35)** | 18 EventService + 10 EventController + 7 AdminController: lists, filters, details, creation, validation, state transitions |
| **Admin Token** | Configurable via `-Dapp.admin-token` or `ADMIN_TOKEN` env var; default: `admin-token-001` |

### PHASE 7 — Production Hardening [✅ Complete]

**Files:** `STUDY-DOCS/PHASE-07-PRODUCTION-HARDENING.md`

| Component | Details |
|-----------|---------|
| **Flyway Migrations** | `V1__initial_schema.sql` — Complete PostgreSQL schema with all tables, indexes, constraints; `baseline-on-migrate` for existing DBs; `ddl-auto: validate` confirms entity-model alignment |
| **Rate Limiting** | In-memory token bucket on POST /api/reservations/hold; per-IP isolation (ConcurrentHashMap); 100 burst capacity, 50 tokens/sec refill; returns 429 on exhaustion |
| **Redis Caching** | 3 cache regions (events: 30s, eventDetails: 60s, seats: 30s); Caffeine fallback for dev/test; @CacheEvict on write operations |
| **Circuit Breakers** | Resilience4j: 20-call sliding window, 50% failure threshold, 10s open→half-open |
| **Structured JSON Logging** | Spring Boot 3.4 native ECS format for ELK/Loki |
| **Custom Health Indicators** | DatabasePool (SELECT 1), Redis (PING), Sweeper (stale count) |
| **Tests (7)** | ProductionHardeningTest — health endpoint, rate limiter, caching |

### PHASE 8 — Advanced Flash Sale Features [✅ Complete]

**Files:** `STUDY-DOCS/PHASE-08-ADVANCED-FEATURES.md`

| Feature | Description | Key Endpoint |
|---------|-------------|-------------|
| **Two-Stage Hold** | Users can extend their hold during payment auth (+event duration) | POST /api/reservations/{id}/extend |
| **Bulk Hold** | Atomically hold multiple seats/tickets in one transaction | POST /api/reservations/hold/bulk |
| **Waiting Queue** | In-memory FIFO queue when inventory is exhausted; position tracking | GET /api/reservations/waiting-queue |
| **WebSocket** | Real-time seat availability streaming per event | ws://host/ws/seat-availability/{eventId} |
| **Refund Flow** | Reverse CONFIRMED reservations with full audit trail | POST /api/reservations/{id}/refund |

### PHASE 9 — CI/CD & Observability [✅ Complete]

**Files:** `STUDY-DOCS/PHASE-09-CICD-OBSERVABILITY.md`

| Component | Details |
|-----------|---------|
| **Multi-Stage Dockerfile** | JDK 21 build → distroless JRE runtime (~110MB), ZGC, non-root user |
| **GitHub Actions CI** | Build, 59 unit tests, Testcontainers integration tests, OWASP scan, k6 load tests, Docker build |
| **Prometheus Config** | Scrape config for /actuator/prometheus metrics |
| **Master Documentation** | `MASTER-PROJECT-DOCUMENTATION.md` — Full architecture, ERD, API reference, workflows, deployment guide |

### Environment Checks [✅ Done]

| Tool | Status | Notes |
|------|--------|-------|
| **Java 21** | ✅ | jdk-21.0.10 |
| **Maven 3.9.16** | ✅ | Installed |
| **Docker 29** | ✅ | Running, compose v5.1.1 |
| **H2 Unit Tests** | ✅ | 59/59 pass (All 9 phases) |
| **Testcontainers** | ⚠️ | Infra configured, but Windows named-pipe socket issue prevents local runs. Works in Linux/Mac CI |
| **k6** | ✅ | v2.0.0 installed, 5 test scenarios ready |

---

## 3. Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Run with seed data
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# 3. Test API
curl -X POST http://localhost:8080/api/reservations/hold \
  -H "Content-Type: application/json" \
  -d '{"eventId":1,"seatId":1,"token":"alice-token-001"}'

# 4. Run ALL unit tests (65 tests covering Phases 1-9)
mvn test

# 5. Run k6 smoke test (app must be running)
k6 run k6/scenarios/smoke-test.js

# 6. Run k6 flash sale simulations
k6 run k6/scenarios/per-seat-hold.js
k6 run k6/scenarios/aggregated-hold.js

# 7. Run integration tests (needs Docker)
mvn test -Dtest="ReservationFlowIntegrationTest" -Dspring.profiles.active=integration-test
```

---

## 4. What's NOT Implemented (Outstanding Work)

### ✅ All 9 Phases Complete

All planned phases have been implemented and documented. See each phase document for full details:

| Phase | Document | Status |
|-------|----------|--------|
| 1 — Project Scaffolding & Data Model | `STUDY-DOCS/PHASE-01-PROJECT-SCAFFOLDING-AND-DATA-MODEL.md` | ✅ Complete |
| 2 — Reservation Sweeper & Hold Management | `STUDY-DOCS/PHASE-02-RESERVATION-SWEEPER-AND-HOLD-MANAGEMENT.md` | ✅ Complete |
| 3 — REST API & Reservation Flow | `STUDY-DOCS/PHASE-03-REST-API-AND-RESERVATION-FLOW.md` | ✅ Complete |
| 4 — PostgreSQL Integration & Seed Data | `STUDY-DOCS/PHASE-04-POSTGRESQL-INTEGRATION-AND-SEED-DATA.md` | ✅ Complete |
| 5 — k6 Load Test Harness | `STUDY-DOCS/PHASE-05-K6-LOAD-TESTING.md` | ✅ Complete |
| 6 — Event & Seat Management API | `STUDY-DOCS/PHASE-06-EVENT-MANAGEMENT-API.md` | ✅ Complete |
| 7 — Production Hardening | `STUDY-DOCS/PHASE-07-PRODUCTION-HARDENING.md` | ✅ Complete |
| 8 — Advanced Flash Sale Features | `STUDY-DOCS/PHASE-08-ADVANCED-FEATURES.md` | ✅ Complete |
| 9 — CI/CD & Observability | `STUDY-DOCS/PHASE-09-CICD-OBSERVABILITY.md` | ✅ Complete |

### 🔲 Future Considerations (Beyond Scope)

- **OAuth2 / JWT authentication** — Replace token-based auth with Spring Security OAuth2
- **Kubernetes deployment** — Helm charts, readiness/liveness probes, HPA autoscaling
- **Distributed rate limiting** — Replace in-memory token bucket with Redis-based sliding window for multi-instance deployments
- **Horizontal scaling** — Session affinity, distributed caching, database read replicas
- **Event sourcing / CQRS** — Replace audit log with full event store for complete traceability
- **Payment gateway integration** — Stripe/PayPal for real checkout flow
- **SLA monitoring** — PagerDuty/OpsGenie integration for alert routing

---

## 5. Architecture Decisions & Rationale

| Decision | Choice | Why |
|----------|--------|-----|
| **Inventory model** | Hybrid (Seat + InventoryPool) | Supports both assigned seating and tier-based GA — both entity types present, selected per event |
| **Hold timeout** | 180s default | Balances checkout completion with inventory release in flash sales |
| **Sweeper interval** | 30s | Stale holds released within 30s of expiry; configurable in yml |
| **Optimistic locking** | @Version on all high-contention entities | Avoids DB-level locks; retry handles contention cleanly |
| **Retry strategy** | 4 attempts, 50ms→500ms exponential | Prevents thundering herd on retry; max 500ms keeps UX latency reasonable |
| **Auth mechanism** | Simple API token in request body | Phase-appropriate; avoids JWT/OAuth complexity during development; replaced by OAuth2 in production |
| **Load test model** | ramping-arrival-rate (k6) | Simulates flash-sale traffic patterns better than constant-VU; models real user arrival bursts |
| **Event details aggregation** | SQL COUNT queries vs loading entities | Counts seats at DB level avoiding memory load of thousands of seat entities; single round-trip per tier group |
| **Admin write operations** | Dedicated /api/admin/ namespace | Clear security boundary; enables different rate limits/audit policies for admin vs public endpoints |
| **DRAFT → ACTIVE auto-activation** | Automatic on seat/pool creation | Reduces manual steps in event setup; operators can still use status override for delayed activation |
| **Rate limiting strategy** | Token bucket (per-IP) | Naturally handles burst traffic up to capacity while enforcing long-term average; ideal for flash sales |
| **Cache strategy** | Redis with 30-60s TTL | Balances data freshness with DB load reduction; short TTL avoids distributed invalidation complexity |
| **Circuit breaker** | Resilience4j (20-window, 50% threshold) | Prevents cascading failures; automatic half-open recovery after 10s |
| **Schema management** | Flyway (versioned migrations) | Replaces ddl-auto:validate with auditable, code-reviewable schema changes; baseline-on-migrate for existing DBs |
| **Structured logging** | Spring Boot 3.4 native JSON | ECS-format JSON output for ELK/Loki without external logstash-logback-encoder dependency
