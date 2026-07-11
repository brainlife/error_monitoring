import { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Server,
  Boxes,
  ListTodo,
  AlertOctagon,
  Users,
  BarChart3,
  Settings as SettingsIcon,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { UserProfile } from '../api';

export type View = 'dashboard' | 'resources' | 'services' | 'tasks' | 'incidents' | 'users' | 'analytics' | 'settings';

interface SidebarProps {
  view: View;
  onNavigate: (v: View) => void;
  user: UserProfile | null;
  onLogout: () => void;
}

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'resources' as const, label: 'Resources', icon: Server },
  { id: 'services' as const, label: 'Services', icon: Boxes },
  { id: 'tasks' as const, label: 'Tasks', icon: ListTodo },
  { id: 'incidents' as const, label: 'Incidents', icon: AlertOctagon },
  { id: 'users' as const, label: 'Users', icon: Users },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  { id: 'settings' as const, label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ view, onNavigate, user, onLogout }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('amaretti_sidebar_collapsed') === 'true';
  });

  const initials = useMemo(() => {
    if (!user || !user.fullname) return '??';
    const parts = user.fullname.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.fullname.slice(0, 2).toUpperCase();
  }, [user]);

  const handleToggle = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('amaretti_sidebar_collapsed', String(nextState));
  };

  return (
    <aside className={`relative z-20 flex h-full shrink-0 flex-col border-r border-border-glass bg-bg-dark/85 py-6 transition-all duration-300 ${
      isCollapsed ? 'w-18 px-2' : 'w-52 px-4'
    }`}>
      {/* Floating Collapse Toggle Button */}
      <button
        onClick={handleToggle}
        className="absolute -right-3 top-6 flex h-6 w-6 items-center justify-center rounded-full border border-border-glass bg-[#050811] text-text-muted hover:text-text-main shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-1 ring-white/5 active:scale-95 transition-all z-30 cursor-pointer"
        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Brand Logo & Title */}
      <div className={`mb-8 flex flex-col items-center transition-all ${isCollapsed ? 'px-1' : ''}`}>
        <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-cyan/20 to-accent-purple/10 ring-1 ring-accent-cyan/30 shadow-[0_0_20px_rgba(0,229,255,0.15)] transition-all">
          <img src="/Assets/icon1.png" alt="Amaretti Logo" className="h-7 w-7 object-contain transition-all" />
        </div>
        {!isCollapsed && (
          <span className="mt-2.5 font-sans text-xs font-bold tracking-[0.25em] text-text-main whitespace-nowrap animate-slide-in">
            Brainlife
          </span>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex flex-1 flex-col gap-1.5">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={isCollapsed ? label : undefined}
              className={`group relative flex items-center rounded-xl py-3 text-sm font-medium transition-all duration-200 ${
                isCollapsed ? 'justify-center px-0 w-11 mx-auto' : 'gap-3.5 px-3.5 w-full'
              } ${
                active
                  ? 'bg-accent-cyan/10 text-accent-cyan shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] ring-1 ring-accent-cyan/20'
                  : 'text-text-muted hover:bg-white/[0.03] hover:text-text-main'
              }`}
            >
              {/* Left active border indicator */}
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-cyan shadow-[0_0_8px_#00E5FF]" />
              )}
              <Icon className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-105 ${active ? 'text-accent-cyan' : 'text-text-muted'}`} strokeWidth={1.75} />
              {!isCollapsed && <span className="animate-slide-in whitespace-nowrap">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer User Info & Theme */}
      <div className="mt-auto flex flex-col gap-4 border-t border-border-glass pt-5">
        {/* User Card */}
        <div className={`flex items-center transition-all ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-1.5'}`} title={user ? user.fullname : 'User'}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20 text-xs font-bold text-accent-cyan ring-1 ring-accent-cyan/30 select-none">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1 animate-slide-in">
              <div className="truncate text-xs font-semibold text-text-main leading-tight">
                {user ? user.fullname : 'Loading...'}
              </div>
              <div className="text-[10px] text-text-faint truncate mt-0.5">
                @{user ? user.fullname : 'user'}
              </div>
            </div>
          )}
        </div>

        {/* Action icons */}
        <div className={`flex border-t border-white/[0.03] pt-3 px-1 transition-all ${isCollapsed ? 'flex-col items-center gap-2.5' : 'items-center justify-between'}`}>
          <button
            title="Theme Switcher"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-white/5 hover:text-text-main transition-colors shrink-0 animate-fade-up"
          >
            <Moon className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={onLogout}
            title="Logout"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-white/5 hover:text-status-error active:scale-[0.96] transition-all cursor-pointer shrink-0 animate-fade-up"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  );
}
