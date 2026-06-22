import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarRange, Ticket, Activity,
  Clock, Shield, ArrowRight, Zap, Sparkles,
  ChevronRight, MapPin
} from 'lucide-react';
import { eventApi, healthApi } from '../api/client';
import type { EventSummary, HealthResponse } from '../api/types';
import LoadingSpinner from '../components/LoadingSpinner';

const eventPlaceholders = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

export default function Dashboard() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      eventApi.list(),
      healthApi.check().catch(() => null),
    ]).then(([evts, h]) => {
      setEvents(evts);
      setHealth(h);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner text="Loading dashboard..." />;

  const activeEvents = events.filter((e) => e.status === 'ACTIVE');
  const draftEvents = events.filter((e) => e.status === 'DRAFT');
  const soldOutEvents = events.filter((e) => e.status === 'SOLD_OUT');

  const stats = [
    {
      label: 'Total Events',
      value: events.length,
      icon: CalendarRange,
      gradient: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      iconBg: 'bg-blue-100',
    },
    {
      label: 'Active Events',
      value: activeEvents.length,
      icon: Zap,
      gradient: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      iconBg: 'bg-emerald-100',
    },
    {
      label: 'Drafts',
      value: draftEvents.length,
      icon: Clock,
      gradient: 'from-amber-500 to-amber-600',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      iconBg: 'bg-amber-100',
    },
    {
      label: 'Sold Out',
      value: soldOutEvents.length,
      icon: Ticket,
      gradient: 'from-rose-500 to-rose-600',
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      iconBg: 'bg-rose-100',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Banner - Zomato style */}
      <div className="hero-gradient rounded-[16px] p-8 sm:p-10 lg:p-12 relative overflow-hidden">
        {/* Animated dots */}
        <div className="absolute inset-0 dots-pattern opacity-50" />
        
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#CB202D]/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-[#CB202D]/5 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-semibold backdrop-blur-sm border border-white/10">
              <Sparkles className="w-3 h-3" />
              Live Event Platform
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Discover{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#CB202D] to-[#ff6b6b]">
              Live Experiences
            </span>
          </h1>
          <p className="mt-3 text-white/70 text-sm sm:text-base max-w-xl leading-relaxed">
            Browse events, hold your seats, and manage reservations — all in one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/events" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#CB202D] text-white text-sm font-bold rounded-[8px] hover:bg-[#a31a24] hover:-translate-y-0.5 shadow-lg shadow-[#CB202D]/25 transition-all duration-200">
              Browse Events
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/admin" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm text-white text-sm font-semibold rounded-[8px] border border-white/10 hover:bg-white/20 transition-all duration-200">
              <Shield className="w-4 h-4" />
              Admin Panel
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid - 3D Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="stat-3d card-zomato-3d p-5 rounded-[12px] bg-white"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-[10px] ${s.iconBg}`}>
                <s.icon className={`w-5 h-5 ${s.text}`} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-[#2D2D2D] tracking-tight">{s.value}</p>
                <p className="text-xs font-medium text-[#b0b0ae] uppercase tracking-wider">{s.label}</p>
              </div>
            </div>
            {/* Subtle decorative bar */}
            <div className={`mt-3 h-1 w-12 rounded-full bg-gradient-to-r ${s.gradient}`} />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Events - Main column */}
        <div className="lg:col-span-2">
          <div className="card-zomato overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0f0ee] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-base font-bold text-[#2D2D2D]">Active Events</h2>
                <span className="badge-zomato-green text-[11px]">{activeEvents.length}</span>
              </div>
              <Link to="/events" className="flex items-center gap-1 text-xs font-bold text-[#CB202D] hover:text-[#a31a24] transition-colors">
                View all
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-[#f0f0ee]">
              {activeEvents.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <CalendarRange className="w-10 h-10 text-[#d1d1cf] mx-auto mb-2" />
                  <p className="text-sm text-[#b0b0ae] font-medium">No active events</p>
                  <p className="text-xs text-[#d1d1cf] mt-1">Create or activate an event to get started</p>
                </div>
              ) : (
                activeEvents.slice(0, 5).map((event, i) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-[#fafaf8] transition-all duration-150 group"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-12 h-12 rounded-[10px] shrink-0 flex items-center justify-center text-white font-bold text-lg shadow-sm"
                        style={{ background: eventPlaceholders[event.id % eventPlaceholders.length] }}
                      >
                        {event.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[#2D2D2D] text-sm truncate group-hover:text-[#CB202D] transition-colors">
                          {event.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3 h-3 text-[#b0b0ae]" />
                          <p className="text-xs text-[#6b6b68] truncate">{event.venue}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium text-[#b0b0ae]">
                        {new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <div className="w-6 h-6 rounded-full bg-[#f0f0ee] flex items-center justify-center group-hover:bg-[#CB202D] group-hover:text-white transition-all duration-200">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card-zomato">
            <div className="px-6 py-4 border-b border-[#f0f0ee]">
              <h2 className="text-base font-bold text-[#2D2D2D]">Quick Links</h2>
            </div>
            <div className="p-4 space-y-2">
              <Link to="/events"
                className="flex items-center gap-3 p-3 rounded-[10px] hover:bg-[#f0f0ee] transition-all duration-200 group">
                <div className="p-2 rounded-[8px] bg-[#CB202D]/10 text-[#CB202D] group-hover:bg-[#CB202D] group-hover:text-white transition-all duration-200">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#2D2D2D]">Browse Events</p>
                  <p className="text-xs text-[#b0b0ae]">Discover live experiences</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#d1d1cf] group-hover:text-[#CB202D] transition-colors" />
              </Link>
              <Link to="/reservations"
                className="flex items-center gap-3 p-3 rounded-[10px] hover:bg-[#f0f0ee] transition-all duration-200 group">
                <div className="p-2 rounded-[8px] bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-200">
                  <Ticket className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#2D2D2D]">My Reservations</p>
                  <p className="text-xs text-[#b0b0ae]">View your tickets</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#d1d1cf] group-hover:text-[#CB202D] transition-colors" />
              </Link>
              <Link to="/admin"
                className="flex items-center gap-3 p-3 rounded-[10px] hover:bg-[#f0f0ee] transition-all duration-200 group">
                <div className="p-2 rounded-[8px] bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all duration-200">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#2D2D2D]">Admin Panel</p>
                  <p className="text-xs text-[#b0b0ae]">Manage events & inventory</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#d1d1cf] group-hover:text-[#CB202D] transition-colors" />
              </Link>
            </div>
          </div>

          {/* System Health */}
          <div className="card-zomato">
            <div className="px-6 py-4 border-b border-[#f0f0ee]">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#CB202D]" />
                <h2 className="text-base font-bold text-[#2D2D2D]">System Health</h2>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#6b6b68]">API Status</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                  health ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${health ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {health ? health.status : 'Unreachable'}
                </span>
              </div>
              {health?.components && Object.entries(health.components).slice(0, 5).map(([name, comp]) => (
                <div key={name} className="flex items-center justify-between py-1">
                  <span className="text-sm text-[#6b6b68] capitalize">
                    {name.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                    comp.status === 'UP' ? 'bg-emerald-50 text-emerald-700' :
                    comp.status === 'DOWN' ? 'bg-rose-50 text-rose-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      comp.status === 'UP' ? 'bg-emerald-500' :
                      comp.status === 'DOWN' ? 'bg-rose-500' : 'bg-amber-500'
                    }`} />
                    {comp.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Draft Events Promo */}
      {draftEvents.length > 0 && (
        <div className="card-zomato">
          <div className="px-6 py-4 border-b border-[#f0f0ee] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-bold text-[#2D2D2D]">Draft Events</h2>
              <span className="badge-zomato-yellow text-[11px]">{draftEvents.length}</span>
            </div>
          </div>
          <div className="divide-y divide-[#f0f0ee]">
            {draftEvents.map((event) => (
              <Link
                key={event.id}
                to={`/admin/events/${event.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-[#fafaf8] transition-all duration-150 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[8px] bg-amber-100 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[#2D2D2D] group-hover:text-[#CB202D] transition-colors">
                      {event.name}
                    </p>
                    <p className="text-xs text-[#b0b0ae]">{event.venue}</p>
                  </div>
                </div>
                <span className="badge-zomato-gray text-[11px]">Draft</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
