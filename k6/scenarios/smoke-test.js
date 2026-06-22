// ---------------------------------------------------------------------------
// k6 Smoke Test — Quick System Validation
// ---------------------------------------------------------------------------
// Run this first to confirm the API is reachable and basic flows work:
//   k6 run k6/scenarios/smoke-test.js
//
// This tests:
//   1. Health endpoint
//   2. Per-seat hold
//   3. Aggregated hold
//   4. Reservation details (GET)
//   5. Confirm reservation
//   6. Cancel reservation
//   7. Already-held seat rejection (409)
//   8. Invalid token rejection (400)
//   9. Missing fields rejection (400)
// ---------------------------------------------------------------------------
import http from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL, EVENTS, STRICT_THRESHOLDS } from '../config.js';
import {
  holdPerSeat,
  holdAggregated,
  confirmReservation,
  cancelReservation,
  getReservation,
  randomToken,
  parseBody,
} from '../helpers.js';

const TOKEN = 'alice-token-001';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export const options = {
  vus: 1,
  iterations: 1,
  thresholds: STRICT_THRESHOLDS,
};

// ---------------------------------------------------------------------------
// Main test function
// ---------------------------------------------------------------------------
export default function () {
  // ---- 1. Health check ----
  group('Health Check', function () {
    const res = http.get(`${BASE_URL}/actuator/health`);
    check(res, {
      'health returns 200': (r) => r.status === 200,
    });
  });

  // ---- 2. Per-seat hold ----
  let perSeatResId;
  group('Per-Seat Hold', function () {
    const res = holdPerSeat(EVENTS.PER_SEAT, 1);
    const body = parseBody(res);

    check(res, {
      'hold returns 201': (r) => r.status === 201,
      'hold status is HELD': () => body && body.status === 'HELD',
      'seat label is present': () => body && body.seatLabel,
      'expiresAt is present': () => body && body.expiresAt,
    });

    perSeatResId = body ? body.id : null;
  });

  // ---- 3. Aggregated hold ----
  let aggResId;
  group('Aggregated Hold', function () {
    const res = holdAggregated(EVENTS.AGGREGATED, 'General Admission', 2);
    const body = parseBody(res);

    check(res, {
      'agg hold returns 201': (r) => r.status === 201,
      'agg hold status is HELD': () => body && body.status === 'HELD',
      'tier is present': () => body && body.tier === 'General Admission',
      'quantity is 2': () => body && body.quantity === 2,
    });

    aggResId = body ? body.id : null;
  });

  // ---- 4. Get reservation details ----
  group('Get Reservation Details', function () {
    if (perSeatResId) {
      const res = getReservation(perSeatResId, TOKEN);
      const body = parseBody(res);

      check(res, {
        'get returns 200': (r) => r.status === 200,
        'get eventName is correct': () => body && body.eventName === 'Hamilton - Broadway',
        'get seatLabel is A1': () => body && body.seatLabel === 'A1',
        'get status is HELD': () => body && body.status === 'HELD',
      });
    }
  });

  // ---- 5. Confirm reservation ----
  group('Confirm Reservation', function () {
    if (perSeatResId) {
      const res = confirmReservation(perSeatResId, TOKEN);
      const body = parseBody(res);

      check(res, {
        'confirm returns 200': (r) => r.status === 200,
        'confirm status is CONFIRMED': () => body && body.status === 'CONFIRMED',
        'confirmedAt is present': () => body && body.confirmedAt,
      });
    }
  });

  // ---- 6. Cancel reservation ----
  group('Cancel Reservation', function () {
    if (aggResId) {
      const res = cancelReservation(aggResId, TOKEN);
      const body = parseBody(res);

      check(res, {
        'cancel returns 200': (r) => r.status === 200,
        'cancel status is CANCELLED': () => body && body.status === 'CANCELLED',
      });
    }
  });

  // ---- 7. Already-held seat rejection (409) ----
  group('Already-Held Seat Rejection', function () {
    // Seat 1 was already held in step 2, try to hold it again
    const res = holdPerSeat(EVENTS.PER_SEAT, 1);
    check(res, {
      'duplicate hold returns 409': (r) => r.status === 409,
    });
  });

  // ---- 8. Invalid token rejection (400) ----
  group('Invalid Token Rejection', function () {
    const payload = JSON.stringify({
      eventId: EVENTS.PER_SEAT,
      seatId: 10,
      token: 'invalid-token',
    });
    const headers = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(`${BASE_URL}/api/reservations/hold`, payload, headers);

    check(res, {
      'invalid token returns 400': (r) => r.status === 400,
    });
  });

  // ---- 9. Missing fields rejection (400) ----
  group('Missing Fields Rejection', function () {
    const payload = JSON.stringify({ token: TOKEN });
    const headers = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(`${BASE_URL}/api/reservations/hold`, payload, headers);

    check(res, {
      'missing fields returns 400': (r) => r.status === 400,
    });
  });

}

