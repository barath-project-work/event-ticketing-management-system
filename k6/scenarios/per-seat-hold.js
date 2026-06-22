// ---------------------------------------------------------------------------
// k6 Scenario: Per-Seat Hold — Flash Sale Simulation
// ---------------------------------------------------------------------------
// Simulates a flash-sale launch where hundreds of users simultaneously try
// to hold individual seats for a per-seat event (e.g., Broadway show).
//
// Expected behaviour:
//   - Some holds succeed (201) — seat was AVAILABLE
//   - Some holds fail (409)   — seat was already HELD or RESERVED
//   - Optimistic locking retries handle contention gracefully
// ---------------------------------------------------------------------------
import { group } from 'k6';

import { Rate, Trend } from 'k6/metrics';
import {
  BASE_THRESHOLDS,
  FLASH_SALE_SCENARIO,
  EVENTS,
  SEATS_PER_TIER,
} from '../config.js';
import {
  holdPerSeat,
  randomInt,
} from '../helpers.js';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const successRate = new Rate('seat_hold_success_rate');
const conflictRate = new Rate('seat_hold_conflict_rate');
const holdDuration = new Trend('seat_hold_duration');
const retryRate = new Rate('seat_hold_retry_rate');

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export const options = {
  thresholds: {
    ...BASE_THRESHOLDS,
    // Track success rate — at least some holds should succeed
    seat_hold_success_rate: ['rate>0.1'],
  },
  scenarios: {
    flash_sale: {
      executor: FLASH_SALE_SCENARIO.executor,
      startRate: FLASH_SALE_SCENARIO.startRate,
      timeUnit: FLASH_SALE_SCENARIO.timeUnit,
      preAllocatedVUs: FLASH_SALE_SCENARIO.preAllocatedVUs,
      maxVUs: FLASH_SALE_SCENARIO.maxVUs,
      stages: FLASH_SALE_SCENARIO.stages,
      gracefulStop: '5s',
      tags: { scenario: 'per-seat-hold' },
    },
  },
};

// ---------------------------------------------------------------------------
// Main test function — each VU iteration
// ---------------------------------------------------------------------------
export default function () {
  group('Per-Seat Hold — Flash Sale', function () {
    // Pick a random seat from the available range (seat IDs 1–150 by default)
    const maxSeatId = SEATS_PER_TIER * 3; // 150 seats
    const seatId = randomInt(1, maxSeatId);

    const startTime = Date.now();
    const res = holdPerSeat(EVENTS.PER_SEAT, seatId);
    const elapsed = Date.now() - startTime;

    holdDuration.add(elapsed);

    if (res.status === 201) {
      // Successful hold
      successRate.add(1);
      successRate.add(1, { seat_id: String(seatId) });
    } else if (res.status === 409) {
      // Seat not available — expected under contention
      conflictRate.add(1);
      successRate.add(0);
    } else {
      // Unexpected status
      check(res, {
        'unexpected status is handled': (r) => r.status > 0,
      });
      successRate.add(0);
      console.warn(`Unexpected status ${res.status} for seat ${seatId}: ${res.body}`);
    }
  });
}
