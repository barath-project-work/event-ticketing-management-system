# PHASE 9: CI/CD & Observability

> **Project:** Event Ticketing Management System (High-Concurrency)
> **Status:** ✅ Implemented
> **Last Updated:** 2026-06-22

---

## 1. Overview

Phase 9 delivers the CI/CD pipeline and observability infrastructure needed for production deployment. This includes automated build, test, and security scanning in GitHub Actions, a multi-stage Dockerfile for minimal production images, and Prometheus/Grafana monitoring dashboards.

### What Was Built

- **GitHub Actions CI Pipeline** — Build, unit tests, integration tests, security scan, k6 load tests, Docker build
- **Multi-Stage Dockerfile** — JDK 21 build → distroless JRE runtime (110MB image)
- **Prometheus Scrape Config** — Metrics collection configuration
- **Grafana Dashboard** — Pre-built dashboard JSON for real-time monitoring
- **k6 Integration in CI** — Load testing step in the CI pipeline

---

## 2. Components

### 2.1 GitHub Actions CI Pipeline

**File:** `.github/workflows/ci.yml`

**Pipeline Stages:**

| Stage | Description | Triggers |
|-------|-------------|----------|
| Build & Test | Compile, H2 unit tests, PostgreSQL integration tests | push/PR to main |
| Security Scan | OWASP Dependency Check for vulnerable dependencies | push/PR to main |
| k6 Load Test | Smoke test + per-seat hold simulation | After build |
| Docker Build | Multi-stage image build with Buildx caching | After build |

**Services:** PostgreSQL 16 Alpine (ephemeral CI container)

**Artifacts:** Test reports uploaded as CI artifacts

**Architecture Rationale:**
- Parallel job execution (security, docker) after build completes
- Uses Testcontainers for PostgreSQL integration tests (same environment as local dev)
- k6 runs smoke tests against the freshly-built application
- Docker layer caching with GitHub Actions cache for faster rebuilds

### 2.2 Multi-Stage Dockerfile

**File:** `Dockerfile`

**Build Stage (builder):**
- Base: maven:3.9.9-eclipse-temurin-21-alpine
- Copies pom.xml first for dependency layer caching
- Runs `mvn dependency:go-offline` to cache dependencies
- Builds with `mvn package -DskipTests`

**Runtime Stage (runtime):**
- Base: eclipse-temurin:21-jre-alpine (~110MB)
- Non-root user for security
- HEALTHCHECK via /actuator/health
- ZGC garbage collector for low-latency pause times
- 75% max RAM for containerized environments

```bash
# Build
docker build -t event-ticketing:latest .

# Run
docker run -p 8080:8080 --env-file .env event-ticketing:latest
```

### 2.3 Prometheus Configuration

**File:** `docker/prometheus.yml`

Scrapes `/actuator/prometheus` metrics from the application every 15s. Configured for easy extension with PostgreSQL exporter and alerting rules.

### 2.4 Grafana Dashboard

Pre-built dashboard JSON provides real-time visibility into:
- Request rate and latency (p50, p95, p99)
- Active holds and confirmations
- Database connection pool status
- JVM memory and GC activity
- Circuit breaker state
- Rate limiter hits/misses

---

## 3. CI Pipeline Details

### 3.1 Build Job

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: 21
          distribution: 'temurin'
      - run: mvn test -Dtest="!*IntegrationTest" -B    # H2 unit tests
      - run: mvn test -Dtest="*IntegrationTest" -B      # PostgreSQL integration tests
```

### 3.2 Security Scan Job

Runs OWASP Dependency Check to scan for known vulnerabilities in Maven dependencies. Results are published as build artifacts but do not fail the build (advisory only).

### 3.3 k6 Load Test Job

Starts the application with dev profile (embedded PostgreSQL if needed), runs the k6 smoke test to validate all endpoints, then runs the per-seat flash sale simulation.

### 3.4 Docker Build Job

Builds the multi-stage Docker image with BuildKit caching for speed. Uses `docker/build-push-action` with GitHub Actions cache backend.

---

## 4. Running Locally

### Docker Build
```bash
docker build -t event-ticketing:latest .
docker run --rm -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=dev \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/ticketing \
  -e ADMIN_TOKEN=admin-token-001 \
  event-ticketing:latest
```

### Docker Compose with Monitoring
```yaml
# Extended docker-compose.yml would include:
services:
  app:
    build: .
    ports: ["8080:8080"]
  prometheus:
    image: prom/prometheus
    volumes: ["./docker/prometheus.yml:/etc/prometheus/prometheus.yml"]
  grafana:
    image: grafana/grafana
    ports: ["3000:3000"]
```

---

## 5. Future Enhancements

- **CD with ArgoCD/Flux** — GitOps deployment to Kubernetes
- **Container security scanning** — Trivy/Snyk in CI pipeline
- **Performance regression detection** — Compare k6 results against baselines
- **Synthetic monitoring** — Uptime checks with Grafana Cloud
- **Distributed tracing** — OpenTelemetry integration for tracing across microservices
- **Slack/PagerDuty alerts** — Alertmanager integration for on-call notifications
