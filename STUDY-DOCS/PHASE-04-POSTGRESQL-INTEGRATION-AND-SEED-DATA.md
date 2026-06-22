# PHASE 4: PostgreSQL Integration, Testcontainers & Seed Data

> **Project:** Event Ticketing Management System (High-Concurrency)
> **Status:** ✅ Implemented
> **Last Updated:** 2026-06-22

---

## 1. Overview

Phase 4 bridges development and production environments by providing:
- **Docker Compose** for local PostgreSQL (existing from Phase 1, validated with `docker compose up -d`)
- **Testcontainers** for running integration tests against a real PostgreSQL database in CI
- **DataSeeder** component that populates development databases with realistic test data
- **Comprehensive integration tests** that validate the full reservation lifecycle against PostgreSQL

---

## 2. Components

### 2.1 Docker Compose PostgreSQL (`docker-compose.yml`)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: ticketing
      POSTGRES_USER: ticketing
      POSTGRES_PASSWORD: ticketing_secret
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ticketing"]
```

**Start locally:**
```bash
docker compose up -d
# Application connects via application.yml (port 5432)
```

### 2.2 Testcontainers Integration (`integration-test` profile)

**Configuration class:** `TestcontainersConfig.java`
- Creates a PostgreSQL 16 Alpine container for tests
- Uses `@ServiceConnection` (Spring Boot 3.1+) to auto-configure the datasource
- Activated via `@Profile("integration-test")`

**Profile config:** `application-integration-test.yml`
- `ddl-auto: create-drop` (schema created from entities, dropped after tests)
- SQL logging enabled for debugging
- Testcontainers logging at INFO level

### 2.3 Seed Data Loader (`dev` profile)

**Component:** `DataSeeder.java` (`@Profile("dev")`)

**What it seeds:**

| Resource | Details |
|----------|---------|
| **Users** | alice@example.com (token: alice-token-001), bob@example.com (token: bob-token-002) |
| **Per-Seat Event** | "Hamilton - Broadway" with 150 seats across 3 tiers (Orchestra $299, Mezzanine $199, Balcony $99) |
| **Aggregated Event** | "Summer Music Festival 2026" with 3 tiers (VIP $450 - 500 qty, GA $150 - 5000 qty, Student $75 - 200 qty) |
| **Draft Event** | "Upcoming Comedy Night" (not on sale — for testing DRAFT state) |

**Run with seed data:**
```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
# Or: java -jar target/event-ticketing.jar --spring.profiles.active=dev
```

### 2.4 Integration Tests

**Test class:** `ReservationFlowIntegrationTest.java`
| Test | Validates |
|------|----------|
| `shouldCompleteFullPerSeatLifecycle` | HOLD → CONFIRM → verify seat RESERVED + audit log count |
| `shouldCompleteFullAggregatedLifecycle` | HOLD → CANCEL → verify inventory released back |
| `shouldHandleMultipleUsersHoldingDifferentSeats` | Concurrent holds by different users, blocked on already-held seat |
| `shouldRejectConfirmationOfExpiredReservation` | Expired hold → CONFIRM → SeatNotAvailableException |
| `shouldReturnReservationDetails` | Full DTO response check (event name, venue, seat label, tier, price) |
| `shouldHandleInventoryExhaustion` | Last ticket held → next attempt fails |

---

## 3. How to Run

### Local Development
```bash
# Start PostgreSQL
docker compose up -d

# Run with seed data
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Test the API (example)
curl -X POST http://localhost:8080/api/reservations/hold \
  -H "Content-Type: application/json" \
  -d '{"eventId":1,"seatId":1,"token":"alice-token-001"}'
```

### Run Tests
```bash
# H2 unit tests (fast, no Docker needed)
mvn test

# PostgreSQL integration tests (requires Docker, uses Testcontainers)
mvn test -Dtest="*IntegrationTest" -Dspring.test.profiles.active=integration-test
```

---

## 4. Product Impact

### Data Quality & Developer Experience
- **Realistic seed data** lets developers and QA test the full flow without manual setup
- **150 seats × 3 tiers** matches a real Broadway theater layout
- **Two token users** enable multi-user concurrency testing out of the box
- **DRAFT event** ensures edge case handling (non-active events) is always testable

### Test Reliability
- **Testcontainers** ensures CI tests run against the same PostgreSQL version as production
- **6 integration tests** cover the complete reservation lifecycle against a real database
- No mocking of JPA/Hibernate — tests catch real SQL issues (constraints, indexes, locking)

### Deployment Confidence
- Same PostgreSQL stack (16 Alpine) across dev, CI, and production
- `ddl-auto: validate` in production ensures schema matches entities exactly
- Seed data compatible with both Docker Compose and Testcontainers

---

## 5. Future Enhancements

- **Flyway migrations:** Replace `ddl-auto: create-drop` with versioned SQL migrations
- **PII obfuscation:** Sanitize seed data in non-production environments
- **Data factory pattern:** Reusable test data builders for more granular test setup
- **Performance test data:** Larger seed datasets (10k+ seats) for load testing
