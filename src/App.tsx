import { useState, useEffect, useMemo, useCallback } from 'react';
import Sidebar, { type View } from './components/Sidebar';
import KpiCards from './components/KpiCards';
import ResourceGrid from './components/ResourceGrid';
import LogConsole from './components/LogConsole';
import TaskTable from './components/TaskTable';
import ExecutionTimeline from './components/ExecutionTimeline';
import Settings from './components/Settings';
import Login from './components/Login';
import ResourcesView from './components/ResourcesView';
import TasksView from './components/TasksView';
import AnalyticsView from './components/AnalyticsView';
import ServicesView from './components/ServicesView';
import IncidentsView from './components/IncidentsView';
import UsersView from './components/UsersView';
import { apiFetch, getJwtToken, getUserProfile, logout, setJwtToken, fetchWarehouseProjects, fetchAuthUsers, type UserProfile } from './api';
import { Search, Bell, Activity, Database, Users, ShieldAlert, CheckCircle2, AlertOctagon, Boxes, Server, ListTodo, Layers } from 'lucide-react';

// API Schema Types
interface BackendTask {
  _id: string;
  service: string;
  instance_id: string;
  resource_id: string;
  status: 'running' | 'finished' | 'failed' | 'queued' | 'cancelled' | 'unknown' | 'removed' | 'stopped';
  status_msg?: string;
  start_date?: string;
  finish_date?: string;
  create_date?: string;
  _group_id?: number;
  user_id?: string;
}

interface BackendResource {
  _id: string;
  name: string;
  resource_type: string;
  status: 'ok' | 'failed' | 'unknown' | 'removed';
  status_msg?: string;
  active: boolean;
}

import { type Task, type ComputeResource } from './data';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [tasksList, setTasksList] = useState<Task[]>([]);
  const [resourcesList, setResourcesList] = useState<ComputeResource[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [configVersion, setConfigVersion] = useState(0);
  const [projectNamesMap, setProjectNamesMap] = useState<Record<string, string>>({});
  const [userNamesMap, setUserNamesMap] = useState<Record<string, string>>({});
  const [usersList, setUsersList] = useState<{ _id: string; sub: number; username: string; fullname: string; email?: string; scopes?: { brainlife?: string[] } }[]>([]);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Sidebar status flags
  const hasActiveIncidents = useMemo(() => {
    return resourcesList.some(r => r.status === 'error') || tasksList.some(t => t.status === 'failed');
  }, [resourcesList, tasksList]);

  const hasDegradedResources = useMemo(() => {
    return resourcesList.some(r => r.status === 'degraded');
  }, [resourcesList]);

  const hasHealthyServices = useMemo(() => {
    return true;
  }, []);

  // Cross-linking relationship navigation states
  const [selectedResourceIdForCrossLink, setSelectedResourceIdForCrossLink] = useState<string | null>(null);
  const [selectedUserIdForCrossLink, setSelectedUserIdForCrossLink] = useState<string | null>(null);
  const [selectedIncidentIdForCrossLink, setSelectedIncidentIdForCrossLink] = useState<string | null>(null);

  const handleNavigateToTask = useCallback((taskId: string) => {
    const taskObj = tasksList.find(t => t.id === taskId);
    if (taskObj) {
      setSelectedTask(taskObj);
    }
    setView('tasks');
  }, [tasksList]);

  const handleNavigateToResource = useCallback((resourceName: string) => {
    setSelectedResourceIdForCrossLink(resourceName);
    setView('resources');
  }, []);

  const handleNavigateToUser = useCallback((userId: string) => {
    setSelectedUserIdForCrossLink(userId);
    setView('users');
  }, []);

  const handleNavigateToIncident = useCallback((incidentId: string) => {
    setSelectedIncidentIdForCrossLink(incidentId);
    setView('incidents');
  }, []);

  // Reset cross-linking parameters upon view transit
  useEffect(() => {
    setSelectedResourceIdForCrossLink(null);
    setSelectedUserIdForCrossLink(null);
    setSelectedIncidentIdForCrossLink(null);
  }, [view]);

  // Spotlight keyboard listener (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Spotlight search matching logic
  const spotlightResults = useMemo(() => {
    if (!globalSearchQuery.trim()) return [];

    const query = globalSearchQuery.toLowerCase().trim();
    const results: { category: string; id: string; title: string; subtitle?: string; icon: string; action: () => void }[] = [];

    // 1. Resources
    resourcesList.forEach(r => {
      if (r.name.toLowerCase().includes(query) || r.type.toLowerCase().includes(query)) {
        results.push({
          category: 'Resource',
          id: `res-${r.id}`,
          title: r.name,
          subtitle: r.type,
          icon: 'server',
          action: () => {
            handleNavigateToResource(r.name);
            setGlobalSearchOpen(false);
            setGlobalSearchQuery('');
          }
        });
      }
    });

    // 2. Tasks
    tasksList.forEach(t => {
      const projName = projectNamesMap?.[t.projectId] || t.projectId;
      if (t.service.toLowerCase().includes(query) || t.id.toLowerCase().includes(query) || projName.toLowerCase().includes(query)) {
        results.push({
          category: 'Task',
          id: `task-${t.id}`,
          title: t.service.split('/').pop() || t.service,
          subtitle: `Status: ${t.status} | ID: ${t.id.slice(-8)}`,
          icon: 'terminal',
          action: () => {
            handleNavigateToTask(t.id);
            setGlobalSearchOpen(false);
            setGlobalSearchQuery('');
          }
        });
      }
    });

    // 3. Incidents
    const baseIncidents = [
      { id: 'inc-sys-101', title: 'IU Karst SSH Host Unreachable', resource: 'Karst' },
      { id: 'inc-sys-102', title: 'Archive Storage Node: Disk space alert', resource: 'Carbonate Storage Node' },
      { id: 'inc-sys-103', title: 'Database Replication Lag Spike', resource: 'mongodb' }
    ];
    baseIncidents.forEach(inc => {
      if (inc.title.toLowerCase().includes(query) || inc.resource.toLowerCase().includes(query)) {
        results.push({
          category: 'Incident',
          id: inc.id,
          title: inc.title,
          subtitle: `Resource: ${inc.resource}`,
          icon: 'alert-octagon',
          action: () => {
            handleNavigateToIncident(inc.id);
            setGlobalSearchOpen(false);
            setGlobalSearchQuery('');
          }
        });
      }
    });

    // 4. Users
    usersList.forEach(u => {
      if (u.fullname.toLowerCase().includes(query) || u.username.toLowerCase().includes(query) || (u.email && u.email.toLowerCase().includes(query))) {
        results.push({
          category: 'User',
          id: `user-${u._id}`,
          title: u.fullname,
          subtitle: `@${u.username}`,
          icon: 'user',
          action: () => {
            handleNavigateToUser(u.sub ? u.sub.toString() : u._id);
            setGlobalSearchOpen(false);
            setGlobalSearchQuery('');
          }
        });
      }
    });

    // 5. Projects
    const uniqueProjects = Array.from(new Set(tasksList.map(t => t.projectId).filter(Boolean)));
    uniqueProjects.forEach(pid => {
      const name = projectNamesMap?.[pid] || `Project ${pid.slice(-6)}`;
      if (name.toLowerCase().includes(query) || pid.toLowerCase().includes(query)) {
        results.push({
          category: 'Project',
          id: `proj-${pid}`,
          title: name,
          subtitle: `ID: ${pid}`,
          icon: 'layers',
          action: () => {
            setView('tasks');
            setGlobalSearchOpen(false);
            setGlobalSearchQuery('');
          }
        });
      }
    });

    // 6. Services
    const serviceNames = ['app-noop', 'app-supertest', 'app-freesurfer', 'app-fmriprep'];
    serviceNames.forEach(sName => {
      if (sName.toLowerCase().includes(query)) {
        results.push({
          category: 'Service',
          id: `srv-${sName}`,
          title: sName,
          subtitle: 'Active Pipeline Pipeline',
          icon: 'boxes',
          action: () => {
            setView('services');
            setGlobalSearchOpen(false);
            setGlobalSearchQuery('');
          }
        });
      }
    });

    return results.slice(0, 10);
  }, [globalSearchQuery, tasksList, resourcesList, usersList, projectNamesMap]);

  // Authentication state
  const [user, setUser] = useState<UserProfile | null>(getUserProfile());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!getJwtToken() && !!user);

  // Catch redirected JWT query parameters from SSO providers
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jwtFromUrl = params.get('jwt');
    
    if (jwtFromUrl) {
      setJwtToken(jwtFromUrl);
      
      try {
        const payloadPart = jwtFromUrl.split('.')[1];
        const payloadDecoded = JSON.parse(atob(payloadPart));
        
        const userProfile: UserProfile = {
          id: payloadDecoded.sub || '1',
          username: payloadDecoded.username || payloadDecoded.sub || 'user',
          fullname: payloadDecoded.fullname || payloadDecoded.username || 'User Profile',
          email: payloadDecoded.email || ''
        };
        
        localStorage.setItem('amaretti_user', JSON.stringify(userProfile));
        setUser(userProfile);
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Failed to decode SSO JWT payload:', err);
      }
      
      // Clean query parameter from URL
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  // Load warehouse project names and Amaretti instances
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadProjects = async () => {
      const map: Record<string, string> = {};
      
      // Load Warehouse projects
      try {
        const projectList = await fetchWarehouseProjects();
        projectList.forEach(p => {
          if (p._id) {
            map[p._id] = p.name;
          }
        });
      } catch (err) {
        console.error('Failed to load warehouse projects:', err);
      }

      // Load Amaretti instances
      try {
        interface AmarettiInstance {
          _id: string;
          name?: string;
        }
        const res = await apiFetch<any>('/instance');
        let instances: AmarettiInstance[] = [];
        if (Array.isArray(res)) {
          instances = res;
        } else if (res && Array.isArray(res.instances)) {
          instances = res.instances;
        } else if (res && Array.isArray(res.results)) {
          instances = res.results;
        } else if (res && typeof res === 'object') {
          const arrayProp = Object.values(res).find(val => Array.isArray(val));
          if (arrayProp) {
            instances = arrayProp as AmarettiInstance[];
          }
        }
        instances.forEach(inst => {
          if (inst._id && inst.name) {
            map[inst._id] = inst.name;
          }
        });
      } catch (err) {
        console.error('Failed to load Amaretti instances:', err);
      }

      setProjectNamesMap(map);
    };
    loadProjects();
  }, [isAuthenticated]);

  // Load auth users list
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadUsers = async () => {
      try {
        const list = await fetchAuthUsers();
        const map: Record<string, string> = {};
        list.forEach(u => {
          if (u.sub) {
            map[u.sub.toString()] = u.username;
          }
          if (u._id) {
            map[u._id] = u.username;
          }
        });
        setUserNamesMap(map);
        setUsersList(list);
      } catch (err) {
        console.error('Failed to load auth users:', err);
      }
    };
    loadUsers();
  }, [isAuthenticated]);

  // Load resources and build a lookup map of resource IDs to Names
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      
      // 1. Fetch live compute resources
      const resourceRes = await apiFetch<{ resources: BackendResource[] }>('/resource');
      const backendResources = resourceRes.resources || [];
      const mappedResources = backendResources.map(r => {
        let status: ComputeResource['status'] = 'error';
        if (r.active && r.status === 'ok') status = 'online';
        else if (r.active && r.status === 'unknown') status = 'degraded';
        
        return {
          id: r._id,
          name: r.name,
          type: r.resource_type,
          status,
          detail: r.status_msg || (r.active ? 'Active' : 'Inactive'),
          tags: [r.resource_type]
        };
      });
      setResourcesList(mappedResources);

      const resourceMap = backendResources.reduce((acc, r) => {
        acc[r._id] = r.name;
        return acc;
      }, {} as Record<string, string>);

      // 2. Fetch live tasks (limit to 50 latest tasks)
      const queryParams = new URLSearchParams({
        limit: '50',
        sort: '-create_date'
      });
      const taskRes = await apiFetch<{ tasks: BackendTask[] }>(`/task?${queryParams}`);
      const backendTasks = taskRes.tasks || [];
      const mappedTasks = backendTasks.map(t => {
        let status: Task['status'] = 'unknown';
        if (t.status === 'running') status = 'running';
        else if (t.status === 'finished') status = 'finished';
        else if (t.status === 'failed') status = 'failed';
        else if (t.status === 'queued') status = 'queued';
        else if (t.status === 'removed' || t.status === 'stopped') status = 'cancelled';
        
        const resourceName = resourceMap[t.resource_id] || 'Unknown';
        
        let startedAt = '--';
        if (t.start_date) {
          startedAt = new Date(t.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (t.create_date) {
          startedAt = new Date(t.create_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        let duration = '--';
        if (t.start_date) {
          const start = new Date(t.start_date).getTime();
          const end = t.finish_date ? new Date(t.finish_date).getTime() : Date.now();
          const diff = end - start;
          if (diff > 0) {
            const hrs = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            duration = `${hrs}:${mins}:${secs}`;
          }
        }

        return {
          id: t._id,
          service: t.service,
          projectId: t.instance_id || 'Unknown',
          resource: resourceName,
          status,
          runtime: resourceName,
          startedAt,
          duration,
          message: t.status_msg || '',
          startDate: t.start_date || t.create_date,
          finishDate: t.finish_date,
          userId: t.user_id ? t.user_id.toString() : 'Unknown'
        };
      });
      
      setTasksList(mappedTasks);
      
      // Auto-select the first task if nothing is currently selected
      if (mappedTasks.length > 0) {
        setSelectedTask(prev => {
          if (prev && mappedTasks.some(t => t.id === prev.id)) {
            return mappedTasks.find(t => t.id === prev.id) || null;
          }
          return mappedTasks[0];
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard metrics from backend API:', error);
    } finally {
      setLoading(false);
    }
  }, [configVersion, isAuthenticated]);

  // Load data immediately and then poll every 10 seconds for real-time monitoring
  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData, isAuthenticated]);

  const handleConfigChange = () => {
    setConfigVersion(prev => prev + 1);
  };

  const handleLoginSuccess = () => {
    setUser(getUserProfile());
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setIsAuthenticated(false);
    setView('dashboard');
  };

  const handleTest = (id: string) => {
    setTestingId(id);
    setTimeout(() => setTestingId(null), 2000);
  };

  const stats = useMemo(() => {
    let running = 0;
    let finished = 0;
    let failed = 0;
    tasksList.forEach(t => {
      if (t.status === 'running') running++;
      else if (t.status === 'finished') finished++;
      else if (t.status === 'failed') failed++;
    });
    return {
      running,
      finished,
      failed,
      total: tasksList.length
    };
  }, [tasksList]);

  // Route to Login Page if not authenticated
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }
  return (
    <div className="relative z-10 flex h-screen w-full overflow-hidden bg-bg-dark text-text-main">
      {/* 1. Left Fixed Sidebar */}
      <Sidebar 
        view={view} 
        onNavigate={setView} 
        user={user} 
        onLogout={handleLogout} 
        hasActiveIncidents={hasActiveIncidents}
        hasDegradedResources={hasDegradedResources}
        hasHealthyServices={hasHealthyServices}
      />

      {/* Main Container for Right Side */}
      <div className="flex flex-1 flex-col min-w-0">
        
        {/* Top Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-border-glass px-6 py-4.5 bg-bg-dark/40">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-main flex items-center gap-2">
              {view === 'dashboard' && 'Orchestration Dashboard'}
              {view === 'resources' && 'Compute Resources'}
              {view === 'services' && 'Services'}
              {view === 'tasks' && 'All Task Workflows'}
              {view === 'analytics' && 'Workflow Analytics'}
              {view === 'settings' && 'System Settings'}
            </h1>
            <p className="mt-0.5 text-xs text-text-muted">
              {view === 'dashboard' && 'Real-time task orchestration, compute resources and system health'}
              {view === 'resources' && 'Connected compute nodes & cluster health'}
              {view === 'services' && 'Search and monitor all orchestration services'}
              {view === 'tasks' && 'Search and inspect history of workflow executions'}
              {view === 'analytics' && 'Compute performance analytics'}
              {view === 'settings' && 'Manage configurations, integrations, and credentials'}
              {view === 'incidents' && 'Inspect history of outages, latency spikes, and system alerts'}
              {view === 'users' && 'Audit live workloads, success histories, and active runs by operator'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div 
              onClick={() => setGlobalSearchOpen(true)}
              className="relative hidden sm:block cursor-pointer"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
              <input
                type="text"
                readOnly
                placeholder="Search tasks, services, resources..."
                className="w-64 rounded-lg border border-border-glass bg-white/[0.02] py-1.5 pl-9 pr-12 font-sans text-xs text-text-main placeholder:text-text-faint focus:outline-none cursor-pointer"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1 font-mono text-[9px] text-text-faint">
                ⌘K
              </span>
            </div>

            {/* Systems Operational Badge */}
            <div className="flex items-center gap-2 rounded-lg border border-border-glass bg-white/[0.01] px-3.5 py-1.5 border-white/[0.06]">
              <span className={`h-2 w-2 rounded-full ${loading ? 'bg-status-warning shadow-[0_0_8px_#F59E0B]' : 'bg-status-success shadow-[0_0_8px_#10B981] animate-pulse-glow'}`} />
              <span className="text-xs font-semibold text-text-muted">{loading ? 'Synchronizing...' : 'All systems operational'}</span>
            </div>

            {/* Notification Bell */}
            <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border-glass bg-white/[0.01] text-text-muted hover:text-text-main hover:bg-white/[0.03] transition-colors">
              <Bell className="h-4.5 w-4.5" strokeWidth={1.75} />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-status-error shadow-[0_0_4px_#EF4444]" />
            </button>
          </div>
        </header>

        {/* 2. Main Content & Right Log Console layout */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          
          {/* Scrollable Center Dashboard */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {view === 'dashboard' && (
              <>
                {/* KPI Cards Grid */}
                <KpiCards {...stats} resources={resourcesList} tasks={tasksList} onNavigate={setView} />

                {/* Execution Timeline (Live Activity Component) */}
                <ExecutionTimeline tasks={tasksList} />

                {/* Compute Resources Grid (Infrastructure) */}
                <ResourceGrid
                  resources={resourcesList.filter(r => r.status === 'online' || r.status === 'degraded')}
                  onTest={handleTest}
                  testingId={testingId}
                />

                {/* Recent Tasks Table */}
                <TaskTable
                  tasks={tasksList}
                  onSelect={setSelectedTask}
                  selectedId={selectedTask?.id ?? null}
                  projectNamesMap={projectNamesMap}
                  userNamesMap={userNamesMap}
                  onNavigateToResource={handleNavigateToResource}
                  onNavigateToUser={handleNavigateToUser}
                />
              </>
            )}

            {view === 'resources' && (
              <ResourcesView
                resources={resourcesList}
                onTest={handleTest}
                testingId={testingId}
                onNavigateToTask={handleNavigateToTask}
                initialSelectedResourceId={selectedResourceIdForCrossLink}
              />
            )}

            {view === 'tasks' && (
              <TasksView
                tasks={tasksList}
                onSelect={setSelectedTask}
                selectedId={selectedTask?.id ?? null}
                onRefresh={loadData}
                projectNamesMap={projectNamesMap}
                userNamesMap={userNamesMap}
                onNavigateToResource={handleNavigateToResource}
                onNavigateToUser={handleNavigateToUser}
              />
            )}

            {view === 'analytics' && (
              <AnalyticsView tasks={tasksList} projectNamesMap={projectNamesMap} />
            )}

            {view === 'services' && (
              <ServicesView
                onNavigate={setView}
                onSelectTask={setSelectedTask}
                tasksList={tasksList}
              />
            )}

            {view === 'settings' && (
              <Settings onConfigChange={handleConfigChange} />
            )}

            {view === 'incidents' && (
              <IncidentsView 
                tasks={tasksList} 
                usersList={usersList} 
                onNavigateToTask={handleNavigateToTask}
                onNavigateToResource={handleNavigateToResource}
                initialSelectedIncidentId={selectedIncidentIdForCrossLink}
              />
            )}

            {view === 'users' && (
              <UsersView
                tasks={tasksList}
                usersList={usersList}
                projectNamesMap={projectNamesMap}
                onSelectTask={setSelectedTask}
                onNavigateToTask={handleNavigateToTask}
                initialSelectedUserId={selectedUserIdForCrossLink}
              />
            )}

            {view !== 'dashboard' && view !== 'settings' && view !== 'resources' && view !== 'tasks' && view !== 'analytics' && view !== 'services' && view !== 'incidents' && view !== 'users' && (
              <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 p-10 text-center">
                <ShieldAlert className="h-10 w-10 text-accent-cyan animate-bounce" />
                <h3 className="mt-4 text-sm font-semibold text-text-main uppercase tracking-wider">
                  {view} Module
                </h3>
                <p className="mt-1 max-w-sm text-xs text-text-muted">
                  The {view} configuration system is connected. Inspect the active dashboard tab for live task graphs.
                </p>
              </div>
            )}
          </div>

          {/* Right sticky diagnostic terminal console */}
          <LogConsole task={selectedTask} />
        </div>

        {/* 3. Sticky Footer Status Bar */}
        <footer className="flex shrink-0 items-center justify-between border-t border-border-glass bg-bg-dark/90 px-6 py-3 font-sans text-xs text-text-muted select-none">
          <div className="flex items-center gap-6">
            {/* Uptime */}
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent-cyan" />
              <span>System uptime:</span>
              <span className="font-mono font-bold text-text-main">15d 6h 22m</span>
            </div>

            {/* Total Tasks */}
            <div className="flex items-center gap-2 border-l border-white/5 pl-6">
              <Database className="h-4 w-4 text-accent-purple" />
              <span>Total Tasks (Recent):</span>
              <span className="font-mono font-bold text-text-main">{tasksList.length}</span>
            </div>

            {/* Active Users */}
            <div className="flex items-center gap-2 border-l border-white/5 pl-6">
              <Users className="h-4 w-4 text-status-running" />
              <span>Active Users:</span>
              <span className="font-mono font-bold text-text-main">1</span>
            </div>
          </div>

          {/* API Status and Network graph sparkline */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-status-success" />
              <span>API Status:</span>
              <span className="font-bold text-status-success">Healthy</span>
            </div>
            {/* Animated network graph wave */}
            <div className="flex items-center shrink-0">
              <svg width="80" height="16" viewBox="0 0 80 16" className="overflow-visible">
                <path
                  d="M0 12 L10 8 L20 14 L30 4 L40 10 L50 2 L60 8 L70 4 L80 10"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-pulse"
                />
              </svg>
            </div>
          </div>
        </footer>

      </div>

      {/* Spotlight Global Search Modal Overlay */}
      {globalSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
          {/* Backdrop blur */}
          <div 
            onClick={() => setGlobalSearchOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300" 
          />
          
          {/* Spotlight Modal Box */}
          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#090d16]/95 p-4 shadow-2xl backdrop-blur-xl animate-slide-in">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-faint" />
              <input
                type="text"
                autoFocus
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                placeholder="Spotlight Search: Karst, App, Incidents, Niklas..."
                className="w-full rounded-xl border border-white/5 bg-white/[0.01] py-3 pl-11 pr-12 font-sans text-sm text-text-main placeholder:text-text-faint focus:border-accent-cyan/40 focus:outline-none focus:ring-1 focus:ring-accent-cyan/20 transition-all"
              />
              <button 
                onClick={() => setGlobalSearchOpen(false)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-faint hover:text-text-main border border-white/10 rounded px-1.5 py-0.5"
              >
                ESC
              </button>
            </div>

            {/* Results container */}
            <div className="mt-4 max-h-80 overflow-y-auto space-y-3">
              {globalSearchQuery.trim() === '' ? (
                <div className="text-center text-xs text-text-faint py-10">
                  <p>Type to search across resources, tasks, incidents, and users...</p>
                  <p className="mt-2 text-[10px] opacity-75">Try searching for <span className="text-accent-cyan select-all">"Karst"</span> or <span className="text-accent-purple select-all">"Niklas"</span></p>
                </div>
              ) : spotlightResults.length === 0 ? (
                <div className="text-center text-xs text-text-faint py-10">
                  No matching results found for "{globalSearchQuery}"
                </div>
              ) : (
                <div className="space-y-1">
                  {spotlightResults.map((res) => {
                    // icon helper
                    let IconComp = Server;
                    if (res.icon === 'terminal') IconComp = ListTodo;
                    else if (res.icon === 'alert-octagon') IconComp = AlertOctagon;
                    else if (res.icon === 'user') IconComp = Users;
                    else if (res.icon === 'layers') IconComp = Layers;
                    else if (res.icon === 'boxes') IconComp = Boxes;

                    return (
                      <div
                        key={res.id}
                        onClick={res.action}
                        className="flex items-center justify-between rounded-xl px-3.5 py-3 hover:bg-white/[0.03] border border-transparent hover:border-white/[0.04] cursor-pointer group transition-all duration-150"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                            res.category === 'Incident' ? 'bg-status-error/15 text-status-error' :
                            res.category === 'Resource' ? 'bg-status-warning/15 text-status-warning' :
                            res.category === 'User' ? 'bg-accent-purple/15 text-accent-purple' :
                            'bg-accent-cyan/15 text-accent-cyan'
                          }`}>
                            <IconComp className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-text-main group-hover:text-accent-cyan transition-colors">{res.title}</span>
                            {res.subtitle && (
                              <p className="text-[10px] text-text-faint truncate mt-0.5">{res.subtitle}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-white/5 border border-white/5 text-text-muted">
                          {res.category}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Spotlight Footer */}
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.04] pt-3 text-[9px] text-text-faint font-mono font-bold uppercase select-none">
              <span>Spotlight Search v1.0</span>
              <div className="flex gap-2">
                <span>↑↓ navigate</span>
                <span>⏎ select</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
