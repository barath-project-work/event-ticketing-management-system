import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Save, RefreshCw,
  Ticket, Users,
  Settings, CalendarRange, Zap
} from 'lucide-react';
import { eventApi, adminApi } from '../api/client';
import type { EventDetail } from '../api/types';
import LoadingSpinner from '../components/LoadingSpinner';
import { showToast } from '../components/Toast';

const eventGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

export default function AdminManageEvent() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateSeats, setShowCreateSeats] = useState(false);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [seatForm, setSeatForm] = useState({
    count: 10,
    tier: 'Standard',
    price: 50,
    section: 'Main',
    rowPrefix: 'A',
    startNumber: 1,
  });

  const [poolForm, setPoolForm] = useState({
    tier: '',
    totalQuantity: 100,
    price: 50,
  });

  useEffect(() => {
    if (!id) return;
    eventApi.get(parseInt(id)).then((data) => {
      setEvent(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleCreateSeats = async () => {
    if (!event || !id) return;
    setSubmitting(true);
    try {
      const seats = Array.from({ length: seatForm.count }, (_, i) => ({
        label: `${seatForm.rowPrefix}${seatForm.startNumber + i}`,
        section: seatForm.section,
        rowName: seatForm.rowPrefix,
        seatNumber: seatForm.startNumber + i,
        tier: seatForm.tier,
        price: seatForm.price,
      }));

      await adminApi.createSeats(parseInt(id), { seats });
      showToast('success', `${seatForm.count} seats created!`);
      setShowCreateSeats(false);
      setEvent(await eventApi.get(parseInt(id)));
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create seats');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePool = async () => {
    if (!event || !id) return;
    if (!poolForm.tier) {
      showToast('error', 'Tier name is required');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.createPool(parseInt(id), {
        tier: poolForm.tier,
        totalQuantity: poolForm.totalQuantity,
        price: poolForm.price,
      });
      showToast('success', `Pool "${poolForm.tier}" created!`);
      setShowCreatePool(false);
      setEvent(await eventApi.get(parseInt(id)));
      setPoolForm({ tier: '', totalQuantity: 100, price: 50 });
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create pool');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async () => {
    if (!event || !id) return;
    setSubmitting(true);
    try {
      await adminApi.updateStatus(parseInt(id), { status: 'ACTIVE' });
      showToast('success', 'Event activated!');
      setEvent(await eventApi.get(parseInt(id)));
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to activate');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading event..." />;
  if (!event) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-[#f0f0ee] flex items-center justify-center mx-auto mb-4">
          <Settings className="w-8 h-8 text-[#d1d1cf]" />
        </div>
        <p className="text-[#2D2D2D] font-bold text-lg">Event not found</p>
        <Link to="/admin" className="btn-zomato-ghost mt-3 inline-flex">← Back to Admin</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Back */}
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6b6b68] hover:text-[#CB202D] transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Admin
      </Link>

      {/* Hero Banner */}
      <div
        className="h-36 sm:h-44 rounded-[16px] relative overflow-hidden"
        style={{ background: eventGradient }}
      >
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-white ${
              event.status === 'ACTIVE' ? 'bg-emerald-500/90' :
              event.status === 'DRAFT' ? 'bg-amber-500/90' :
              'bg-white/20 backdrop-blur-sm'
            }`}>
              {event.status}
            </span>
            {event.status === 'DRAFT' && (
              <button
                onClick={handleActivate}
                disabled={submitting}
                className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-bold hover:bg-white/30 transition-all duration-200"
              >
                {submitting ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : <Zap className="w-3 h-3 inline" />}
                {' '}Activate
              </button>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">{event.name}</h1>
        </div>
      </div>

      {/* Event Info Bar */}
      <div className="card-zomato p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-[10px] text-[#b0b0ae] font-semibold uppercase tracking-wider">Strategy</p>
            <p className="font-bold text-[#2D2D2D] mt-0.5">
              {event.inventoryStrategy === 'PER_SEAT' ? 'Per-Seat' : 'Aggregated'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#b0b0ae] font-semibold uppercase tracking-wider">Hold Duration</p>
            <p className="font-bold text-[#2D2D2D] mt-0.5">{event.holdDurationSeconds}s</p>
          </div>
          <div>
            <p className="text-[10px] text-[#b0b0ae] font-semibold uppercase tracking-wider">Tiers</p>
            <p className="font-bold text-[#2D2D2D] mt-0.5">{event.tiers.length}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#b0b0ae] font-semibold uppercase tracking-wider">Date</p>
            <p className="font-bold text-[#2D2D2D] mt-0.5">
              {new Date(event.eventDate).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Tiers/Pools Section */}
      <div className="card-zomato overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f0f0ee] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-[#CB202D]" />
            <h2 className="text-base font-bold text-[#2D2D2D]">
              {event.inventoryStrategy === 'PER_SEAT' ? 'Seat Tiers' : 'Inventory Pools'}
            </h2>
          </div>
          <button
            onClick={() => event.inventoryStrategy === 'PER_SEAT' ? setShowCreateSeats(true) : setShowCreatePool(true)}
            className="btn-zomato text-xs px-3 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        <div className="p-5">
          {event.tiers.length === 0 ? (
            <div className="text-center py-8">
              <Ticket className="w-10 h-10 text-[#d1d1cf] mx-auto mb-2" />
              <p className="text-sm text-[#b0b0ae] font-medium">No tiers configured yet</p>
              <p className="text-xs text-[#d1d1cf] mt-0.5">
                {event.inventoryStrategy === 'PER_SEAT'
                  ? 'Add seats with the button above'
                  : 'Create an inventory pool to start selling tickets'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {event.tiers.map((tier) => (
                <div key={tier.tier} className="flex items-center justify-between p-4 rounded-[10px] bg-[#fafaf8] hover:bg-[#f0f0ee] transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#2D2D2D]">{tier.tier}</p>
                      <span className="text-lg font-extrabold text-[#CB202D]">${tier.price}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[#6b6b68]">
                      <span className="text-emerald-600 font-semibold">{tier.availableSeats} avail</span>
                      <span className="text-amber-600">{tier.heldSeats} held</span>
                      <span className="text-blue-600">{tier.reservedSeats} reserved</span>
                    </div>
                  </div>
                  <div className="w-24">
                    <div className="h-1.5 rounded-full bg-[#e5e5e3] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#CB202D]"
                        style={{
                          width: `${tier.totalSeats > 0
                            ? ((tier.totalSeats - tier.availableSeats) / tier.totalSeats) * 100
                            : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-[#b0b0ae] text-right mt-0.5">{tier.totalSeats} total</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Seats Form (PER_SEAT) */}
      {showCreateSeats && (
        <div className="card-zomato p-5 sm:p-6 border-l-4 border-l-[#CB202D] animate-slide-up">
          <h3 className="font-bold text-[#2D2D2D] mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#CB202D]" />
            Create Seats
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#6b6b68] mb-1 uppercase tracking-wider">Count</label>
              <input type="number" min={1} max={500} className="input-zomato"
                value={seatForm.count}
                onChange={(e) => setSeatForm({ ...seatForm, count: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b68] mb-1 uppercase tracking-wider">Tier</label>
              <input type="text" className="input-zomato" value={seatForm.tier}
                onChange={(e) => setSeatForm({ ...seatForm, tier: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b68] mb-1 uppercase tracking-wider">Price ($)</label>
              <input type="number" min={0} step={0.01} className="input-zomato" value={seatForm.price}
                onChange={(e) => setSeatForm({ ...seatForm, price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b68] mb-1 uppercase tracking-wider">Section</label>
              <input type="text" className="input-zomato" value={seatForm.section}
                onChange={(e) => setSeatForm({ ...seatForm, section: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b68] mb-1 uppercase tracking-wider">Row Prefix</label>
              <input type="text" className="input-zomato" value={seatForm.rowPrefix}
                onChange={(e) => setSeatForm({ ...seatForm, rowPrefix: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b68] mb-1 uppercase tracking-wider">Start Number</label>
              <input type="number" min={1} className="input-zomato" value={seatForm.startNumber}
                onChange={(e) => setSeatForm({ ...seatForm, startNumber: parseInt(e.target.value) || 1 })} />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleCreateSeats} disabled={submitting} className="btn-zomato text-sm">
              {submitting
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</>
                : <><Save className="w-4 h-4" /> Create {seatForm.count} Seats</>}
            </button>
            <button onClick={() => setShowCreateSeats(false)} className="btn-zomato-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Create Pool Form (AGGREGATED) */}
      {showCreatePool && (
        <div className="card-zomato p-5 sm:p-6 border-l-4 border-l-emerald-500 animate-slide-up">
          <h3 className="font-bold text-[#2D2D2D] mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-500" />
            Create Inventory Pool
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#6b6b68] mb-1 uppercase tracking-wider">Tier Name *</label>
              <input type="text" className="input-zomato" placeholder="VIP, General, etc." value={poolForm.tier}
                onChange={(e) => setPoolForm({ ...poolForm, tier: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b68] mb-1 uppercase tracking-wider">Total Quantity</label>
              <input type="number" min={1} className="input-zomato" value={poolForm.totalQuantity}
                onChange={(e) => setPoolForm({ ...poolForm, totalQuantity: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#6b6b68] mb-1 uppercase tracking-wider">Price ($)</label>
              <input type="number" min={0} step={0.01} className="input-zomato" value={poolForm.price}
                onChange={(e) => setPoolForm({ ...poolForm, price: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={handleCreatePool} disabled={submitting} className="btn-zomato text-sm">
              {submitting
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</>
                : <><Save className="w-4 h-4" /> Create Pool</>}
            </button>
            <button onClick={() => setShowCreatePool(false)} className="btn-zomato-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
