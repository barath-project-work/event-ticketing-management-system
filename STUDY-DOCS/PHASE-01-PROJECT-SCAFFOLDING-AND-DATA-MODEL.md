# PHASE 1: Project Scaffolding & Data Model

> **Project:** Event Ticketing Management System (High-Concurrency)
> **Status:** 📋 Planned
> **Last Updated:** 2026-06-21

---

## 1. Overview

Phase 1 establishes the foundational layer of the event ticketing system. It includes:
- Maven project scaffolding with Spring Boot 3.x
- JPA entity model (Event, Seat, InventoryPool, Reservation, User, AuditLog)
- JPA repositories with optimised queries
- Application configuration (datasource, JPA, logging)
- Docker Compose for local PostgreSQL
- Prerequisites checklist and environment setup

---

## 2. Prerequisites Checklist

### 2.1 System Requirements

| Tool | Required | Installed | Notes |
|------|----------|-----------|-------|
| **Java JDK 21** | Yes | Yes JDK 21.0.10 | Installed at C:\Program Files\Java\jdk-21.0.10 |
| **JAVA_HOME** | Yes | **Not set** | Must be configured for Maven |
| **javac in PATH** | Yes | **Not configured** | JDK bin not in PATH |
| **Maven 3.9+** | Yes | **Not installed** | Neither standalone nor wrapper found |
| **Docker Desktop** | Yes | Yes Installed | Docker CLI available |
| **Docker Compose** | Yes | **Not verified** | Must check docker-compose standalone |
| **Git** | Yes | Yes Installed | Available in PATH |

### 2.2 Action Items Before Implementation

1. **Set JAVA_HOME** environment variable:
   ```
   setx JAVA_HOME "C:\Program Files\Java\jdk-21.0.10"
   ```

2. **Add JDK bin to PATH** (so javac works):
   ```
   setx PATH "%PATH%;C:\Program Files\Java\jdk-21.0.10\bin"
   ```

3. **Install Maven** (choose one option):
   - **Option A:** Download from maven.apache.org -> extract -> add bin to PATH
   - **Option B:** Use Maven Wrapper (auto-downloaded by mvn -N wrapper:wrapper)
   - **Option C:** Use Chocolatey: choco install maven
   - **Option D:** Use SDKMAN via Git Bash

4. **Verify Docker Compose**: Run docker-compose --version to confirm

---

## 3. Project Structure

```
event-ticketing-management/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/com/ticketing/
│   │   │   ├── TicketingApplication.java
│   │   │   ├── config/
│   │   │   │   ├── RetryConfig.java
│   │   │   │   ├── MetricsConfig.java
│   │   │   │   ├── SchedulingConfig.java
│   │   │   │   └── SecurityConfig.java
│   │   │   ├── model/
│   │   │   │   ├── Event.java
│   │   │   │   ├── Seat.java
│   │   │   │   ├── InventoryPool.java
│   │   │   │   ├── Reservation.java
│   │   │   │   ├── User.java
│   │   │   │   ├── AuditLog.java
│   │   │   │   └── enums/
│   │   │   │       ├── SeatStatus.java
│   │   │   │       ├── ReservationStatus.java
│   │   │   │       └── EventStatus.java
│   │   │   ├── repository/
│   │   │   │   ├── EventRepository.java
│   │   │   │   ├── SeatRepository.java
│   │   │   │   ├── InventoryPoolRepository.java
│   │   │   │   ├── ReservationRepository.java
│   │   │   │   ├── UserRepository.java
│   │   │   │   └── AuditLogRepository.java
│   │   │   └── exception/
│   │   │       ├── SeatNotAvailableException.java
│   │   │       ├── ReservationExpiredException.java
│   │   │       └── GlobalExceptionHandler.java
│   │   └── resources/
│   │       ├── application.yml
│   │       └── application-test.yml
│   └── test/
│       └── java/com/ticketing/
│           └── TicketingApplicationTests.java
├── docker-compose.yml
└── docker/
    └── init.sql
```

---

## 4. Dependencies (pom.xml)

### Spring Boot 3.x Starters

| Dependency | Purpose |
|------------|---------|
| spring-boot-starter-web | REST API support |
| spring-boot-starter-data-jpa | JPA/Hibernate ORM |
| spring-boot-starter-validation | Bean Validation (Jakarta) |
| spring-boot-starter-actuator | Health checks, metrics |
| spring-boot-starter-security | Token auth for load tests |
| spring-boot-starter-logging | Logback + structured logging |

### Additional Libraries

| Library | Purpose |
|---------|---------|
| micrometer-registry-prometheus | Prometheus metrics export |
| postgresql | PostgreSQL JDBC driver |
| h2 (test scope) | In-memory DB for unit tests |
| testcontainers-postgresql (test scope) | PostgreSQL container for integration tests |
| lombok | Boilerplate reduction |
| spring-boot-starter-test (test scope) | JUnit 5, Mockito |
| spring-security-test (test scope) | Security test helpers |

---

## 5. Entity Model Design

### 5.1 Entity Relationship Overview

```
Event (1) --- (N) Seat              (Per-seat strategy)
Event (1) --- (N) InventoryPool     (Aggregated strategy)
User  (1) --- (N) Reservation
Seat  (1) --- (1) Reservation       (when held/confirmed)
```

### 5.2 Entity Details

#### Event

| Field | Type | Notes |
|-------|------|-------|
| id | Long (PK, auto) | |
| name | String | Event name |
| description | String (TEXT) | Event description |
| venue | String | Venue name/location |
| eventDate | LocalDateTime | When the event occurs |
| status | EventStatus | DRAFT, ACTIVE, SOLD_OUT, CANCELLED, COMPLETED |
| inventoryStrategy | String | PER_SEAT or AGGREGATED |
| holdDurationSeconds | int | Configurable hold timeout (default 180) |
| createdAt | LocalDateTime | |
| updatedAt | LocalDateTime | |
| version | Long | @Version for optimistic locking |

#### Seat (Per-seat strategy)

| Field | Type | Notes |
|-------|------|-------|
| id | Long (PK, auto) | |
| event | ManyToOne(Event) | |
| label | String | e.g. A1, B12, Floor-42 |
| section | String | e.g. Orchestra, Mezzanine |
| rowName | String | e.g. A, B |
| seatNumber | Integer | |
| tier | String | e.g. VIP, Standard |
| price | BigDecimal | |
| status | SeatStatus | AVAILABLE, HELD, RESERVED |
| version | Long | @Version for optimistic locking |

Indexes: (event_id, status), (event_id, tier)

#### InventoryPool (Aggregated strategy)

| Field | Type | Notes |
|-------|------|-------|
| id | Long (PK, auto) | |
| event | ManyToOne(Event) | |
| tier | String | e.g. VIP, General Admission |
| totalQuantity | Integer | Total available |
| availableQuantity | Integer | Currently available |
| price | BigDecimal | |
| version | Long | @Version for optimistic locking |

Unique index on (event_id, tier)

#### Reservation

| Field | Type | Notes |
|-------|------|-------|
| id | Long (PK, auto) | |
| user | ManyToOne(User) | |
| event | ManyToOne(Event) | |
| seat | OneToOne(Seat), nullable | For per-seat strategy |
| inventoryPool | ManyToOne(InventoryPool), nullable | For aggregated strategy |
| quantity | Integer | For aggregated strategy |
| status | ReservationStatus | HELD, CONFIRMED, CANCELLED, EXPIRED |
| heldAt | LocalDateTime | When the hold was created |
| confirmedAt | LocalDateTime, nullable | When confirmed |
| expiresAt | LocalDateTime | When the hold expires |
| idempotencyKey | String, unique | For idempotent retries |
| createdAt | LocalDateTime | |
| updatedAt | LocalDateTime | |

Indexes: (status, expires_at), (idempotency_key) unique, (user_id, event_id)

#### User

| Field | Type | Notes |
|-------|------|-------|
| id | Long (PK, auto) | |
| email | String, unique | |
| name | String | |
| token | String, unique | API token for load test auth |
| createdAt | LocalDateTime | |

#### AuditLog

| Field | Type | Notes |
|-------|------|-------|
| id | Long (PK, auto) | |
| eventId | Long | |
| reservationId | Long, nullable | |
| userId | Long | |
| action | String | HOLD, CONFIRM, CANCEL, EXPIRE, RETRY |
| details | String (TEXT) | JSON details |
| createdAt | LocalDateTime | |

Index: (event_id, created_at)

### 5.3 Enums

#### SeatStatus
- AVAILABLE - Seat is free
- HELD - Temporarily held by a user
- RESERVED - Confirmed/paid

#### ReservationStatus
- HELD - Temporarily held
- CONFIRMED - Booking confirmed
- CANCELLED - Cancelled by user
- EXPIRED - Hold timed out (sweeper)

#### EventStatus
- DRAFT - Not yet on sale
- ACTIVE - On sale
- SOLD_OUT - All seats sold
- CANCELLED - Event cancelled
- COMPLETED - Event happened

---

## 6. Database Indexes

| Table | Index Name | Columns | Purpose |
|-------|-----------|---------|---------|
| seat | idx_seat_event_status | (event_id, status) | Find availa
