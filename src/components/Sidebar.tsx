import { useMemo } from 'react';
import {
  LayoutDashboard,
  Server,
  Boxes,
  ListTodo,
  BarChart3,
  Settings as SettingsIcon,
  Moon,
  LogOut
} from 'lucide-react';
import type { UserProfile } from '../api';

export type View = 'dashboard' | 'resources' | 'services' | 'tasks' | 'analytics' | 'settings';

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
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
  { id: 'settings' as const, label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ view, onNavigate, user, onLogout }: SidebarProps) {
  const initials = useMemo(() => {
    if (!user || !user.fullname) return '??';
    const parts = user.fullname.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.fullname.slice(0, 2).toUpperCase();
  }, [user]);
  console.log(user)
  return (
    <aside className="relative z-20 flex h-full w-52 shrink-0 flex-col border-r border-border-glass bg-bg-dark/85 py-6 px-4">
      {/* Brand Logo & Title */}
      <div className="mb-8 flex flex-col items-center">
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-cyan/20 to-accent-purple/10 ring-1 ring-accent-cyan/30 shadow-[0_0_20px_rgba(0,229,255,0.15)]">
         <img src="/Assets/icon1.png" alt="Amaretti Logo" className="h-10 w-10 object-contain" />

        </div>
        <span className="mt-2.5 font-sans text-xs font-bold tracking-[0.25em] text-text-main">
          Brainlife
        </span>
      </div>

      {/* Navigation Menu */}
      <nav className="flex flex-1 flex-col gap-1.5">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`group relative flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-200 ${active
                  ? 'bg-accent-cyan/10 text-accent-cyan shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] ring-1 ring-accent-cyan/20'
                  : 'text-text-muted hover:bg-white/[0.03] hover:text-text-main'
                }`}
            >
              {/* Left active border indicator */}
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-cyan shadow-[0_0_8px_#00E5FF]" />
              )}
              <Icon className={`h-4.5 w-4.5 transition-transform duration-200 group-hover:scale-105 ${active ? 'text-accent-cyan' : 'text-text-muted'}`} strokeWidth={1.75} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer User Info & Theme */}
      <div className="mt-auto flex flex-col gap-4 border-t border-border-glass pt-5">
        {/* User Card */}
        <div className="flex items-center gap-3 px-1.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20 text-xs font-bold text-accent-cyan ring-1 ring-accent-cyan/30 select-none">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-text-main leading-tight">
              {user ? user.fullname : 'Loading...'}
            </div>
            <div className="text-[10px] text-text-faint truncate">
              @{user ? user.fullname: 'user'}
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center justify-between border-t border-white/[0.03] pt-3 px-1">
          <button
            title="Theme Switcher"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-white/5 hover:text-text-main transition-colors"
          >
            <Moon className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={onLogout}
            title="Logout"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-white/5 hover:text-status-error active:scale-[0.96] transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  );
}
