# PHASE 7: Production Hardening

> **Project:** Event Ticketing Management System (High-Concurrency)
> **Status:** ✅ Implemented
> **Last Updated:** 2026-06-22

---

## 1. Overview

Phase 7 hardens the system for production deployment by adding:
- **Flyway database migrations** - Version-controlled, auditable schema management
- **Rate limiting** - Token-bucket algorithm to protect the hold endpoint from abuse
- **Redis caching** - Distributed caching for event and seat listing endpoints
- **Circuit breakers** - Resilience4j to prevent cascading failures when dependencies degrade
- **Structured JSON logging** - Spring Boot 3.4 native structured logging for ELK/Loki ingestion
- **Custom health indicators** - Database pool, Redis, and sweeper health monitoring

This phase ensures the system is observability-ready, resilient to failures, and protected against abuse - prerequisites for production deployment.

---

## 2. Components

### 2.1 Flyway Database Migrations

**Purpose:** Replace JPA's `ddl-auto: validate` with version-controlled, auditable schema management.

**Migration file:** `src/main/resources/db/migration/V1__initial_schema.sql`

**What it contains:**
- Complete schema for all 6 tables: users, events, seats, inventory_pools, reservations, audit_logs
- All foreign key constraints, unique constraints, and indexes
- PostgreSQL-specific types (BIGSERIAL, TEXT, TIMESTAMP) for optimal storage

**Architecture Rationale:**
- **Immutable migrations:** Each migration file is applied exactly once per environment. Never modify a migration that has been applied - create a new V2 migration instead.
- **Baseline support:** `spring.flyway.baseline-on-migrate: true` allows Flyway to baseline existing databases that were created by Hibernate's `ddl-auto` during development.
- **Validation:** JPA `ddl-auto: validate` ensures the entity model matches the Flyway-managed schema at startup.

**Configuration:**
```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
  jpa:
    hibernate:
      ddl-auto: validate
```

### 2.2 Rate Limiting

**Purpose:** Protect the hold endpoint from brute-force reservation attempts and accidental traffic spikes.

**Implementation:** `src/main/java/com/ticketing/config/RateLimitingConfig.java`

**Algorithm:** In-memory token bucket (per client IP)
- **Capacity:** 100 tokens (maximum burst)
- **Refill rate:** 50 tokens per second (sustained rate)
- **Bucket isolation:** Each client IP gets its own bucket via ConcurrentHashMap

**How it works:**
1. Requests to `POST /api/reservations/hold` are intercepted by the filter
2. Each request consumes 1 token from the client's bucket
3. Tokens are refilled lazily on access - no background scheduler needed
4. When tokens are exhausted, the filter returns HTTP 429 (Too Many Requests)
5. Non-hold endpoints bypass the filter entirely

**Architecture Rationale:**
- Token bucket handles burst traffic naturally (up to capacity) while enforcing the long-term average
- Per-IP isolation prevents one abusive client from starving others
- Fail-open on lock contention ensures rate limiting doesn't become a bottleneck under load
- Phase-appropriate: single-instance in-memory; replace with Redis-based distributed bucketing for multi-instance

**Configuration:**
```yaml
rate-limiting:
  hold:
    capacity: 100        # Max burst tokens
    refill-tokens: 50     # Tokens added per refill period
    refill-period-seconds: 1  # Refill period
```

### 2.3 Redis Caching

**Purpose:** Reduce database load for frequently-read event and seat listing endpoints.

**Implementation:** `src/main/java/com/ticketing/config/CacheConfig.java`

**Cache regions:**
| Cache Name | TTL | Content |
|-----------|-----|---------|
| events | 30s | Event list (GET /api/events) |
| eventDetails | 60s | Full event details with tier breakdown |
| seats | 30s | Filtered seat listings |

**Architecture Rationale:**
- **Short TTL (30-60s):** Event/seat availability changes constantly during flash sales. A 60s TTL reduces DB load while keeping data reasonably current.
- **Two-tier strategy:** Redis for production (distributed), Caffeine for local dev (zero infra dependency).
- **@CacheEvict on writes:** Creating events or seats automatically invalidates the relevant cache entries.
- **Null values not cached:** Prevents caching of "event not found" responses which would mask transient DB issues.

**Cached methods (EventService):**
| Method | Cache | Key |
|--------|-------|-----|
| listEvents() | events | status filter or 'all' |
| getEventDetails() | eventDetails | event ID |
| listSeats() | seats | eventId + tier + section + status |

### 2.4 Circuit Breakers

**Purpose:** Prevent cascading failures when the database or upstream services degrade.

**Library:** Resilience4j v2.2.0 (Spring Boot 3.x compatible)

**Configuration:**
| Parameter | Default Instance Value | Description |
|-----------|----------------------|-------------|
| sliding-window-size | 20 | Number of calls to evaluate |
| minimum-number-of-calls | 10 | Minimum before evaluating |
| failure-rate-threshold | 50% | Opens circuit when exceeded |
| wait-duration-in-open-state | 10s | Time before half-open retry |
| slow-call-rate-threshold | 50% | Opens circuit on slow responses |
| slow-call-duration-threshold | 2000ms | Threshold for "slow" classification |

**Circuit breaker instances:**
- **reservationService:** Protects reservation operations during flash sales
- **database:** Longer recovery window (30s) for DB connection pool exhaustion

**Health integration:** `register-health-indicator: true` exposes circuit breaker state via `/actuator/health`.

### 2.5 Structured JSON Logging

**Purpose:** Enable log ingestion by ELK/Loki/Grafana for centralized observability.

**Implementation:** Spring Boot 3.4 native structured logging (no external library needed)

**Configuration:**
```yaml
logging:
  structured:
    format:
      console: json
  level:
    com.ticketing: DEBUG
```

**Output format (ECS):**
```json
{
  "@timestamp": "2026-06-22T12:00:00.000Z",
  "log.level": "INFO",
  "message": "Created event: Hamilton (ID=1, strategy=PER_SEAT)",
  "service.name": "event-ticketing",
  "process.thread.name": "http-nio-8080-exec-3",
  "log.logger": "com.ticketing.service.EventService"
}
```

### 2.6 Custom Health Indicators

**Implementation:** `src/main/java/com/ticketing/config/HealthIndicatorConfig.java`

| Indicator | Bean Name | What It Checks | Degradation Signal |
|-----------|-----------|----------------|-------------------|
| **DatabasePoolHealthIndicator** | databasePool | Executes SELECT 1 via HikariCP connection | DOWN when DB is unreachable |
| **RedisHealthIndicator** | redisHealth | Redis PING command | DOWN when Redis unreachable |
| **SweeperHealthIndicator** | sweeperHealth | Queries stale HELD reservations | WARNING when >0 stale; DOWN when >1000 |

**Health endpoint:** `GET /actuator/health` shows detailed component status.

---

## 3. Configuration Reference

### 3.1 application.yml Additions

```yaml
spring:
  datasource:
    hikari:
      minimum-idle: 10
      idle-timeout: 300000
      max-lifetime: 600000
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
  cache:
    type: redis
    redis:
      time-to-live: 60s
      cache-null-values: false
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      timeout: 2000ms

logging:
  structured:
    format:
      console: json

management:
  endpoint:
    health:
      show-details: always
      show-components: always

resilience4j:
  circuitbreaker:
    configs:
      default:
        register-health-indicator: true
        sliding-window-size: 20
        failure-rate-threshold: 50
    instances:
      reservationService:
        base-config: default
      database:
        base-config: default
        wait-duration-in-open-state: 30s

rate-limiting:
  hold:
    capacity: 100
    refill-tokens: 50
    refill-period-seconds: 1
``
