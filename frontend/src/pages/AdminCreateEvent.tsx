import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, ArrowLeft, RefreshCw, CalendarRange, Users, Clock } from 'lucide-react';
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
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Back */}
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6b6b68] hover:text-[#CB202D] transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Admin
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarRange className="w-5 h-5 text-[#CB202D]" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2D2D2D] tracking-tight">Create Event</h1>
        </div>
        <p className="text-sm text-[#6b6b68]">Set up a new event with inventory strategy</p>
      </div>

      <form onSubmit={handleSubmit} className="card-zomato p-6 sm:p-8 space-y-6">
        {/* Event Name */}
        <div>
          <label className="block text-sm font-bold text-[#2D2D2D] mb-1.5">Event Name *</label>
          <input
            type="text"
            className="input-zomato"
            placeholder="e.g. Hamilton - Broadway"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        {/* Venue */}
        <div>
          <label className="block text-sm font-bold text-[#2D2D2D] mb-1.5">Venue *</label>
          <input
            type="text"
            className="input-zomato"
            placeholder="e.g. Richard Rodgers Theatre"
            value={form.venue}
            onChange={(e) => setForm({ ...form, venue: e.target.value })}
            required
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-bold text-[#2D2D2D] mb-1.5">Event Date *</label>
          <input
            type="datetime-local"
            className="input-zomato"
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-bold text-[#2D2D2D] mb-1.5">Description</label>
          <textarea
            className="input-zomato min-h-[100px] resize-y"
            placeholder="Optional event description..."
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        {/* Strategy Selection - Zomato card selector */}
        <div>
          <label className="block text-sm font-bold text-[#2D2D2D] mb-2">Inventory Strategy *</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`rounded-[12px] border-2 p-4 text-left transition-all duration-200 tilt-3d-inner ${
                form.inventoryStrategy === 'PER_SEAT'
                  ? 'border-[#CB202D] bg-[#CB202D]/5 shadow-zomato-hover'
                  : 'border-[#f0f0ee] bg-white hover:border-[#d1d1cf] hover:shadow-zomato'
              }`}
              onClick={() => setForm({ ...form, inventoryStrategy: 'PER_SEAT' })}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-[6px] bg-blue-100">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <p className="font-extrabold text-sm text-[#2D2D2D]">Per-Seat</p>
              </div>
              <p className="text-xs text-[#6b6b68] leading-relaxed">
                Assigned seating for theaters, stadiums & concerts
              </p>
              {form.inventoryStrategy === 'PER_SEAT' && (
                <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#CB202D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#CB202D]" /> Selected
                </div>
              )}
            </button>
            <button
              type="button"
              className={`rounded-[12px] border-2 p-4 text-left transition-all duration-200 tilt-3d-inner ${
                form.inventoryStrategy === 'AGGREGATED'
                  ? 'border-[#CB202D] bg-[#CB202D]/5 shadow-zomato-hover'
                  : 'border-[#f0f0ee] bg-white hover:border-[#d1d1cf] hover:shadow-zomato'
              }`}
              onClick={() => setForm({ ...form, inventoryStrategy: 'AGGREGATED' })}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-[6px] bg-emerald-100">
                  <Clock className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="font-extrabold text-sm text-[#2D2D2D]">Aggregated</p>
              </div>
              <p className="text-xs text-[#6b6b68] leading-relaxed">
                Tier-based general admission for festivals & events
              </p>
              {form.inventoryStrategy === 'AGGREGATED' && (
                <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#CB202D]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#CB202D]" /> Selected
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Hold Duration */}
        <div>
          <label className="block text-sm font-bold text-[#2D2D2D] mb-1.5">
            Hold Duration (seconds)
          </label>
          <div className="relative">
            <input
              type="number"
              className="input-zomato pl-10"
              min={30}
              max={600}
              value={form.holdDurationSeconds}
              onChange={(e) => setForm({ ...form, holdDurationSeconds: parseInt(e.target.value) || 180 })}
            />
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b0b0ae]" />
          </div>
          <p className="text-xs text-[#b0b0ae] mt-1.5">
            How long users can hold tickets before auto-release (30–600 seconds)
          </p>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button type="submit" disabled={submitting} className="btn-zomato w-full text-base py-3">
            {submitting ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Creating Event...</>
            ) : (
              <><Plus className="w-4 h-4" /> Create Event</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
