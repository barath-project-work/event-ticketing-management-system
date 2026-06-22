import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CalendarRange, MapPin, Clock, Users, DollarSign,
  Ticket, Shield, ArrowLeft, CreditCard, ChevronDown, ChevronUp
} from 'lucide-react';
import { eventApi, reservationApi } from '../api/client';
import type { EventDetail, Seat } from '../api/types';
import LoadingSpinner from '../components/LoadingSpinner';
import { showToast } from '../components/Toast';
import { addReservationId } from './Reservations';

const TOKEN_KEY = 'ticketing_user_token';

function getUserToken(): string {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = 'demo-user-' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [acting, setActing] = useState(false);
  const [showAllSeats, setShowAllSeats] = useState(false);
  const [token] = useState(getUserToken);

  useEffect(() => {
    if (!id) return;
    const eventId = parseInt(id);
    Promise.all([
      eventApi.get(eventId),
      eventApi.seats(eventId),
    ]).then(([evt, seatsData]) => {
      setEvent(evt);
      setSeats(seatsData);
      if (evt.tiers.length > 0) setSelectedTier(evt.tiers[0].tier);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleHold = async () => {
    if (!event || !id) return;
    setActing(true);
    try {
      if (event.inventoryStrategy === 'PER_SEAT') {
        // Find an available seat
        const availSeat = seats.find((s) => s.status === 'AVAILABLE');
        if (!availSeat) {
          showToast('error', 'No available seats found');
          setActing(false);
          return;
        }
        const res = await reservationApi.hold({
          eventId: event.id,
          seatId: availSeat.id,
          token,
        });
        showToast('success', `Seat ${availSeat.label} held! Expires: ${new Date(res.expiresAt).toLocaleTimeString()}`);
        addReservationId(res.id);
      } else {
        // Aggregated hold
        const res = await reservationApi.hold({
          eventId: event.id,
          tier: selectedTier || undefined,
          quantity,
          token,
        });
        showToast('success', `${quantity} ticket(s) held for ${selectedTier}!`);
        addReservationId(res.id);
      }
      // Refresh
      const [evt, seatsData] = await Promise.all([
        eventApi.get(parseInt(id!)),
        eventApi.seats(parseInt(id!)),
      ]);
      setEvent(evt);
      setSeats(seatsData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to hold';
      showToast('error', message);
    } finally {
      setActing(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading event details..." />;
  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Event not found</p>
        <Link to="/events" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">← Back to events</Link>
      </div>
    );
  }

  const availSeats = seats.filter((s) => s.status === 'AVAILABLE').length;
  const minPrice = event.tiers.length > 0
    ? Math.min(...event.tiers.map((t) => t.price))
    : 0;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link to="/events" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Events
      </Link>

      {/* Event Header */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="w-4 h-4" /> {event.venue}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CalendarRange className="w-4 h-4" />
                {new Date(event.eventDate).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
                })}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" /> Hold duration: {event.holdDurationSeconds}s
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Users className="w-4 h-4" /> {event.inventoryStrategy === 'PER_SEAT' ? 'Assigned Seating' : 'General Admission'}
              </div>
            </div>
            {event.description && (
              <p className="mt-4 text-sm text-gray-600 max-w-2xl">{event.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className={`badge text-sm px-3 py-1 ${
              event.status === 'ACTIVE' ? 'badge-green' :
              event.status === 'SOLD_OUT' ? 'badge-red' : 'badge-gray'
            }`}>{event.status}</span>
          </div>
        </div>
      </div>

      {/* Tier Breakdown */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Tickets & Pricing</h2>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {event.tiers.map((tier) => (
              <div
                key={tier.tier}
                className={`rounded-lg border-2 p-4 cursor-pointer transition-all duration-200 ${
                  selectedTier === tier.tier
                    ? 'border-primary-500 bg-primary-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
                onClick={() => { setSelectedTier(tier.tier); setQuantity(1); }}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{tier.tier}</h3>
                  <span className="text-lg font-bold text-primary-600">${tier.price}</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Available</span>
                    <span className="font-medium text-emerald-600">{tier.availableSeats}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Held</span>
                    <span className="font-medium text-amber-600">{tier.heldSeats}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reserved</span>
                    <span className="font-medium text-blue-600">{tier.reservedSeats}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hold/Action Button */}
      {event.status === 'ACTIVE' && (
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-500">
                {event.inventoryStrategy === 'PER_SEAT'
                  ? `${availSeats} seat(s) available`
                  : `Tickets available for ${selectedTier || 'selected tier'}`
                }
              </p>
            </div>

            {event.inventoryStrategy === 'AGGREGATED' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Qty:</label>
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-2.5 py-1.5 text-gray-600 hover:bg-gray-50"
                  >−</button>
                  <span className="px-3 py-1.5 text-sm font-medium min-w-[2rem] text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-2.5 py-1.5 text-gray-600 hover:bg-gray-50"
                  >+</button>
                </div>
              </div>
            )}

            <button onClick={handleHold} disabled={acting} className="btn-primary">
              {acting ? 'Processing...' : <><Ticket className="w-4 h-4" /> Hold Tickets</>}
            </button>
          </div>
        </div>
      )}

      {/* Seats List (for PER_SEAT) */}
      {event.inventoryStrategy === 'PER_SEAT' && seats.length > 0 && (
        <div className="card">
          <button
            onClick={() => setShowAllSeats(!showAllSeats)}
            className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-200 hover:bg-gray-50"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              Seats ({seats.length})
            </h2>
            {showAllSeats ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showAllSeats && (
            <div className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {seats.map((seat) => (
                  <div
                    key={seat.id}
                    className={`p-2 rounded text-center text-xs font-medium ${
                      seat.status === 'AVAILABLE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : seat.status === 'HELD'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }`}
                    title={`${seat.label} - ${seat.tier} - $${seat.price}`}
                  >
                    {seat.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
