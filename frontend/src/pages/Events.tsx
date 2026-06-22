import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarRange, MapPin, Search,
  Filter, ChevronRight, Users, Star, Clock
} from 'lucide-react';
import { eventApi } from '../api/client';
import type { EventSummary, EventStatus } from '../api/types';
import LoadingSpinner from '../components/LoadingSpinner';

const eventGradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
];

const statusBadge: Record<EventStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'badge-zomato-gray' },
  ACTIVE: { label: 'Active', className: 'badge-zomato-green' },
  SOLD_OUT: { label: 'Sold Out', className: 'badge-zomato-red' },
  CANCELLED: { label: 'Cancelled', className: 'badge-zomato-red' },
  COMPLETED: { label: 'Completed', className: 'badge-zomato-blue' },
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

  if (loading) return <LoadingSpinner text="Discovering events..." />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2D2D2D] tracking-tight">Events</h1>
          <p className="mt-1 text-sm text-[#6b6b68]">Discover and explore live experiences near you</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#b0b0ae]">
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>{events.length} event{events.length !== 1 ? 's' : ''} available</span>
        </div>
      </div>

      {/* Search Bar - Zomato style */}
      <div className="card-zomato p-1.5">
        <div className="flex flex-col sm:flex-row gap-1.5">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b0b0ae]" />
            <input
              type="text"
              placeholder="Search for events, venues..."
              className="input-zomato-search pl-11"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-zomato-ghost ${showFilters ? 'bg-[#CB202D]/10 text-[#CB202D]' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(statusFilter !== 'ALL' || search) && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#CB202D]" />
            )}
          </button>
        </div>

        {/* Filter pills */}
        {showFilters && (
          <div className="mt-3 px-2 pb-2 flex flex-wrap gap-2 animate-slide-up">
            {(['ALL', 'ACTIVE', 'DRAFT', 'SOLD_OUT', 'COMPLETED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  statusFilter === s
                    ? 'bg-[#CB202D] text-white shadow-sm'
                    : 'bg-[#f0f0ee] text-[#6b6b68] hover:bg-[#e5e5e3]'
                }`}
              >
                {s === 'ALL' ? 'All Events' :
                 s === 'SOLD_OUT' ? 'Sold Out' :
                 s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Event Grid - Zomato style restaurant cards */}
      {filtered.length === 0 ? (
        <div className="card-zomato p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#f0f0ee] flex items-center justify-center mx-auto mb-4">
            <CalendarRange className="w-8 h-8 text-[#d1d1cf]" />
          </div>
          <p className="text-[#2D2D2D] font-bold text-lg">No events found</p>
          <p className="text-sm text-[#b0b0ae] mt-1">
            {search ? 'Try adjusting your search or filters' : 'Check back later for new events'}
          </p>
          {search && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('ALL'); }}
              className="btn-zomato mt-4"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="group tilt-3d"
            >
              <div className="card-zomato overflow-hidden tilt-3d-inner">
                {/* Event image placeholder - Zomato style */}
                <div
                  className="h-44 relative overflow-hidden"
                  style={{ background: eventGradients[event.id % eventGradients.length] }}
                >
                  {/* Decorative pattern */}
                  <div className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.3) 1px, transparent 1px)`,
                      backgroundSize: '20px 20px',
                    }}
                  />
                  {/* Status badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <span className={statusBadge[event.status].className}>
                      {statusBadge[event.status].label}
                    </span>
                  </div>
                  {/* Event initial */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl font-black text-white/20 select-none">
                      {event.name.charAt(0)}
                    </span>
                  </div>
                  {/* Gradient overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
                  {/* Event name on image */}
                  <div className="absolute bottom-3 left-4 right-4">
                    <h3 className="text-white font-bold text-lg leading-tight drop-shadow-lg line-clamp-1">
                      {event.name}
                    </h3>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-sm text-[#6b6b68]">
                      <MapPin className="w-3.5 h-3.5 text-[#b0b0ae]" />
                      <span className="truncate">{event.venue}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-[#6b6b68]">
                      <CalendarRange className="w-3.5 h-3.5 text-[#b0b0ae]" />
                      <span>
                        {new Date(event.eventDate).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Bottom section */}
                  <div className="mt-4 pt-3 border-t border-[#f0f0ee] flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#b0b0ae] uppercase tracking-wider">
                      {event.inventoryStrategy === 'PER_SEAT' ? (
                        <><Users className="w-3 h-3" /> Assigned Seating</>
                      ) : (
                        <><Clock className="w-3 h-3" /> General Admission</>
                      )}
                    </span>
                    <div className="flex items-center gap-1 text-xs font-bold text-[#CB202D] opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 -translate-x-2">
                      View Details
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
