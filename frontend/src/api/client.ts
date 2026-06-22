import type {
  EventSummary,
  EventDetail,
  Seat,
  ReservationResponse,
  HoldSeatRequest,
  BulkHoldRequest,
  CreateEventRequest,
  CreateSeatRequest,
  CreatePoolRequest,
  StatusUpdateRequest,
  HealthResponse,
} from './types';

const BASE_URL = import.meta.env.DEV ? '' : '';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    let message: string;
    try {
      const json = JSON.parse(body);
      message = json.message || json.error || body;
    } catch {
      message = body || `HTTP ${res.status}`;
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- Events ----

export const eventApi = {
  list: (status?: string) =>
    api<EventSummary[]>(`/api/events${status ? `?status=${status}` : ''}`),

  get: (id: number) => api<EventDetail>(`/api/events/${id}`),

  seats: (id: number, params?: { tier?: string; section?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.tier) q.set('tier', params.tier);
    if (params?.section) q.set('section', params.section);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return api<Seat[]>(`/api/events/${id}/seats${qs ? `?${qs}` : ''}`);
  },
};

// ---- Reservations ----

export const reservationApi = {
  hold: (req: HoldSeatRequest) =>
    api<ReservationResponse>('/api/reservations/hold', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  bulkHold: (req: BulkHoldRequest) =>
    api<ReservationResponse[]>('/api/reservations/hold/bulk', {
      method: 'POST',
      body: JSON.stringify(req),
    }),

  confirm: (id: number, token: string) =>
    api<ReservationResponse>(`/api/reservations/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  cancel: (id: number, token: string) =>
    api<ReservationResponse>(`/api/reservations/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  refund: (id: number, token: string) =>
    api<ReservationResponse>(`/api/reservations/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  extend: (id: number, token: string) =>
    api<ReservationResponse>(`/api/reservations/${id}/extend`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  get: (id: number, token: string) =>
    api<ReservationResponse>(`/api/reservations/${id}?token=${encodeURIComponent(token)}`),

  waitingPosition: (eventId: number, tier: string, token: string) =>
    api<{ position: number }>(
      `/api/reservations/waiting-queue?eventId=${eventId}&tier=${encodeURIComponent(tier)}&token=${encodeURIComponent(token)}`
    ),
};

// ---- Admin ----

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || 'admin-token-001';

export const adminApi = {
  createEvent: (req: CreateEventRequest) =>
    api<EventDetail>('/api/admin/events', {
      method: 'POST',
      body: JSON.stringify(req),
      headers: { 'X-Admin-Token': ADMIN_TOKEN },
    }),

  createSeats: (eventId: number, req: CreateSeatRequest) =>
    api<Seat[]>('/api/admin/events/' + eventId + '/seats', {
      method: 'POST',
      body: JSON.stringify(req),
      headers: { 'X-Admin-Token': ADMIN_TOKEN },
    }),

  createPool: (eventId: number, req: CreatePoolRequest) =>
    api<unknown>('/api/admin/events/' + eventId + '/pools', {
      method: 'POST',
      body: JSON.stringify(req),
      headers: { 'X-Admin-Token': ADMIN_TOKEN },
    }),

  updateStatus: (eventId: number, req: StatusUpdateRequest) =>
    api<EventDetail>('/api/admin/events/' + eventId + '/status', {
      method: 'PUT',
      body: JSON.stringify(req),
      headers: { 'X-Admin-Token': ADMIN_TOKEN },
    }),
};

// ---- Health ----

export const healthApi = {
  check: () => api<HealthResponse>('/actuator/health'),
};
