import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Plus, CalendarRange, Settings, Users,
  DollarSign, ExternalLink, TrendingUp, Edit3
} from 'lucide-react';
import { eventApi } from '../api/client';
import type { EventSummary } from '../api/types';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminDashboard() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventApi.list().then((data) => {
      setEvents(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner text="Loading admin panel..." />;

  const byStatus = {
    DRAFT: events.filter((e) => e.status === 'DRAFT'),
    ACTIVE: events.filter((e) => e.status === 'ACTIVE'),
    SOLD_OUT: events.filter((e) => e.status === 'SOLD_OUT'),
    COMPLETED: events.filter((e) => e.status === 'COMPLETED'),
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-1 text-sm text-gray-500">Manage events, seats, and inventory</p>
        </div>
        <Link to="/admin/events/create" className="btn-primary">
          <Plus className="w-4 h-4" /> Create Event
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-gray-900">{events.length}</p>
          <p className="text-xs text-gray-500">Total Events</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-emerald-600">{byStatus.ACTIVE.length}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-amber-600">{byStatus.DRAFT.length}</p>
          <p className="text-xs text-gray-500">Drafts</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-blue-600">{byStatus.COMPLETED.length}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
      </div>

      {/* Events List */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">All Events</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {events.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">
              No events yet — create your first event
            </p>
          ) : (
            events.map((event) => (
              <div key={event.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-gray-900">{event.name}</p>
                    <span className={`badge text-xs ${
                      event.status === 'ACTIVE' ? 'badge-green' :
                      event.status === 'DRAFT' ? 'badge-gray' :
                      event.status === 'SOLD_OUT' ? 'badge-red' : 'badge-blue'
                    }`}>{event.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {event.venue} · {event.inventoryStrategy}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/admin/events/${event.id}`}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" /> Manage
                  </Link>
                  <Link
                    to={`/events/${event.id}`}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Admin Tips */}
      <div className="card p-6 bg-gradient-to-r from-primary-50 to-blue-50 border-primary-100">
        <div className="flex items-start gap-4">
          <Shield className="w-8 h-8 text-primary-500 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-gray-900">Admin Token Required</h3>
            <p className="text-sm text-gray-600 mt-1">
              All admin operations require a valid admin token. The default token is{' '}
              <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">admin-token-001</code>.
              Set the <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">VITE_ADMIN_TOKEN</code> environment variable to customize.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
