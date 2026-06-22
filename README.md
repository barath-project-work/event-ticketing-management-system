# Event Ticketing Management System

A high-concurrency event ticketing system designed for flash-sale traffic patterns.
Supports both **per-seat** (assigned seating for theaters/stadiums) and **aggregated**
(tier-based inventory for festivals) strategies.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Java 21, Spring Boot 3.4.1, JPA/Hibernate |
| **Frontend** | React 19, TypeScript, Tailwind CSS, Vite |
| **Database** | PostgreSQL 16 |
| **Cache** | Redis 7 + Caffeine |
| **Containers** | Docker, Docker Compose |
| **Monitoring** | Prometheus, Grafana, k6 |
| **CI/CD** | GitHub Actions |

## Quick Start

```bash
# 1. Full stack with Docker
docker compose up --build

# 2. Or run locally (needs PostgreSQL + Redis running)
mvn spring-boot:run -Dspring-boot.run.profiles=dev
cd frontend && npm run dev

# 3. Access the app
open http://localhost:8080
```

## Features

- **Event Management** — Create, list, and manage events (PER_SEAT or AGGREGATED)
- **Seat Management** — Bulk-create seats, filter by tier/section/status
- **Reservation Lifecycle** — Hold, confirm, cancel, refund, extend
- **Real-time Updates** — WebSocket streaming for seat availability
- **Waiting Queue** — FIFO queue when inventory is exhausted
- **Rate Limiting** — Token-bucket protection on hold endpoint
- **Audit Trail** — Full audit logging for every state transition
- **Load Testing** — k6 flash sale simulations (7 scenarios)

## Documentation

See `MASTER-PROJECT-DOCUMENTATION.md` for complete architecture, API reference,
ERD, workflows, and deployment guide.

## Deployment

Deploy to Render.com using the included `render.yaml` blueprint:
1. Push this repo to GitHub
2. Connect to Render
3. Deploy with the blueprint
