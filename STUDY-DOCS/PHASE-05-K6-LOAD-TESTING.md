# PHASE 5: k6 Load Test Harness

> **Project:** Event Ticketing Management System (High-Concurrency)
> **Status:** ✅ Implemented
> **Last Updated:** 2026-06-22

---

## 1. Overview

Phase 5 delivers a professional k6 load-testing suite designed to validate the system's behaviour under flash-sale traffic patterns. The suite simulates real-world contention scenarios - hundreds of concurrent users holding, confirming, and cancelling reservations - and measures system performance against strict latency and error-rate thresholds.

### What Was Built

- **5 k6 test scripts** covering flash-sale hold, confirm lifecycle, mixed user flows, and smoke validation
- **Shared configuration & helpers** - DRY, reusable modules for all scenarios
- **Custom metrics** - Granular success/conflict rates and latency trends per action type
- **Prometheus-compatible output** - Metrics can be pushed to Prometheus for dashboarding
- **This document** - Runbook and reference guide

---

## 2. File Structure

```
k6/
├── config.js                      # Base URL, thresholds, scenario templates
├── helpers.js                     # API wrappers, response parsing, tagging
└── scenarios/
    ├── smoke-test.js              # Quick 1-VU validation (run this first)
    ├── per-seat-hold.js           # Flash sale: 300 concurrent VUs -> per-seat
    ├── aggregated-hold.js         # Flash sale: tier-based inventory pools
    ├── confirm-flow.js            # Hold -> confirm -> verify lifecycle
    └── mixed-flow.js              # 3-minute mixed real-user simulation
```

---

## 3. Quick Start

### 3.1 Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **k6** | >= 2.0 | choco install k6 / winget install k6 |
| **Application** | Running | mvn spring-boot:run -Dspring-boot.run.profiles=dev |
| **PostgreSQL** | Running | docker compose up -d |

### 3.2 Run the Smoke Test

```bash
# Start the app with seed data
docker compose up -d
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# In another terminal, run the smoke test
k6 run k6/scenarios/smoke-test.js
```

### 3.3 Run Flash-Sale Scenarios

```bash
# Per-seat flash sale (seats A1-B50, ~300 VUs peak)
k6 run k6/scenarios/per-seat-hold.js

# Aggregated inventory flash sale (VIP/GA/Student tiers)
k6 run k6/scenarios/aggregated-hold.js

# Hold -> confirm lifecycle (50 concurrent users)
k6 run k6/scenarios/confirm-flow.js

# 3-minute mixed user simulation (30 constant VUs)
k6 run k6/scenarios/mixed-flow.js
```

---

## 4. Scenario Reference

### 4.1 Smoke Test (smoke-test.js)

Tests: health endpoint, per-seat hold, aggregated hold, GET details, confirm, cancel, duplicate hold (409), invalid token (400), missing fields (400).

### 4.2 Per-Seat Hold (per-seat-hold.js)

- **Model:** ramping-arrival-rate - 10 -> 20 -> 200 req/s
- **Max VUs:** 500
- **Duration:** ~55 seconds
- **Seats targeted:** Random 1-150

### 4.3 Aggregated Hold (aggregated-hold.js)

- **Model:** ramping-arrival-rate - flash-sale curve
- **Tiers:** VIP (max qty 2), GA (max qty 4), Student (max qty 1)

### 4.4 Confirm Flow (confirm-flow.js)

- **Model:** ramping-vus - 0 -> 20 -> 50 VUs
- **Flow:** HOLD -> CONFIRM -> GET (verify CONFIRMED)

### 4.5 Mixed Flow (mixed-flow.js)

- **Model:** constant-vus - 30 VUs for 3 minutes
- **Distribution:** 40% per-seat hold, 20% aggregated hold, 15% confirm, 10% cancel, 15% contention test

---

## 5. Custom Metrics Reference

| Metric | Type | Description |
|--------|------|-------------|
| seat_hold_success_rate | Rate | Fraction of per-seat holds returning 201 |
| seat_hold_conflict_rate | Rate | Fraction of per-seat holds returning 409 |
| seat_hold_duration | Trend | Latency of per-seat hold requests (ms) |
| agg_hold_success_rate | Rate | Fraction of aggregated holds returning 201 |
| agg_hold_exhausted_rate | Rate | Fraction of aggregated holds hitting pool exhaustion |
| agg_hold_duration | Trend | Latency of aggregated hold requests (ms) |
| lifecycle_success_rate | Rate | Fraction of complete hold-confirm-verify flows succeeding |
| lifecycle_duration | Trend | End-to-end lifecycle duration (ms) |
| confirm_latency | Trend | Latency of confirm endpoint alone (ms) |
| mix_action_latency | Trend | Latency across all actions in mixed flow |

---

## 6. Prometheus Integration

Push metrics to Prometheus Remote Write:

```bash
k6 run --out output-prometheus-rw k6/scenarios/per-seat-hold.js
```

Environment variables:
```bash
export K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write
export K6_PROMETHEUS_RW_TREND_STATS="p(95),p(99),min,max,avg"
```

Output to JSON:
```bash
k6 run --out json=results.json k6/scenarios/per-seat-hold.js
```

---

## 7. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| BASE_URL | http://localhost:8080 | Application base URL |
| EVENT_PER_SEAT | 1 | Event ID for per-seat tests |
| EVENT_AGGREGATED | 2 | Event ID for aggregated tests |
| TEST_TYPE | manual | Tag for identifying test runs |

---

## 8. Interpreting Results

### 8.1 Pass/Fail Criteria

| Threshold | Value | Meaning |
|-----------|-------|---------|
| http_req_duration: p(95) | < 500ms | 95% of requests under half-second |
| http_req_duration: p(99) | < 1000ms (strict) | 99th percentile under 1 second |
| http_req_failed | < 1% | Fewer than 1% network/5xx errors |
| seat_hold_success_rate | > 0.1 | At least 10% of holds succeed |

### 8.2 Common Patterns

| Pattern | Likely Cause |
|---------|-------------|
| High seat_hold_conflict_rate | Healthy flash-sale behaviour - seats are legitimately contested |
| Low lifecycle_success_rate | Holds expiring before confirm - check sweeper interval |
| High http_req_failed | DB connection pool exhaustion or network issues |
| Slow p(95) > 1s | Hikari pool contention or slow queries |

---

## 9. Extending the Suite

### Adding a New Scenario

1. Create k6/scenarios/your-scenario.js
2. Import config and helpers
3. Define custom metrics and options with thresholds
4. Export a default function
5. Run: k6 run k6/scenarios/your-scenario.js

---

## 10. Future Enhancements

- k6-operator: Run load tests as Kubernetes CI/CD jobs
- Browser-based scenarios: Use k6/browser for real user checkout flows
- Data parameterization: CSV/JSON files for seat IDs and tokens
- Chaos engineering: Combine k6 with network fault injection
- Grafana dashboard: Pre-built dashboard JSON for real-time visualisation
