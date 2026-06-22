import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, ArrowLeft, Loader2 } from 'lucide-react';
import { adminApi } from '../api/client';
import type { InventoryStrategy } from '../api/types';
import { showToast } from '../components/Toast';

export default function AdminCreateEvent() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    venue: '',
    eventDate: '',
    description: '',
    inventoryStrategy: 'PER_SEAT' as InventoryStrategy,
    holdDurationSeconds: 180,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.venue || !form.eventDate) {
      showToast('error', 'Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const event = await adminApi.createEvent({
        name: form.name,
        venue: form.venue,
        eventDate: new Date(form.eventDate).toISOString(),
        description: form.description || undefined,
        inventoryStrategy: form.inventoryStrategy,
        holdDurationSeconds: form.holdDurationSeconds,
      });
      showToast('success', `Event "${event.name}" created!`);
      navigate(`/admin/events/${event.id}`);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Admin
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Event</h1>
        <p className="mt-1 text-sm text-gray-500">Set up a new event with inventory strategy</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Name *</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Hamilton - Broadway"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        {/* Venue */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Venue *</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Richard Rodgers Theatre"
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
            required
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Event Date *</label>
          <input
            type="datetime-local"
            className="input-field"
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            className="input-field min-h-[80px]"
            placeholder="Optional event description..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        {/* Strategy */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Inventory Strategy *</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                form.inventoryStrategy === 'PER_SEAT'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setForm({ ...form, inventoryStrategy: 'PER_SEAT' })}
            >
              <p className="font-semibold text-sm">Per-Seat</p>
              <p className="text-xs text-gray-500 mt-1">Assigned seating for theaters & stadiums</p>
            </button>
            <button
              type="button"
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                form.inventoryStrategy === 'AGGREGATED'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setForm({ ...form, inventoryStrategy: 'AGGREGATED' })}
            >
              <p className="font-semibold text-sm">Aggregated</p>
              <p className="text-xs text-gray-500 mt-1">Tier-based GA for festivals</p>
            </button>
          </div>
        </div>

        {/* Hold Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Hold Duration (seconds)
          </label>
          <input
            type="number"
            className="input-field"
            min={30}
            max={600}
            value={form.holdDurationSeconds}
            onChange={(e) => setForm({ ...form, holdDurationSeconds: parseInt(e.target.value) || 180 })}
          />
          <p className="text-xs text-gray-400 mt-1">How long users can hold tickets before release (30-600s)</p>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
            ) : (
              <><Plus className="w-4 h-4" /> Create Event</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
