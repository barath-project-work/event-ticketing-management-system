import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Ticket, Clock, CheckCircle, XCircle, RefreshCw,
  RotateCcw, AlertTriangle, Search, ExternalLink
} from 'lucide-react';
import { eventApi, reservationApi } from '../api/client';
import type { EventSummary, ReservationResponse } from '../api/types';
import LoadingSpinner from '../components/LoadingSpinner';
import { showToast } from '../components/Toast';

const TOKEN_KEY = 'ticketing_user_token';

function getUserToken(): string {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = 'demo-user-' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

// Simulated reservation storage (backend doesn't have a "list my reservations" endpoint)
// We'll use localStorage to track reservation IDs the user has created
function getMyReservationIds(): number[] {
  const stored = localStorage.getItem('my_reservations');
  return stored ? JSON.parse(stored) : [];
}

function addReservationId(id: number) {
  const ids = getMyReservationIds();
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem('my_reservations', JSON.stringify(ids));
  }
}

async function fetchReservationWithRetry(id: number, token: string): Promise<ReservationResponse | null> {
  for (let i = 0; i < 3; i++) {
    try {
      return await reservationApi.get(id, token);
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return null;
}

export default function Reservations() {
  const [token] = useState(getUserToken);
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Load reservations from IDs in localStorage
  const loadReservations = async () => {
    setLoading(true);
    const ids = getMyReservationIds();
    try {
      const [evts] = await Promise.all([
        eventApi.list(),
      ]);
      setEvents(evts);

      if (ids.length === 0) {
        setReservations([]);
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        ids.map((id) => fetchReservationWithRetry(id, token))
      );
      setReservations(results.filter((r): r is ReservationResponse => r !== null));
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReservations();
  }, []);

  const handleConfirm = async (id: number) => {
    setActing(id);
    try {
      const res = await reservationApi.confirm(id, token);
      addReservationId(id);
      showToast('success', `Reservation #${id} confirmed!`);
      loadReservations();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to confirm');
    } finally {
      setActing(null);
    }
  };

  const handleExtend = async (id: number) => {
    setActing(id);
    try {
      const res = await reservationApi.extend(id, token);
      showToast('success', `Hold extended until ${new Date(res.expiresAt).toLocaleTimeString()}`);
      loadReservations();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to extend');
    } finally {
      setActing(null);
    }
  };

  const handleCancel = async (reservation: ReservationResponse) => {
    const id = reservation.id;
    if (!confirm(`Are you sure you want to ${reservation.status === 'CONFIRMED' ? 'refund' : 'cancel'} this reservation?`)) return;
    setActing(id);
    try {
      if (reservation.status === 'CONFIRMED') {
        await reservationApi.refund(id, token);
        showToast('success', 'Reservation refunded! Seat/s released back to inventory');
      } else {
        await reservationApi.cancel(id, token);
        showToast('success', 'Reservation cancelled');
      }
      loadReservations();
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to process');
    } finally {
      setActing(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'HELD': return <span className="badge-yellow">Held</span>;
      case 'CONFIRMED': return <span className="badge-green">Confirmed</span>;
      case 'CANCELLED': return <span className="badge-gray">Cancelled</span>;
      case 'EXPIRED': return <span className="badge-red">Expired</span>;
      default: return <span className="badge-gray">{status}</span>;
    }
  };

  const filtered = filterStatus === 'ALL'
    ? reservations
    : reservations.filter((r) => r.status === filterStatus);

  if (loading) return <LoadingSpinner text="Loading reservations..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Reservations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your ticket holds and confirmations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Token: {token.substring(0, 12)}...</span>
          <button onClick={loadReservations} className="btn-secondary text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'HELD', 'CONFIRMED', 'CANCELLED', 'EXPIRED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterStatus === s
                ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 ring-1 ring-gray-200'
            }`}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No reservations found</p>
          <p className="text-sm text-gray-400 mt-1">
            Browse events and hold tickets to get started
          </p>
          <Link to="/events" className="btn-primary mt-4 inline-flex">
            Browse Events
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((res) => (
            <div key={res.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{res.eventName}</h3>
                    {statusBadge(res.status)}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">Seat</span>
                      <p className="font-medium">{res.seatLabel || res.tier || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Price</span>
                      <p className="font-medium">${res.price || '0'}</p>
                    </div>
                    {res.quantity && (
                      <div>
                        <span className="text-gray-400">Qty</span>
                        <p className="font-medium">{res.quantity}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-400">Expires</span>
                      <p className="font-medium">
                        {res.expiresAt ? new Date(res.expiresAt).toLocaleTimeString() : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 ml-4">
                  {res.status === 'HELD' && (
                    <>
                      <button
                        onClick={() => handleConfirm(res.id)}
                        disabled={acting === res.id}
                        className="btn-success text-xs px-3 py-1.5"
                      >
                        {acting === res.id ? '...' : <><CheckCircle className="w-3.5 h-3.5" /> Confirm</>}
                      </button>
                      {res.extendable && (
                        <button
                          onClick={() => handleExtend(res.id)}
                          disabled={acting === res.id}
                          className="btn-secondary text-xs px-3 py-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Extend
                        </button>
                      )}
                      <button
                        onClick={() => handleCancel(res)}
                        disabled={acting === res.id}
                        className="btn-danger text-xs px-3 py-1.5"
                      >
                        {acting === res.id ? '...' : <><XCircle className="w-3.5 h-3.5" /> Cancel</>}
                      </button>
                    </>
                  )}
                  {res.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleCancel(res)}
                      disabled={acting === res.id}
                      className="btn-danger text-xs px-3 py-1.5"
                    >
                      {acting === res.id ? '...' : <><XCircle className="w-3.5 h-3.5" /> Refund</>}
                    </button>
                  )}
                  <Link
                    to={`/events/${res.eventId}`}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Event
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Export for use by EventDetail to track reservations
export { addReservationId };
