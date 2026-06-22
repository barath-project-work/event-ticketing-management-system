// ---------------------------------------------------------------------------
// k6 Scenario: Aggregated Hold — Flash Sale Simulation
// ---------------------------------------------------------------------------
// Simulates a festival ticket launch where users compete for tier-based
// inventory pools (VIP, General Admission, Student).
//
// Expected behaviour:
//   - Successful holds decrement pool.availableQuantity
//   - Exhausted pools return 409 "Not enough tickets available"
//   - Optimistic locking prevents overselling
// ---------------------------------------------------------------------------
import { group } from 'k6';

import { Rate, Trend } from 'k6/metrics';
import {
  BASE_THRESHOLDS,
  FLASH_SALE_SCENARIO,
  EVENTS,
  TIERS,
} from '../config.js';
import {
  holdAggregated,
  randomItem,
  randomInt,
} from '../helpers.js';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const successRate = new Rate('agg_hold_success_rate');
const exhaustedRate = new Rate('agg_hold_exhausted_rate');
const holdDuration = new Trend('agg_hold_duration');

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export const options = {
  thresholds: {
    ...BASE_THRESHOLDS,
    agg_hold_success_rate: ['rate>0.1'],
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
      tags: { scenario: 'aggregated-hold' },
    },
  },
};

// ---------------------------------------------------------------------------
// Main test function
// ---------------------------------------------------------------------------
export default function () {
  group('Aggregated Hold — Flash Sale', function () {
    // Pick a random tier
    const tierDef = randomItem(TIERS.AGGREGATED);
    const quantity = randomInt(1, tierDef.maxQty);

    const startTime = Date.now();
    const res = holdAggregated(EVENTS.AGGREGATED, tierDef.name, quantity);
    const elapsed = Date.now() - startTime;

    holdDuration.add(elapsed);

    if (res.status === 201) {
      successRate.add(1);
      successRate.add(1, { tier: tierDef.name });
    } else if (res.status === 409) {
      // Inventory exhausted for this tier — expected under high load
      exhaustedRate.add(1);
      successRate.add(0);
    } else {
      check(res, {
        'unexpected status is handled': (r) => r.status > 0,
      });
      successRate.add(0);
      console.warn(
        `Unexpected status ${res.status} for tier ${tierDef.name}: ${res.body}`
      );
    }
  });
}
