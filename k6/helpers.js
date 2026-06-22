// ---------------------------------------------------------------------------
// API Helpers — Event Ticketing Management System
// ---------------------------------------------------------------------------
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, TOKENS } from './config.js';

// Pick a random element from an array
export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Pick a random integer between min and max (inclusive)
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Pick a random token
export function randomToken() {
  return randomItem(TOKENS);
}

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

// ---------------------------------------------------------------------------
// Reservation API calls
// ---------------------------------------------------------------------------

/**
 * Hold a seat (PER_SEAT strategy) or tickets (AGGREGATED strategy).
 * Returns the response object.
 */
export function holdSeat(eventId, payloadOverrides = {}) {
  const payload = JSON.stringify({
    eventId,
    token: randomToken(),
    ...payloadOverrides,
  });

  const res = http.post(`${BASE_URL}/api/reservations/hold`, payload, JSON_HEADERS);

  check(res, {
    'hold status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  return res;
}

/**
 * Hold a per-seat seat. Picks a random seat ID from the range.
 */
export function holdPerSeat(eventId, seatId) {
  return holdSeat(eventId, { seatId });
}

/**
 * Hold an aggregated-tier ticket.
 */
export function holdAggregated(eventId, tier, quantity = 1) {
  return holdSeat(eventId, { tier, quantity });
}

/**
 * Confirm a reservation.
 */
export function confirmReservation(reservationId, token) {
  const payload = JSON.stringify({ token });
  const res = http.post(
    `${BASE_URL}/api/reservations/${reservationId}/confirm`,
    payload,
    JSON_HEADERS
  );

  check(res, {
    'confirm status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  return res;
}

/**
 * Cancel a reservation.
 */
export function cancelReservation(reservationId, token) {
  const payload = JSON.stringify({ token });
  const res = http.post(
    `${BASE_URL}/api/reservations/${reservationId}/cancel`,
    payload,
    JSON_HEADERS
  );

  check(res, {
    'cancel status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });

  return res;
}

/**
 * Get reservation details.
 */
export function getReservation(reservationId, token) {
  const res = http.get(
    `${BASE_URL}/api/reservations/${reservationId}?token=${token}`,
    JSON_HEADERS
  );

  check(res, {
    'get status is 200': (r) => r.status === 200,
  });

  return res;
}

// ---------------------------------------------------------------------------
// Response parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse JSON response body, returning null on failure.
 */
export function parseBody(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return null;
  }
}

/**
 * Extract reservation ID from a successful hold response.
 */
export function extractReservationId(res) {
  const body = parseBody(res);
  return body && body.id ? body.id : null;
}

// ---------------------------------------------------------------------------
// Tagging helpers for custom metrics
// ---------------------------------------------------------------------------

/**
 * Create a tag set for a specific test scenario.
 */
export function tags(scenario, status) {
  return {
    scenario,
    status: String(status),
    test_type: __ENV.TEST_TYPE || 'manual',
  };
}
