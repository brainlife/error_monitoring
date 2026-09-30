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
  LogOut,
  Menu,
  ChevronRight,
  Cpu,
  Plus
} from 'lucide-react';
import type { UserProfile } from '../api';

export type View = 'dashboard' | 'resources' | 'cluster-health' | 'services' | 'tasks' | 'incidents' | 'users' | 'analytics' | 'settings';

interface SidebarProps {
  view: View;
  onNavigate: (v: View) => void;
  user: UserProfile | null;
  onLogout: () => void;
  hasActiveIncidents?: boolean;
  hasDegradedResources?: boolean;
  hasHealthyServices?: boolean;
}

const meNavItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'resources' as const, label: 'Resources', icon: Server },
  { id: 'cluster-health' as const, label: 'Cluster & VM Health', icon: Cpu },
  { id: 'services' as const, label: 'Services', icon: Boxes },
  { id: 'tasks' as const, label: 'Tasks', icon: ListTodo },
  { id: 'incidents' as const, label: 'Incidents', icon: AlertOctagon },
  { id: 'users' as const, label: 'Users', icon: Users },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
];

const adminNavItems = [
  { id: 'settings' as const, label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ 
  view, 
  onNavigate, 
  user, 
  onLogout,
  hasActiveIncidents = false,
  hasDegradedResources = false,
  hasHealthyServices = false
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('amaretti_sidebar_collapsed') === 'true';
  });

  const initials = useMemo(() => {
    if (!user || !user.fullname) return 'PF';
    const parts = user.fullname.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.fullname.slice(0, 2).toUpperCase();
  }, [user]);

  const displayName = useMemo(() => {
    if (user && user.fullname) return user.fullname;
    return 'Patrick Filima';
  }, [user]);

  const handleToggle = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('amaretti_sidebar_collapsed', String(nextState));
  };

  return (
    <aside className={`relative z-20 flex h-full shrink-0 flex-col bg-[#2D3748] text-white py-4 transition-all duration-300 select-none ${
      isCollapsed ? 'w-16 px-2' : 'w-60 px-3.5'
    }`}>
      {/* Brand Header */}
      <div className={`flex items-center mb-3 pb-2 border-b border-[#3A4352] ${isCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
        <div 
          onClick={() => onNavigate('dashboard')} 
          className="flex items-center gap-2.5 cursor-pointer"
          title="Brainlife Orchestration"
        >
          <img 
            src={`${import.meta.env.BASE_URL}Assets/logo.svg`} 
            alt="Brainlife" 
            className="h-6 w-6 object-contain shrink-0" 
          />
          {!isCollapsed && (
            <span className="font-sans text-[1.15rem] font-medium tracking-[0.2em] text-white whitespace-nowrap">
              BRAINLIFE
            </span>
          )}
        </div>

        <button
          onClick={handleToggle}
          className="p-1 rounded text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
        {/* Section: ME */}
        <div>
          {!isCollapsed && (
            <div className="px-2 pb-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              ME
            </div>
          )}
          <nav className="flex flex-col gap-0.5">
            {meNavItems.map(({ id, label, icon: Icon }) => {
              const active = view === id;
              
              let indicatorColor = '';
              if (id === 'incidents' && hasActiveIncidents) {
                indicatorColor = 'bg-status-error';
              } else if (id === 'resources' && hasDegradedResources) {
                indicatorColor = 'bg-status-warning';
              } else if (id === 'services' && hasHealthyServices) {
                indicatorColor = 'bg-status-success';
              }

              return (
                <button
                  key={id}
                  onClick={() => onNavigate(id)}
                  title={isCollapsed ? label : undefined}
                  className={`group relative flex items-center rounded-md text-xs font-normal transition-all duration-150 cursor-pointer ${
                    isCollapsed ? 'justify-center py-2.5 px-0 w-11 mx-auto' : 'gap-3 px-3 py-2 w-full text-left'
                  } ${
                    active
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-gray-200 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <div className="relative flex items-center shrink-0">
                    <Icon className={`h-4 w-4 shrink-0 transition-transform ${
                      active ? 'text-white' : 'text-gray-300 group-hover:text-white'
                    }`} strokeWidth={1.8} />
                    
                    {indicatorColor && (
                      <span className={`absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full ${indicatorColor}`} />
                    )}
                  </div>

                  {!isCollapsed && (
                    <span className="truncate flex-1">{label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section: ADMIN */}
        <div>
          {!isCollapsed && (
            <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              SYSTEM
            </div>
          )}
          <nav className="flex flex-col gap-0.5">
            {adminNavItems.map(({ id, label, icon: Icon }) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  onClick={() => onNavigate(id)}
                  title={isCollapsed ? label : undefined}
                  className={`group relative flex items-center rounded-md text-xs font-normal transition-all duration-150 cursor-pointer ${
                    isCollapsed ? 'justify-center py-2.5 px-0 w-11 mx-auto' : 'gap-3 px-3 py-2 w-full text-left'
                  } ${
                    active
                      ? 'bg-white/15 text-white font-semibold'
                      : 'text-gray-200 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-gray-300 group-hover:text-white'}`} strokeWidth={1.8} />
                  {!isCollapsed && <span className="truncate flex-1">{label}</span>}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Footer User Info & Theme */}
      <div className="mt-auto flex flex-col gap-2.5 border-t border-[#3A4352] pt-3">
        {/* Quick action button */}
        <button
          onClick={() => onNavigate('tasks')}
          className={`flex items-center text-xs font-medium text-gray-200 hover:text-white hover:bg-white/8 rounded-md transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center p-2' : 'gap-2 px-2.5 py-1.5 w-full'
          }`}
          title="New Task / Workflow"
        >
          <Plus className="h-4 w-4 shrink-0 text-gray-300" />
          {!isCollapsed && <span>New task re-run</span>}
        </button>

        {/* User Card */}
        <div className={`flex items-center transition-all ${isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-1 py-1'}`} title={displayName}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#4A5568] text-xs font-semibold text-white select-none border border-white/20">
            {initials}
          </div>
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white leading-tight">
                {displayName}
              </div>
            </div>
          )}
          {!isCollapsed && (
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Powered by row */}
        {!isCollapsed && (
          <div className="pt-1 px-1 border-t border-[#3A4352]/60">
            <div className="text-[11px] text-gray-400 mb-1.5 font-sans">
              Powered by
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-white p-0.5 flex items-center justify-center shadow-sm">
                <img src={`${import.meta.env.BASE_URL}Assets/logo.svg`} alt="Brainlife" className="h-3.5 w-3.5 object-contain" />
              </div>
              <div className="h-5 w-5 rounded-full bg-white p-0.5 flex items-center justify-center shadow-sm">
                <img src={`${import.meta.env.BASE_URL}Assets/aws.png`} alt="AWS" className="h-3.5 w-3.5 object-contain" />
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
