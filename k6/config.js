// ---------------------------------------------------------------------------
// k6 Load Test Configuration — Event Ticketing Management System
// ---------------------------------------------------------------------------
// Edit these values to match your environment
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Tokens from the DataSeeder (dev profile)
export const TOKENS = ['alice-token-001', 'bob-token-002'];

// Default seed-data IDs (adjust if your DB has different IDs)
export const EVENTS = {
  PER_SEAT: parseInt(__ENV.EVENT_PER_SEAT) || 1,     // "Hamilton - Broadway"
  AGGREGATED: parseInt(__ENV.EVENT_AGGREGATED) || 2,  // "Summer Music Festival 2026"
};

export const TIERS = {
  PER_SEAT: ['Orchestra', 'Mezzanine', 'Balcony'],
  AGGREGATED: [
    { name: 'VIP', maxQty: 2 },
    { name: 'General Admission', maxQty: 4 },
    { name: 'Student', maxQty: 1 },
  ],
};

// Number of seats per tier (from DataSeeder: 5 rows × 10 seats = 50 per tier)
export const SEATS_PER_TIER = 50;

// ---------------------------------------------------------------------------
// Thresholds — pass/fail criteria for every test
// ---------------------------------------------------------------------------
export const BASE_THRESHOLDS = {
  // 95 % of requests should complete within 500ms
  http_req_duration: ['p(95)<500'],
  // Failed requests (network errors, 5xx) must be below 1 %
  http_req_failed: ['rate<0.01'],
};

// Stricter thresholds for smoke / soak tests
export const STRICT_THRESHOLDS = {
  http_req_duration: ['p(95)<300', 'p(99)<800'],
  http_req_failed: ['rate<0.005'],
};

// ---------------------------------------------------------------------------
// Reusable scenario templates
// ---------------------------------------------------------------------------
export const RAMPING_SCENARIO = {
  executor: 'ramping-vus',
  startVUs: 0,
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 VUs
    { duration: '1m', target: 100 },   // Ramp to 100
    { duration: '2m', target: 200 },   // Ramp to 200
    { duration: '1m', target: 300 },   // Peak at 300
    { duration: '30s', target: 0 },    // Ramp down
  ],
  gracefulRampDown: '10s',
};

export const FLASH_SALE_SCENARIO = {
  executor: 'ramping-arrival-rate',
  startRate: 10,
  timeUnit: '1s',
  preAllocatedVUs: 50,
  maxVUs: 500,
  stages: [
    { duration: '10s', target: 20 },    // Warm-up
    { duration: '5s', target: 100 },    // Flash spike
    { duration: '30s', target: 200 },   // Peak load
    { duration: '10s', target: 0 },     // Cool-down
  ],
};

export const CONSTANT_SCENARIO = {
  executor: 'constant-vus',
  vus: 50,
  duration: '2m',
};
