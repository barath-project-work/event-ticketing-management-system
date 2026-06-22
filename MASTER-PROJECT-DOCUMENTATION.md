# Event Ticketing Management System — Master Project Documentation

> **Version:** 1.0.0
> **Last Updated:** 2026-06-22
> **Tech Stack:** Java 21, Spring Boot 3.4.1, PostgreSQL 16, JPA/Hibernate, Maven, Docker, Testcontainers, k6, Prometheus, Grafana
> **Project Root:** `C:\Users\workm\OneDrive\Documents\event-ticketing-management`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Data Model](#3-data-model)
4. [API Reference](#4-api-reference)
5. [System Workflows](#5-system-workflows)
6. [Design Decisions & Rationale](#6-design-decisions--rationale)
7. [Deployment Guide](#7-deployment-guide)
8. [Operations Runbook](#8-operations-runbook)
9. [Testing & Quality](#9-testing--quality)
10. [Appendix](#10-appendix)

---

## 1. Project Overview

### 1.1 Purpose

A high-concurrency event ticketing management system designed for flash-sale traffic patterns. Supports both **per-seat** (assigned seating for theaters/stadiums) and **aggregated** (tier-based inventory for festivals) strategies with:

- Optimistic locking with retryable operations for concurrent contention
- Automatic hold expiry sweepers for inventory release
- REST API for reservation lifecycle (hold, confirm, cancel, refund)
- Token-based authentication for API access
- Rate limiting, caching, and circuit breakers for production resilience

### 1.2 Business Capabilities

| Capability | Description |
|-----------|-------------|
| **Event Management** | Create, list, and manage events with dual inventory strategies |
| **Seat Management** | Bulk-create seats, filter by tier/section/status |
| **Reservation Lifecycle** | Hold, confirm, cancel, refund, and extend reservations |
| **Inventory Tracking** | Real-time availability counts by tier with WebSocket streaming |
| **Waiting Queue** | FIFO queue when inventory is exhausted during flash sales |
| **Audit Trail** | Full audit logging for every state transition |
| **Rate Limiting** | Token-bucket protection on hold endpoint |
| **Health Monitoring** | Custom health indicators for DB, Redis, and sweeper |

---

## 2. Architecture

### 2.1 High-Level Architecture Diagram

```
                             ┌─────────────────┐
                             │   Clients        │
                             │ (k6 / curl / App)│
                             └────────┬────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                  │
                    ▼                 ▼                  ▼
            ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
            │  REST API     │ │  WebSocket   │ │  /actuator   │
            │  :8080/api    │ │  :8080/ws    │ │  Health/Metrics│
            └───────┬───────┘ └──────┬───────┘ └──────┬───────┘
                    │                │                │
                    ▼                │                ▼
            ┌───────────────┐        │       ┌──────────────┐
            │  Spring Boot  │        │       │  Prometheus  │
            │  Controllers  │        │       │  /actuator/  │
            └───────┬───────┘        │       │  prometheus  │
                    │                │       └──────────────┘
                    ▼                │
            ┌───────────────┐        │
            │  Services     │        │
            │  (Business    │        │
            │   Logic)      │        │
            └───────┬───────┘        │
                    │                │
                    ▼                ▼
            ┌───────────────┐ ┌──────────────┐
            │  JPA/         │ │  Redis       │
            │  Hibernate    │ │  (Cache)     │
            └───────┬───────┘ └──────────────┘
                    │
                    ▼
            ┌───────────────┐
            │  PostgreSQL   │
            │  16 Alpine    │
            └───────────────┘
```

### 2.2 Package Structure

```
src/main/java/com/ticketing/
├── TicketingApplication.java          # Spring Boot entry point
├── bootstrap/
│   └── DataSeeder.java                # Dev profile seed data
├── config/
│   ├── CacheConfig.java               # Redis + Caffeine caching
│   ├── HealthIndicatorConfig.java      # Custom health indicators
│   ├── MetricsConfig.java              # Prometheus metrics tags
│   ├── RateLimitingConfig.java         # Token-bucket rate limiter
│   ├── RetryConfig.java                # Retry template configuration
│   ├── SchedulingConfig.java           # @EnableScheduling
│   ├── SecurityConfig.java             # Stateless security
│   └── WebSocketConfig.java            # Real-time availability
├── controller/
│   ├── AdminController.java            # Admin CRUD endpoints
│   ├── EventController.java            # Public event/seat browsing
│   └── ReservationController.java      # Reservation lifecycle
├── dto/
│   ├── BulkHoldRequest.java
│   ├── ConfirmRequest.java
│   ├── CreateEventRequest.java
│   ├── CreateSeatRequest.java
│   ├── EventResponse.java
│   ├── EventSummaryResponse.java
│   ├── HoldSeatRequest.java
│   └── ReservationResponse.java
├── exception/
│   ├── GlobalExceptionHandler.java     # Centralized error handling
│   ├── ReservationExpiredException.java
│   └── SeatNotAvailableException.java
├── model/
│   ├── AuditLog.java                   # Audit trail entity
│   ├── Event.java                      # Event entity (hybrid strategy)
│   ├── InventoryPool.java              # Aggregated inventory
│   ├── Reservation.java                # Reservation entity
│   ├── Seat.java                       # Per-seat entity
│   ├── User.java                       # User/token entity
│   └── enums/
│       ├── EventStatus.java
│       ├── ReservationStatus.java
│       └── SeatStatus.java
├── repository/
│   ├── AuditLogRepository.java
│   ├── EventRepository.java            # + aggregation queries
│   ├── InventoryPoolRepository.java
│   ├── ReservationRepository.java      # + JOIN FETCH queries
│   ├── SeatRepository.java             # + filtered listing queries
│   └── UserRepository.java
└── service/
    ├── EventService.java               # Event/seat CRUD with caching
    ├── ReservationService.java          # Reservation lifecycle + Phase 8 features
    ├── ReservationSweeperService.java   # Scheduled hold expiry
    ├── TokenAuthService.java            # Token-based authentication
    └── WaitingQueueService.java         # In-memory FIFO waiting queue
```

### 2.3 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Language** | Java 21 | Latest LTS with pattern matching, records, virtual threads |
| **Framework** | Spring Boot 3.4.1 | Production-grade application framework |
| **ORM** | JPA/Hibernate 6 | Object-relational mapping with batch optimization |
| **Database** | PostgreSQL 16 Alpine | ACID-compliant relational database |
| **Cache** | Redis + Caffeine | Distributed + local caching |
| **API** | REST (JSON) | HTTP API for all operations |
| **Auth** | Token-based | Simple token auth for API access |
| **Build** | Maven 3.9+ | Dependency management and build |
| **Container** | Docker + Compose | Local development and deployment |
| **Load Testing** | k6 2.0+ | Flash-sale traffic simulation |
| **Monitoring** | Prometheus + Grafana | Metrics collection and dashboards |
| **CI/CD** | GitHub Actions | Automated build, test, deploy |

---

## 3. Data Model

### 3.1 Entity Relationship Diagram

```
┌───────────┐       ┌───────────┐       ┌──────────────────┐
│   User    │       │   Event   │       │   InventoryPool  │
├───────────┤       ├───────────┤       ├──────────────────┤
│ id (PK)   │1──N┐  │ id (PK)   │1──N┐  │ id (PK)          │
│ email     │    │  │ name      │    │  │ event_id (FK)    │
│ name      │    │  │ venue     │    │  │ tier (UNIQUE)    │
│ token     │    │  │ eventDate │    │  │ totalQuantity    │
│ createdAt │    │  │ status    │    │  │ availQuantity    │
└───────────┘    │  │ strategy  │1──N┐  │ price            │
                 │  │ holdDur  
