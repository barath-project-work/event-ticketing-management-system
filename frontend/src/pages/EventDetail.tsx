import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CalendarRange, MapPin, Clock, Users,
  Ticket, Shield, ArrowLeft, ChevronDown, ChevronUp,
  Star, CheckCircle, RefreshCw
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

const eventGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

export default function EventDetailPage() {
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
        const res = await reservationApi.hold({
          eventId: event.id,
          tier: selectedTier || undefined,
          quantity,
          token,
        });
        showToast('success', `${quantity} ticket(s) held for ${selectedTier}!`);
        addReservationId(res.id);
      }
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
      <div className="text-center py-20 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-[#f0f0ee] flex items-center justify-center mx-auto mb-4">
          <CalendarRange className="w-8 h-8 text-[#d1d1cf]" />
        </div>
        <p className="text-[#2D2D2D] font-bold text-lg">Event not found</p>
        <Link to="/events" className="btn-zomato-ghost mt-3 inline-flex">← Back to events</Link>
      </div>
    );
  }

  const availSeats = seats.filter((s) => s.status === 'AVAILABLE').length;
  const minPrice = event.tiers.length > 0
    ? Math.min(...event.tiers.map((t) => t.price))
    : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Back button */}
      <Link to="/events" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6b6b68] hover:text-[#CB202D] transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Events
      </Link>

      {/* Hero image banner */}
      <div
        className="h-48 sm:h-56 lg:h-64 rounded-[16px] relative overflow-hidden"
        style={{ background: eventGradient }}
      >
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
              event.status === 'ACTIVE' ? 'bg-emerald-500/90 text-white' :
              event.status === 'SOLD_OUT' ? 'bg-rose-500/90 text-white' :
              'bg-white/20 text-white backdrop-blur-sm'
            }`}>
              {event.status === 'SOLD_OUT' ? 'Sold Out' :
               event.status.charAt(0) + event.status.slice(1).toLowerCase()}
            </span>
            {minPrice > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-bold">
                From ${minPrice}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
            {event.name}
          </h1>
        </div>
      </div>

      {/* Event Info Row - Zomato restaurant detail style */}
      <div className="card-zomato p-5 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-[#CB202D]/10">
              <MapPin className="w-4 h-4 text-[#CB202D]" />
            </div>
            <div>
              <p className="text-xs text-[#b0b0ae] font-medium uppercase tracking-wider">Venue</p>
              <p className="text-sm font-bold text-[#2D2D2D]">{event.venue}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-blue-50">
              <CalendarRange className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[#b0b0ae] font-medium uppercase tracking-wider">Date</p>
              <p className="text-sm font-bold text-[#2D2D2D]">
                {new Date(event.eventDate).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-amber-50">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-[#b0b0ae] font-medium uppercase tracking-wider">Hold Duration</p>
              <p className="text-sm font-bold text-[#2D2D2D]">{event.holdDurationSeconds}s</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[10px] bg-emerald-50">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-[#b0b0ae] font-medium uppercase tracking-wider">Seating</p>
              <p className="text-sm font-bold text-[#2D2D2D]">
                {event.inventoryStrategy === 'PER_SEAT' ? 'Assigned' : 'General Admission'}
              </p>
            </div>
          </div>
        </div>

        {event.description && (
          <p className="mt-5 pt-4 border-t border-[#f0f0ee] text-sm text-[#6b6b68] leading-relaxed">
            {event.description}
          </p>
        )}
      </div>

      {/* Tickets & Pricing - Zomato style tier cards */}
      <div className="card-zomato overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f0f0ee] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-[#CB202D]" />
            <h2 className="text-base font-bold text-[#2D2D2D]">Tickets & Pricing</h2>
          </div>
          {event.inventoryStrategy === 'AGGREGATED' && selectedTier && (
            <span className="text-xs text-[#b0b0ae]">
              {event.tiers.find(t => t.tier === selectedTier)?.availableSeats ?? 0} available
            </span>
          )}
        </div>
        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {event.tiers.map((tier) => (
              <div
                key={tier.tier}
                className={`rounded-[12px] border-2 p-4 cursor-pointer transition-all duration-200 tilt-3d-inner ${
                  selectedTier === tier.tier
                    ? 'border-[#CB202D] bg-[#CB202D]/5 shadow-zomato-hover'
                    : 'border-[#f0f0ee] bg-white hover:border-[#d1d1cf] hover:shadow-zomato'
                }`}
                onClick={() => { setSelectedTier(tier.tier); setQuantity(1); }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-[#2D2D2D]">{tier.tier}</h3>
                    <p className="text-xs text-[#b0b0ae] mt-0.5">
                      {tier.availableSeats} of {tier.totalSeats} left
                    </p>
                  </div>
                  <span className="text-lg font-extrabold text-[#CB202D]">${tier.price}</span>
                </div>

                {/* Progress bar for availability */}
                <div className="w-full h-1.5 rounded-full bg-[#f0f0ee] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#CB202D] transition-all duration-500"
                    style={{
                      width: `${tier.totalSeats > 0 ? ((tier.totalSeats - tier.availableSeats) / tier.totalSeats) * 100 : 0}%`,
                    }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-1.5 rounded-[6px] bg-emerald-50">
                    <p className="font-bold text-emerald-700">{tier.availableSeats}</p>
                    <p className="text-[10px] text-emerald-600">Available</p>
                  </div>
                  <div className="p-1.5 rounded-[6px] bg-amber-50">
                    <p className="font-bold text-amber-700">{tier.heldSeats}</p>
                    <p className="text-[10px] text-amber-600">Held</p>
                  </div>
                  <div className="p-1.5 rounded-[6px] bg-blue-50">
                    <p className="font-bold text-blue-700">{tier.reservedSeats}</p>
                    <p className="text-[10px] text-blue-600">Reserved</p>
                  </div>
                </div>

                {selectedTier === tier.tier && (
                  <div className="mt-2 flex justify-center">
                    <CheckCircle className="w-4 h-4 text-[#CB202D]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hold/Action Section - Zomato style sticky action bar */}
      {event.status === 'ACTIVE' && (
        <div className="card-zomato p-5 sm:p-6 sticky bottom-4 z-30 bg-white/95 backdrop-blur-sm border border-[#f0f0ee]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-bold text-[#2D2D2D]">
                {event.inventoryStrategy === 'PER_SEAT'
                  ? `${availSeats} seat${availSeats !== 1 ? 's' : ''} available`
                  : `Tickets available for ${selectedTier || 'selected tier'}`
                }
              </p>
              <p className="text-xs text-[#b0b0ae] mt-0.5">
                Hold now, confirm within {event.holdDurationSeconds}s
              </p>
            </div>

            {event.inventoryStrategy === 'AGGREGATED' && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-[#6b6b68]">Qty:</label>
                <div className="flex items-center border border-[#d1d1cf] rounded-[8px] overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-1.5 text-[#6b6b68] hover:bg-[#f0f0ee] transition-colors font-bold"
                  >−</button>
                  <span className="px-4 py-1.5 text-sm font-bold text-[#2D2D2D] min-w-[2.5rem] text-center border-x border-[#f0f0ee]">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-1.5 text-[#6b6b68] hover:bg-[#f0f0ee] transition-colors font-bold"
                  >+</button>
                </div>
              </div>
            )}

            <button
              onClick={handleHold}
              disabled={acting}
              className="btn-zomato text-base px-8 py-3"
            >
              {acting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                <><Ticket className="w-4 h-4" /> Hold {event.inventoryStrategy === 'AGGREGATED' && `(${quantity})`} Tickets</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Seat Grid (for PER_SEAT) - Zomato style */}
      {event.inventoryStrategy === 'PER_SEAT' && seats.length > 0 && (
        <div className="card-zomato overflow-hidden">
          <button
            onClick={() => setShowAllSeats(!showAllSeats)}
            className="w-full px-6 py-4 flex items-center justify-between border-b border-[#f0f0ee] hover:bg-[#fafaf8] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#CB202D]" />
              <h2 className="text-base font-bold text-[#2D2D2D]">
                Seat Map ({seats.length})
              </h2>
              <span className="badge-zomato-green text-[11px]">{availSeats} available</span>
            </div>
            {showAllSeats ? <ChevronUp className="w-4 h-4 text-[#b0b0ae]" /> : <ChevronDown className="w-4 h-4 text-[#b0b0ae]" />}
          </button>
          {showAllSeats && (
            <div className="p-6 animate-slide-up">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {seats.map((seat) => (
                  <div
                    key={seat.id}
                    className={`p-2 rounded-[8px] text-center text-xs font-bold transition-all duration-200 ${
                      seat.status === 'AVAILABLE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:scale-105 cursor-default'
                        : seat.status === 'HELD'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-gray-50 text-gray-400 border border-gray-100'
                    }`}
                    title={`${seat.label} - ${seat.tier} - $${seat.price}`}
                  >
                    {seat.label}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs text-[#6b6b68]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-[4px] bg-emerald-50 border border-emerald-200" /> Available
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-[4px] bg-amber-50 border border-amber-200" /> Held
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-[4px] bg-gray-50 border border-gray-100" /> Reserved
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
