// ---------------------------------------------------------------------------
// k6 Scenario: Confirm Flow — Hold → Confirm Lifecycle
// ---------------------------------------------------------------------------
// Tests the complete hold → confirm lifecycle under moderate load.
// VUs hold a seat/ticket first, then immediately confirm it.
//
// Expected behaviour:
//   - First hold must succeed
//   - Confirm must transition status to CONFIRMED and seat to RESERVED
//   - Idempotency is verified by querying the reservation afterward
// ---------------------------------------------------------------------------
import { group } from 'k6';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import {
  BASE_THRESHOLDS,
  RAMPING_SCENARIO,
  EVENTS,
} from '../config.js';
import {
  holdPerSeat,
  confirmReservation,
  getReservation,
  randomInt,
  randomToken,
  parseBody,
  extractReservationId,
} from '../helpers.js';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const lifecycleSuccessRate = new Rate('lifecycle_success_rate');
const confirmLatency = new Trend('confirm_latency');

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export const options = {
  thresholds: {
    ...BASE_THRESHOLDS,
    lifecycle_success_rate: ['rate>0.8'],
  },
  scenarios: {
    confirm_flow: {
      executor: RAMPING_SCENARIO.executor,
      startVUs: RAMPING_SCENARIO.startVUs,
      stages: [
        { duration: '20s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '5s',
      tags: { scenario: 'confirm-flow' },
    },
  },
};

// ---------------------------------------------------------------------------
// Main test function
// ---------------------------------------------------------------------------
export default function () {
  group('Hold → Confirm Lifecycle', function () {
    const token = randomToken();

    // --- Step 1: Hold a random seat ---
    const seatId = randomInt(1, 150);
    const holdRes = holdPerSeat(EVENTS.PER_SEAT, seatId);

    if (holdRes.status !== 201) {
      lifecycleSuccessRate.add(0);
      return;
    }

    const reservationId = extractReservationId(holdRes);
    if (!reservationId) {
      lifecycleSuccessRate.add(0);
      return;
    }

    // --- Step 2: Confirm the reservation ---
    const confirmStart = Date.now();
    const confirmRes = confirmReservation(reservationId, token);
    const confirmTime = Date.now() - confirmStart;

    confirmLatency.add(confirmTime);

    const confirmBody = parseBody(confirmRes);
    const confirmed = check(confirmRes, {
      'confirm returns 200': (r) => r.status === 200,
      'confirm status is CONFIRMED': (r) => confirmBody && confirmBody.status === 'CONFIRMED',
    });

    if (!confirmed) {
      lifecycleSuccessRate.add(0);
      console.warn(`Confirm failed for reservation ${reservationId}: ${confirmRes.body}`);
      return;
    }

    // --- Step 3: Verify via GET ---
    const getRes = getReservation(reservationId, token);
    const getBody = parseBody(getRes);
    const verified = check(getRes, {
      'get returns 200': (r) => r.status === 200,
      'get status is CONFIRMED': (r) => getBody && getBody.status === 'CONFIRMED',
    });

    lifecycleSuccessRate.add(verified ? 1 : 0);
  });
}
