import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Ticket, Clock, CheckCircle, XCircle, RefreshCw,
  RotateCcw, ExternalLink, Search
} from 'lucide-react';
import { reservationApi } from '../api/client';
import type { ReservationResponse } from '../api/types';
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

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  HELD: { label: 'Held', className: 'badge-zomato-yellow', icon: Clock },
  CONFIRMED: { label: 'Confirmed', className: 'badge-zomato-green', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', className: 'badge-zomato-gray', icon: XCircle },
  EXPIRED: { label: 'Expired', className: 'badge-zomato-red', icon: Clock },
};

export default function Reservations() {
  const [token] = useState(getUserToken);
  const [reservations, setReservations] = useState<ReservationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadReservations = async () => {
    setLoading(true);
    const ids = getMyReservationIds();
    try {
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
      await reservationApi.confirm(id, token);
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

  const filtered = reservations.filter((r) => {
    const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
    const matchesSearch = searchQuery === '' ||
      r.eventName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.seatLabel && r.seatLabel.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  if (loading) return <LoadingSpinner text="Loading reservations..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2D2D2D] tracking-tight">My Reservations</h1>
          <p className="mt-1 text-sm text-[#6b6b68]">Manage your ticket holds and confirmations</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#b0b0ae] bg-[#f0f0ee] px-2.5 py-1 rounded-full font-mono">
            {token.substring(0, 10)}...
          </span>
          <button onClick={loadReservations} className="btn-zomato-ghost text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="card-zomato p-1.5">
        <div className="flex flex-col sm:flex-row gap-1.5">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b0b0ae]" />
            <input
              type="text"
              placeholder="Search by event or seat..."
              className="input-zomato-search pl-11"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'HELD', 'CONFIRMED', 'CANCELLED', 'EXPIRED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
              filterStatus === s
                ? 'bg-[#CB202D] text-white shadow-sm'
                : 'bg-[#f0f0ee] text-[#6b6b68] hover:bg-[#e5e5e3]'
            }`}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            {s !== 'ALL' && (
              <span className="ml-1.5 opacity-70">({reservations.filter(r => r.status === s).length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Reservation cards */}
      {filtered.length === 0 ? (
        <div className="card-zomato p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#f0f0ee] flex items-center justify-center mx-auto mb-4">
            <Ticket className="w-8 h-8 text-[#d1d1cf]" />
          </div>
          <p className="text-[#2D2D2D] font-bold text-lg">No reservations found</p>
          <p className="text-sm text-[#b0b0ae] mt-1">
            Browse events and hold tickets to get started
          </p>
          <Link to="/events" className="btn-zomato mt-4 inline-flex">
            Browse Events
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((res) => {
            const statusInfo = statusConfig[res.status] || statusConfig.CANCELLED;
            const StatusIcon = statusInfo.icon;
            return (
              <div key={res.id} className="card-zomato overflow-hidden hover:shadow-zomato-hover transition-all duration-200 group">
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Left - Event initial */}
                    <div className="hidden sm:flex w-14 h-14 rounded-[10px] bg-gradient-to-br from-[#CB202D] to-[#a31a24] items-center justify-center text-white font-extrabold text-xl shrink-0 shadow-sm">
                      {res.eventName.charAt(0)}
                    </div>

                    {/* Middle - Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                        <h3 className="font-bold text-[#2D2D2D] text-base truncate group-hover:text-[#CB202D] transition-colors">
                          {res.eventName}
                        </h3>
                        <span className={statusInfo.className}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div className="p-2.5 rounded-[8px] bg-[#fafaf8]">
                          <p className="text-[10px] text-[#b0b0ae] font-semibold uppercase tracking-wider">Seat</p>
                          <p className="font-bold text-[#2D2D2D] text-sm">{res.seatLabel || res.tier || '—'}</p>
                        </div>
                        <div className="p-2.5 rounded-[8px] bg-[#fafaf8]">
                          <p className="text-[10px] text-[#b0b0ae] font-semibold uppercase tracking-wider">Price</p>
                          <p className="font-bold text-[#2D2D2D] text-sm">${res.price || '0'}</p>
                        </div>
                        {res.quantity && (
                          <div className="p-2.5 rounded-[8px] bg-[#fafaf8]">
                            <p className="text-[10px] text-[#b0b0ae] font-semibold uppercase tracking-wider">Qty</p>
                            <p className="font-bold text-[#2D2D2D] text-sm">{res.quantity}</p>
                          </div>
                        )}
                        <div className="p-2.5 rounded-[8px] bg-[#fafaf8]">
                          <p className="text-[10px] text-[#b0b0ae] font-semibold uppercase tracking-wider">Expires</p>
                          <p className="font-bold text-[#2D2D2D] text-sm">
                            {res.expiresAt ? new Date(res.expiresAt).toLocaleTimeString() : '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right - Actions */}
                    <div className="flex sm:flex-col gap-2 sm:min-w-[100px]">
                      {res.status === 'HELD' && (
                        <>
                          <button
                            onClick={() => handleConfirm(res.id)}
                            disabled={acting === res.id}
                            className="btn-zomato text-xs px-3 py-2"
                          >
                            {acting === res.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <><CheckCircle className="w-3 h-3" /> Confirm</>
                            )}
                          </button>
                          <div className="flex gap-2 sm:flex-col">
                            {res.extendable && (
                              <button
                                onClick={() => handleExtend(res.id)}
                                disabled={acting === res.id}
                                className="btn-zomato-outline text-xs px-3 py-2"
                              >
                                <RotateCcw className="w-3 h-3" /> Extend
                              </button>
                            )}
                            <button
                              onClick={() => handleCancel(res)}
                              disabled={acting === res.id}
                              className="btn-zomato-ghost text-xs px-3 py-2 text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="w-3 h-3" /> Cancel
                            </button>
                          </div>
                        </>
                      )}
                      {res.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleCancel(res)}
                          disabled={acting === res.id}
                          className="btn-zomato-ghost text-xs px-3 py-2 text-red-600 hover:bg-red-50"
                        >
                          {acting === res.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <><XCircle className="w-3 h-3" /> Refund</>
                          )}
                        </button>
                      )}
                      <Link
                        to={`/events/${res.eventId}`}
                        className="btn-zomato-ghost text-xs px-3 py-2"
                      >
                        <ExternalLink className="w-3 h-3" /> Event
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Expiry bar for HELD */}
                {res.status === 'HELD' && res.expiresAt && (
                  <div className="h-1 bg-[#f0f0ee]">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 animate-pulse-slow"
                      style={{
                        width: `${Math.max(0, Math.min(100,
                          ((new Date(res.expiresAt).getTime() - Date.now()) / (180 * 1000)) * 100
                        ))}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { addReservationId };
