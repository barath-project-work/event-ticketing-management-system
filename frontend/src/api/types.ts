// ------- Enums -------

export type EventStatus = 'DRAFT' | 'ACTIVE' | 'SOLD_OUT' | 'CANCELLED' | 'COMPLETED';
export type SeatStatus = 'AVAILABLE' | 'HELD' | 'RESERVED';
export type ReservationStatus = 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
export type InventoryStrategy = 'PER_SEAT' | 'AGGREGATED';

// ------- Event -------

export interface EventSummary {
  id: number;
  name: string;
  venue: string;
  eventDate: string;
  status: EventStatus;
  inventoryStrategy: InventoryStrategy;
}

export interface TierInfo {
  tier: string;
  totalSeats: number;
  availableSeats: number;
  heldSeats: number;
  reservedSeats: number;
  price: number;
}

export interface EventDetail extends EventSummary {
  description: string | null;
  holdDurationSeconds: number;
  tiers: TierInfo[];
  totalSeats: number;
  availableSeats: number;
  heldSeats: number;
  reservedSeats: number;
}

// ------- Seat -------

export interface Seat {
  id: number;
  label: string;
  section: string | null;
  rowName: string | null;
  seatNumber: number | null;
  tier: string;
  price: string;
  status: SeatStatus;
}

// ------- Reservation -------

export interface ReservationResponse {
  id: number;
  eventId: number;
  eventName: string;
  venue: string;
  eventDate: string;
  userId: number;
  userEmail: string;
  status: ReservationStatus;
  heldAt: string;
  expiresAt: string;
  confirmedAt: string | null;
  extendable: boolean;
  seatId: number | null;
  seatLabel: string | null;
  section: string | null;
  rowName: string | null;
  seatNumber: number | null;
  tier: string | null;
  price: string | null;
  quantity: number | null;
  waitingPosition: number | null;
}

// ------- Requests -------

export interface HoldSeatRequest {
  eventId: number;
  seatId?: number;
  tier?: string;
  quantity?: number;
  token: string;
}

export interface BulkHoldRequest {
  eventId: number;
  entries: { seatId?: number; tier?: string; quantity?: number }[];
  token: string;
}

export interface ConfirmRequest {
  token: string;
}

// ------- Admin -------

export interface CreateEventRequest {
  name: string;
  venue: string;
  eventDate: string;
  description?: string;
  inventoryStrategy: InventoryStrategy;
  holdDurationSeconds: number;
}

export interface CreateSeatEntry {
  label: string;
  section?: string;
  rowName?: string;
  seatNumber?: number;
  tier: string;
  price: number;
}

export interface CreateSeatRequest {
  seats: CreateSeatEntry[];
}

export interface CreatePoolRequest {
  tier: string;
  totalQuantity: number;
  price: number;
}

export interface StatusUpdateRequest {
  status: EventStatus;
}

// ------- Health -------

export interface HealthResponse {
  status: string;
  components?: Record<string, { status: string; details?: Record<string, unknown> }>;
}
