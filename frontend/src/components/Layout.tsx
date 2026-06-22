import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CalendarRange, TicketCheck,
  Shield, Menu, X, ChevronDown, User, Bell
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/events', label: 'Events', icon: CalendarRange },
  { path: '/reservations', label: 'My Reservations', icon: TicketCheck },
  { path: '/admin', label: 'Admin', icon: Shield },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F4F2]">
      {/* Top bar with subtle shadow */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#f0f0ee] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[68px]">
            {/* Logo - Zomato style */}
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <div className="flex items-center justify-center w-[42px] h-[42px] rounded-[10px] bg-[#CB202D] text-white font-extrabold text-lg shadow-zomato group-hover:shadow-zomato-hover transition-all duration-200 group-hover:-translate-y-0.5">
                ET
              </div>
              <div className="hidden sm:block">
                <span className="text-lg font-extrabold text-[#2D2D2D] tracking-tight leading-none block">
                  EventTicketing
                </span>
                <span className="text-[10px] text-[#b0b0ae] font-medium tracking-wider uppercase">
                  Live Experiences
                </span>
              </div>
            </Link>

            {/* Desktop nav - Zomato style tabs */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const active = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-semibold transition-all duration-200 ${
                      active
                        ? 'bg-[#CB202D]/10 text-[#CB202D] shadow-sm'
                        : 'text-[#6b6b68] hover:text-[#2D2D2D] hover:bg-[#f0f0ee]'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right side - Zomato style */}
            <div className="flex items-center gap-3">
              <button className="hidden md:flex items-center justify-center w-9 h-9 rounded-full bg-[#f0f0ee] text-[#6b6b68] hover:bg-[#e5e5e3] hover:text-[#2D2D2D] transition-all duration-200">
                <Bell className="w-4 h-4" />
              </button>
              <button className="hidden md:flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[#f0f0ee] text-sm font-medium text-[#2D2D2D] hover:bg-[#e5e5e3] transition-all duration-200">
                <User className="w-4 h-4" />
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-[8px] text-[#6b6b68] hover:bg-[#f0f0ee] transition-all duration-200"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[#f0f0ee] bg-white animate-slide-up">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const active = location.pathname === item.path ||
                  (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-sm font-medium transition-all duration-200 ${
                      active
                        ? 'bg-[#CB202D]/10 text-[#CB202D]'
                        : 'text-[#6b6b68] hover:bg-[#f0f0ee]'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        {children}
      </main>

      {/* Zomato-style footer */}
      <footer className="border-t border-[#f0f0ee] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-[8px] bg-[#CB202D] text-white font-bold text-xs">
                  ET
                </div>
                <span className="font-bold text-[#2D2D2D]">EventTicketing</span>
              </div>
              <p className="text-sm text-[#6b6b68] leading-relaxed">
                Your premier platform for live event ticketing and reservation management.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#2D2D2D] uppercase tracking-wider mb-4">Browse</h4>
              <div className="space-y-2.5">
                <Link to="/events" className="block text-sm text-[#6b6b68] hover:text-[#CB202D] transition-colors">Events</Link>
                <Link to="/reservations" className="block text-sm text-[#6b6b68] hover:text-[#CB202D] transition-colors">My Reservations</Link>
                <Link to="/" className="block text-sm text-[#6b6b68] hover:text-[#CB202D] transition-colors">Dashboard</Link>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#2D2D2D] uppercase tracking-wider mb-4">Admin</h4>
              <div className="space-y-2.5">
                <Link to="/admin" className="block text-sm text-[#6b6b68] hover:text-[#CB202D] transition-colors">Admin Panel</Link>
                <Link to="/admin/events/create" className="block text-sm text-[#6b6b68] hover:text-[#CB202D] transition-colors">Create Event</Link>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#2D2D2D] uppercase tracking-wider mb-4">Company</h4>
              <div className="space-y-2.5">
                <a href="https://github.com/barath-project-work/event-ticketing-management-system"
                  target="_blank" rel="noopener noreferrer"
                  className="block text-sm text-[#6b6b68] hover:text-[#CB202D] transition-colors">
                  GitHub
                </a>
                <span className="block text-sm text-[#b0b0ae]">v1.0.0</span>
              </div>
            </div>
          </div>
          <div className="border-t border-[#f0f0ee] py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#b0b0ae]">
              &copy; {new Date().getFullYear()} EventTicketing. All rights reserved.
            </p>
            <p className="text-xs text-[#b0b0ae]">
              Made with <span className="text-[#CB202D]">♥</span> for live experiences
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
