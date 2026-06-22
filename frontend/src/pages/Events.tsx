import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarRange, MapPin, Search, SlidersHorizontal,
  Filter, ChevronRight
} from 'lucide-react';
import { eventApi } from '../api/client';
import type { EventSummary, EventStatus } from '../api/types';
import LoadingSpinner from '../components/LoadingSpinner';

const statusColors: Record<EventStatus, string> = {
  DRAFT: 'badge-gray',
  ACTIVE: 'badge-green',
  SOLD_OUT: 'badge-red',
  CANCELLED: 'badge-red',
  COMPLETED: 'badge-blue',
};

const statusLabels: Record<EventStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  SOLD_OUT: 'Sold Out',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

export default function Events() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EventStatus | 'ALL'>('ALL');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    eventApi.list().then((data) => {
      setEvents(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = events.filter((e) => {
    const matchesSearch = search === '' ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.venue.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <LoadingSpinner text="Loading events..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Events</h1>
        <p className="mt-1 text-sm text-gray-500">Browse and discover events</p>
      </div>

      {/* Search & Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search events or venues..."
              className="input-field pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary text-sm ${showFilters ? 'bg-gray-100' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(['ALL', 'ACTIVE', 'DRAFT', 'SOLD_OUT', 'COMPLETED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 ring-1 ring-gray-200'
                }`}
              >
                {s === 'ALL' ? 'All' : statusLabels[s as EventStatus]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Event Grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <CalendarRange className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No events found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search ? 'Try a different search term' : 'Check back later for new events'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="card p-5 hover:shadow-md hover:border-primary-200 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary-50 text-primary-600">
                  <CalendarRange className="w-5 h-5" />
                </div>
                <span className={statusColors[event.status]}>
                  {statusLabels[event.status]}
                </span>
              </div>

              <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                {event.name}
              </h3>

              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {event.venue}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <CalendarRange className="w-3.5 h-3.5 flex-shrink-0" />
                  {new Date(event.eventDate).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wide">
                  {event.inventoryStrategy === 'PER_SEAT' ? 'Assigned Seating' : 'General Admission'}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
