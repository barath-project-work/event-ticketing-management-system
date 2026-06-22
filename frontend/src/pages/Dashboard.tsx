import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarRange, Ticket, TrendingUp, Activity,
  Clock, Shield, ArrowRight, Zap, Users, DollarSign
} from 'lucide-react';
import { eventApi, healthApi } from '../api/client';
import type { EventSummary, HealthResponse } from '../api/types';
import LoadingSpinner from '../components/LoadingSpinner';

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
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Active Events',
      value: activeEvents.length,
      icon: Zap,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      label: 'Drafts',
      value: draftEvents.length,
      icon: Clock,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Sold Out',
      value: soldOutEvents.length,
      icon: Ticket,
      color: 'text-red-600 bg-red-50',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Event ticketing system overview and management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Events */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Active Events</h2>
          <Link to="/events" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            View all events →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {activeEvents.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No active events</p>
          ) : (
            activeEvents.slice(0, 5).map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">{event.name}</p>
                  <p className="text-sm text-gray-500">
                    {event.venue} · {new Date(event.eventDate).toLocaleDateString()}
                  </p>
                </div>
                <span className="badge-green">
                  {event.inventoryStrategy === 'PER_SEAT' ? 'Per-Seat' : 'Aggregated'}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions & Health */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-6 space-y-3">
            <Link to="/events" className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <CalendarRange className="w-5 h-5 text-primary-500" />
                <span className="text-sm font-medium text-gray-700">Browse Events</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
            <Link to="/reservations" className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <Ticket className="w-5 h-5 text-emerald-500" />
                <span className="text-sm font-medium text-gray-700">My Reservations</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
            <Link to="/admin" className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-medium text-gray-700">Admin Panel</span>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </Link>
          </div>
        </div>

        {/* System Health */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Status</span>
              <span className={`badge ${health ? 'badge-green' : 'badge-red'}`}>
                {health ? health.status : 'Unreachable'}
              </span>
            </div>
            {health?.components && Object.entries(health.components).slice(0, 4).map(([name, comp]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 capitalize">
                  {name.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <span className={`badge ${comp.status === 'UP' ? 'badge-green' : comp.status === 'DOWN' ? 'badge-red' : 'badge-yellow'}`}>
                  {comp.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
