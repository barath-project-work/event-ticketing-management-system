import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Save, Loader2, Trash2,
  ChevronDown, ChevronUp, Ticket, DollarSign
} from 'lucide-react';
import { eventApi, adminApi } from '../api/client';
import type { EventDetail } from '../api/types';
import LoadingSpinner from '../components/LoadingSpinner';
import { showToast } from '../components/Toast';

export default function AdminManageEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateSeats, setShowCreateSeats] = useState(false);
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Seat form
  const [seatForm, setSeatForm] = useState({
    count: 10,
    tier: 'Standard',
    price: 50,
    section: 'Main',
    rowPrefix: 'A',
    startNumber: 1,
  });

  // Pool form
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
      <div className="text-center py-20">
        <p className="text-gray-500">Event not found</p>
        <Link to="/admin" className="text-primary-600 mt-2 inline-block">← Back to Admin</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Admin
      </Link>

      {/* Event header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{event.venue}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${
              event.status === 'ACTIVE' ? 'badge-green' :
              event.status === 'DRAFT' ? 'badge-gray' : 'badge-blue'
            }`}>{event.status}</span>
            {event.status === 'DRAFT' && (
              <button onClick={handleActivate} disabled={submitting} className="btn-primary text-xs px-3 py-1.5">
                {submitting ? '...' : 'Activate'}
              </button>
            )}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-400">Strategy</span><p className="font-medium">{event.inventoryStrategy}</p></div>
          <div><span className="text-gray-400">Hold Duration</span><p className="font-medium">{event.holdDurationSeconds}s</p></div>
          <div><span className="text-gray-400">Tiers</span><p className="font-medium">{event.tiers.length}</p></div>
          <div><span className="text-gray-400">Date</span><p className="font-medium">{new Date(event.eventDate).toLocaleDateString()}</p></div>
        </div>
      </div>

      {/* Tiers/Pools */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {event.inventoryStrategy === 'PER_SEAT' ? 'Seat Tiers' : 'Inventory Pools'}
          </h2>
          <button
            onClick={() => event.inventoryStrategy === 'PER_SEAT' ? setShowCreateSeats(true) : setShowCreatePool(true)}
            className="btn-primary text-xs px-3 py-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        <div className="p-6">
          {event.tiers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No tiers configured yet</p>
          ) : (
            <div className="grid gap-3">
              {event.tiers.map((tier) => (
                <div key={tier.tier} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{tier.tier}</p>
                    <p className="text-xs text-gray-500">
                      {tier.availableSeats} avail · {tier.heldSeats} held · {tier.reservedSeats} reserved
                    </p>
                  </div>
                  <span className="font-semibold text-primary-600">${tier.price}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Seats Form (PER_SEAT) */}
      {showCreateSeats && (
        <div className="card p-6 border-primary-200">
          <h3 className="font-semibold text-gray-900 mb-4">Create Seats</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Count</label>
              <input type="number" min={1} max={500} className="input-field"
                value={seatForm.count}
                onChange={(e) => setSeatForm({ ...seatForm, count: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tier</label>
              <input type="text" className="input-field" value={seatForm.tier}
                onChange={(e) => setSeatForm({ ...seatForm, tier: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Price ($)</label>
              <input type="number" min={0} step={0.01} className="input-field" value={seatForm.price}
                onChange={(e) => setSeatForm({ ...seatForm, price: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
              <input type="text" className="input-field" value={seatForm.section}
                onChange={(e) => setSeatForm({ ...seatForm, section: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Row Prefix</label>
              <input type="text" className="input-field" value={seatForm.rowPrefix}
                onChange={(e) => setSeatForm({ ...seatForm, rowPrefix: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Number</label>
              <input type="number" min={1} className="input-field" value={seatForm.startNumber}
                onChange={(e) => setSeatForm({ ...seatForm, startNumber: parseInt(e.target.value) || 1 })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreateSeats} disabled={submitting} className="btn-primary text-sm">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Save className="w-4 h-4" /> Create {seatForm.count} Seats</>}
            </button>
            <button onClick={() => setShowCreateSeats(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Create Pool Form (AGGREGATED) */}
      {showCreatePool && (
        <div className="card p-6 border-primary-200">
          <h3 className="font-semibold text-gray-900 mb-4">Create Inventory Pool</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tier Name *</label>
              <input type="text" className="input-field" value={poolForm.tier}
                onChange={(e) => setPoolForm({ ...poolForm, tier: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Total Quantity</label>
              <input type="number" min={1} className="input-field" value={poolForm.totalQuantity}
                onChange={(e) => setPoolForm({ ...poolForm, totalQuantity: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Price ($)</label>
              <input type="number" min={0} step={0.01} className="input-field" value={poolForm.price}
                onChange={(e) => setPoolForm({ ...poolForm, price: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleCreatePool} disabled={submitting} className="btn-primary text-sm">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><Save className="w-4 h-4" /> Create Pool</>}
            </button>
            <button onClick={() => setShowCreatePool(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
