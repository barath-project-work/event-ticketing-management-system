import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Plus, CalendarRange, Settings, TrendingUp,
  ExternalLink, BarChart3, Users, Clock
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

  const stats = [
    { label: 'Total Events', value: events.length, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50', accent: 'from-blue-500 to-blue-600' },
    { label: 'Active', value: byStatus.ACTIVE.length, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', accent: 'from-emerald-500 to-emerald-600' },
    { label: 'Drafts', value: byStatus.DRAFT.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', accent: 'from-amber-500 to-amber-600' },
    { label: 'Sold Out', value: byStatus.SOLD_OUT.length, icon: Users, color: 'text-rose-600', bg: 'bg-rose-50', accent: 'from-rose-500 to-rose-600' },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE': return <span className="badge-zomato-green text-[11px]">Active</span>;
      case 'DRAFT': return <span className="badge-zomato-gray text-[11px]">Draft</span>;
      case 'SOLD_OUT': return <span className="badge-zomato-red text-[11px]">Sold Out</span>;
      case 'COMPLETED': return <span className="badge-zomato-blue text-[11px]">Completed</span>;
      case 'CANCELLED': return <span className="badge-zomato-red text-[11px]">Cancelled</span>;
      default: return <span className="badge-zomato-gray text-[11px]">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-[#CB202D]" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2D2D2D] tracking-tight">Admin Panel</h1>
          </div>
          <p className="text-sm text-[#6b6b68]">Manage events, seats, and inventory</p>
        </div>
        <Link to="/admin/events/create" className="btn-zomato">
          <Plus className="w-4 h-4" /> Create Event
        </Link>
      </div>

      {/* Stats Grid - 3D Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="stat-3d card-zomato-3d p-5 rounded-[12px] bg-white">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-[10px] ${s.bg}`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-[#2D2D2D] tracking-tight">{s.value}</p>
                <p className="text-xs font-medium text-[#b0b0ae] uppercase tracking-wider">{s.label}</p>
              </div>
            </div>
            <div className={`mt-3 h-1 w-12 rounded-full bg-gradient-to-r ${s.accent}`} />
          </div>
        ))}
      </div>

      {/* Events Management Table */}
      <div className="card-zomato overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f0f0ee] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-[#CB202D]" />
            <h2 className="text-base font-bold text-[#2D2D2D]">All Events</h2>
            <span className="badge-zomato-gray text-[11px]">{events.length}</span>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[#f0f0ee] flex items-center justify-center mx-auto mb-4">
              <CalendarRange className="w-8 h-8 text-[#d1d1cf]" />
            </div>
            <p className="text-[#2D2D2D] font-bold text-lg">No events yet</p>
            <p className="text-sm text-[#b0b0ae] mt-1">Create your first event to get started</p>
            <Link to="/admin/events/create" className="btn-zomato mt-4 inline-flex">
              <Plus className="w-4 h-4" /> Create Event
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#f0f0ee]">
            {events.map((event, i) => (
              <div
                key={event.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-[#fafaf8] transition-all duration-150 group"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-[8px] bg-gradient-to-br from-[#CB202D] to-[#a31a24] flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {event.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <p className="font-bold text-[#2D2D2D] text-sm truncate">{event.name}</p>
                      {statusBadge(event.status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#b0b0ae] mt-0.5">
                      <span>{event.venue}</span>
                      <span>·</span>
                      <span>{event.inventoryStrategy === 'PER_SEAT' ? 'Per-Seat' : 'Aggregated'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/admin/events/${event.id}`}
                    className="btn-zomato text-xs px-3 py-1.5"
                  >
                    <Settings className="w-3 h-3" /> Manage
                  </Link>
                  <Link
                    to={`/events/${event.id}`}
                    className="btn-zomato-ghost text-xs px-3 py-1.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Tips Card */}
      <div className="card-zomato overflow-hidden border-l-4 border-l-[#CB202D]">
        <div className="p-5 sm:p-6 flex items-start gap-4">
          <div className="p-2.5 rounded-[10px] bg-[#CB202D]/10 shrink-0">
            <Shield className="w-5 h-5 text-[#CB202D]" />
          </div>
          <div>
            <h3 className="font-bold text-[#2D2D2D]">Admin Token Required</h3>
            <p className="text-sm text-[#6b6b68] mt-1 leading-relaxed">
              All admin operations require a valid admin token. The default token is{' '}
              <code className="px-1.5 py-0.5 bg-[#f0f0ee] rounded text-xs font-mono text-[#CB202D]">admin-token-001</code>.
              Set the{' '}
              <code className="px-1.5 py-0.5 bg-[#f0f0ee] rounded text-xs font-mono">VITE_ADMIN_TOKEN</code>
              {' '}environment variable to customize.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
