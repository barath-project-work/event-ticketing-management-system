// ---------------------------------------------------------------------------
// k6 Scenario: Mixed Flow — Realistic User Behaviour
// ---------------------------------------------------------------------------
// Simulates diverse user actions during a flash sale:
//   - 40% hold a seat (PER_SEAT)
//   - 20% hold tickets from pooled inventory (AGGREGATED)
//   - 15% confirm a previously held reservation
//   - 10% cancel a previously held reservation
//   - 15% attempt to hold an already-contested seat (contention edge case)
//
// This scenario runs longer to test system stability under mixed load.
// ---------------------------------------------------------------------------
import { group, check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import {
  STRICT_THRESHOLDS,
  CONSTANT_SCENARIO,
  EVENTS,
  TIERS,
  SEATS_PER_TIER,
} from '../config.js';
import {
  holdPerSeat,
  holdAggregated,
  confirmReservation,
  cancelReservation,
  randomItem,
  randomInt,
  randomToken,
  parseBody,
  extractReservationId,
} from '../helpers.js';

// ---------------------------------------------------------------------------
// Custom metrics per action type
// ---------------------------------------------------------------------------
const actionCounters = {
  perSeatHold: new Rate('mix_per_seat_hold_rate'),
  aggHold: new Rate('mix_agg_hold_rate'),
  confirm: new Rate('mix_confirm_rate'),
  cancel: new Rate('mix_cancel_rate'),
  contention: new Rate('mix_contention_rate'),
};

const actionLatency = new Trend('mix_action_latency');

// ---------------------------------------------------------------------------
// Simple in-memory store per VU (resets each iteration)
// ---------------------------------------------------------------------------
// We store reservations we've successfully created so we can confirm/cancel
let vuReservations = [];

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------
export const options = {
  thresholds: {
    ...STRICT_THRESHOLDS,
    mix_per_seat_hold_rate: ['rate>0.1'],
    mix_agg_hold_rate: ['rate>0.1'],
  },
  scenarios: {
    mixed_load: {
      executor: CONSTANT_SCENARIO.executor,
      vus: 30,
      duration: '3m',
      tags: { scenario: 'mixed-flow' },
    },
  },
};

// ---------------------------------------------------------------------------
// Main test function
// ---------------------------------------------------------------------------
export default function () {
  group('Mixed User Flow', function () {
    const token = randomToken();
    const action = Math.random();

    if (action < 0.40) {
      // 40%: Per-seat hold
      performPerSeatHold(token);
    } else if (action < 0.60) {
      // 20%: Aggregated hold
      performAggregatedHold(token);
    } else if (action < 0.75 && vuReservations.length > 0) {
      // 15%: Confirm existing reservation
      performConfirm(token);
    } else if (action < 0.85 && vuReservations.length > 0) {
      // 10%: Cancel existing reservation
      performCancel(token);
    } else {
      // 15%: Attempt to hold a specific already-contested seat
      performContentionTest(token);
    }
  });
}

// ---------------------------------------------------------------------------
// Action implementations
// ---------------------------------------------------------------------------

function performPerSeatHold(token) {
  const seatId = randomInt(1, SEATS_PER_TIER * 3);
  const startTime = Date.now();
  const res = holdPerSeat(EVENTS.PER_SEAT, seatId);
  actionLatency.add(Date.now() - startTime);

  if (res.status === 201) {
    actionCounters.perSeatHold.add(1);
    const id = extractReservationId(res);
    if (id) vuReservations.push({ id, token, type: 'per_seat' });
  } else {
    actionCounters.perSeatHold.add(0);
  }
}

function performAggregatedHold(token) {
  const tierDef = randomItem(TIERS.AGGREGATED);
  const quantity = randomInt(1, tierDef.maxQty);
  const startTime = Date.now();
  const res = holdAggregated(EVENTS.AGGREGATED, tierDef.name, quantity);
  actionLatency.add(Date.now() - startTime);

  if (res.status === 201) {
    actionCounters.aggHold.add(1);
    const id = extractReservationId(res);
    if (id) vuReservations.push({ id, token, type: 'aggregated' });
  } else {
    actionCounters.aggHold.add(0);
  }
}

function performConfirm(token) {
  const reservation = vuReservations.pop();
  if (!reservation) return;

  const startTime = Date.now();
  const res = confirmReservation(reservation.id, reservation.token);
  actionLatency.add(Date.now() - startTime);

  const body = parseBody(res);
  const success = check(res, {
    'confirm returns 200/409': (r) => r.status === 200 || r.status === 409,
  });

  if (res.status === 200 && body && body.status === 'CONFIRMED') {
    actionCounters.confirm.add(1);
  } else {
    actionCounters.confirm.add(0);
    // If confirm failed (expired), just move on
  }
}

function performCancel(token) {
  const reservation = vuReservations.pop();
  if (!reservation) return;

  const startTime = Date.now();
  const res = cancelReservation(reservation.id, reservation.token);
  actionLatency.add(Date.now() - startTime);

  const body = parseBody(res);
  if (res.status === 200 && body && body.status === 'CANCELLED') {
    actionCounters.cancel.add(1);
  } else {
    actionCounters.cancel.add(0);
  }
}

function performContentionTest(token) {
  // Two users attempt to hold the same seat simultaneously
  // We use deterministic seat ID to increase collision probability
  const seatId = (__VU % 30) + 1; // 30 seats contested by all VUs
  const startTime = Date.now();
  const res = holdPerSeat(EVENTS.PER_SEAT, seatId);
  actionLatency.add(Date.now() - startTime);

  if (res.status === 201) {
    actionCounters.contention.add(1);
    const id = extractReservationId(res);
    if (id) vuReservations.push({ id, token, type: 'per_seat' });
  } else {
    // 201 = got the hold, 409 = expected contention
    actionCounters.contention.add(res.status === 201 ? 1 : 0);
  }
}
