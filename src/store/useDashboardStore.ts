import { create } from 'zustand';
import { type View } from '../components/Sidebar';
import { type Task, type ComputeResource } from '../data';
import {
  apiFetch,
  getApiUrl,
  getJwtToken,
  getUserProfile,
  logout as apiLogout,
  setJwtToken,
  fetchWarehouseProjects,
  fetchAuthUsers,
  type UserProfile
} from '../api';

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

export interface DashboardState {
  view: View;
  tasksList: Task[];
  resourcesList: ComputeResource[];
  selectedTask: Task | null;
  testingId: string | null;
  loading: boolean;
  configVersion: number;
  projectNamesMap: Record<string, string>;
  userNamesMap: Record<string, string>;
  usersList: { _id: string; sub: number; username: string; fullname: string; email?: string; scopes?: { brainlife?: string[] } }[];
  globalSearchOpen: boolean;
  globalSearchQuery: string;
  user: UserProfile | null;
  isAuthenticated: boolean;
  logSearchResults: any[];
  spotlightSearching: boolean;
  selectedResourceIdForCrossLink: string | null;
  selectedUserIdForCrossLink: string | null;
  selectedIncidentIdForCrossLink: string | null;

  setView: (view: View) => void;
  setTasksList: (tasks: Task[]) => void;
  setResourcesList: (resources: ComputeResource[]) => void;
  setSelectedTask: (task: Task | null) => void;
  setTestingId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setConfigVersion: (version: number) => void;
  setProjectNamesMap: (map: Record<string, string>) => void;
  setUserNamesMap: (map: Record<string, string>) => void;
  setUsersList: (users: any[]) => void;
  setGlobalSearchOpen: (open: boolean) => void;
  setGlobalSearchQuery: (query: string) => void;
  setUser: (user: UserProfile | null) => void;
  setIsAuthenticated: (auth: boolean) => void;
  setLogSearchResults: (results: any[]) => void;
  setSpotlightSearching: (searching: boolean) => void;
  setSelectedResourceIdForCrossLink: (id: string | null) => void;
  setSelectedUserIdForCrossLink: (id: string | null) => void;
  setSelectedIncidentIdForCrossLink: (id: string | null) => void;

  handleNavigateToTask: (taskId: string) => void;
  handleNavigateToResource: (resourceName: string) => void;
  handleNavigateToUser: (userId: string) => void;
  handleNavigateToIncident: (incidentId: string) => void;

  loadData: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadUsers: () => Promise<void>;
  resolveVisibleProjectNames: () => Promise<void>;
  handleConfigChange: () => void;
  handleLoginSuccess: () => void;
  handleLogout: () => void;
  handleTest: (id: string) => void;
  checkSSORedirect: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  view: 'dashboard',
  tasksList: [],
  resourcesList: [],
  selectedTask: null,
  testingId: null,
  loading: true,
  configVersion: 0,
  projectNamesMap: {},
  userNamesMap: {},
  usersList: [],
  globalSearchOpen: false,
  globalSearchQuery: '',
  user: getUserProfile(),
  isAuthenticated: !!getJwtToken() && !!getUserProfile(),
  logSearchResults: [],
  spotlightSearching: false,
  selectedResourceIdForCrossLink: null,
  selectedUserIdForCrossLink: null,
  selectedIncidentIdForCrossLink: null,

  setView: (view) => set({ view }),
  setTasksList: (tasksList) => set({ tasksList }),
  setResourcesList: (resourcesList) => set({ resourcesList }),
  setSelectedTask: (selectedTask) => set({ selectedTask }),
  setTestingId: (testingId) => set({ testingId }),
  setLoading: (loading) => set({ loading }),
  setConfigVersion: (configVersion) => set({ configVersion }),
  setProjectNamesMap: (projectNamesMap) => set({ projectNamesMap }),
  setUserNamesMap: (userNamesMap) => set({ userNamesMap }),
  setUsersList: (usersList) => set({ usersList }),
  setGlobalSearchOpen: (globalSearchOpen) => set({ globalSearchOpen }),
  setGlobalSearchQuery: (globalSearchQuery) => set({ globalSearchQuery }),
  setUser: (user) => set({ user }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setLogSearchResults: (logSearchResults) => set({ logSearchResults }),
  setSpotlightSearching: (spotlightSearching) => set({ spotlightSearching }),
  setSelectedResourceIdForCrossLink: (selectedResourceIdForCrossLink) => set({ selectedResourceIdForCrossLink }),
  setSelectedUserIdForCrossLink: (selectedUserIdForCrossLink) => set({ selectedUserIdForCrossLink }),
  setSelectedIncidentIdForCrossLink: (selectedIncidentIdForCrossLink) => set({ selectedIncidentIdForCrossLink }),

  handleNavigateToTask: (taskId) => {
    const { tasksList } = get();
    const taskObj = tasksList.find(t => t.id === taskId);
    set({
      selectedTask: taskObj || null,
      view: 'tasks'
    });
  },
  handleNavigateToResource: (resourceName) => {
    set({
      selectedResourceIdForCrossLink: resourceName,
      view: 'resources'
    });
  },
  handleNavigateToUser: (userId) => {
    set({
      selectedUserIdForCrossLink: userId,
      view: 'users'
    });
  },
  handleNavigateToIncident: (incidentId) => {
    set({
      selectedIncidentIdForCrossLink: incidentId,
      view: 'incidents'
    });
  },

  loadProjects: async () => {
    const { isAuthenticated } = get();
    if (!isAuthenticated) return;
    const map: Record<string, string> = {};

    try {
      const projectList = await fetchWarehouseProjects();
      console.log("[Warehouse Debug] Projects loaded count (pre-loader):", projectList.length);
      projectList.forEach(p => {
        if (p._id) {
          map[p._id] = p.name;
        }
      });
    } catch (err) {
      console.error('Failed to load warehouse projects:', err);
    }

    try {
      interface AmarettiInstance {
        _id: string;
        name?: string;
      }
      const res = await apiFetch<any>('/instance?limit=1000&sort=-create_date');
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
      console.log("[Warehouse Debug] Instances loaded count (pre-loader):", instances.length);
      instances.forEach(inst => {
        if (inst._id && inst.name) {
          map[inst._id] = inst.name;
        }
      });
    } catch (err) {
      console.error('Failed to load Amaretti instances:', err);
    }

    set({ projectNamesMap: map });
  },

  resolveVisibleProjectNames: async () => {
    const { isAuthenticated, tasksList, projectNamesMap } = get();
    if (!isAuthenticated || tasksList.length === 0) return;

    const uniqueIds = Array.from(
      new Set(
        tasksList
          .map(t => t.projectId)
          .filter(id => id && id !== 'Unknown' && !projectNamesMap[id])
      )
    );
    if (uniqueIds.length === 0) return;

    console.log("[Warehouse Debug] Dynamically resolving visible projects/instances:", uniqueIds);
    const newMappings: Record<string, string> = {};

    try {
      const baseUrl = getApiUrl().replace(/\/amaretti\/?$/, '/warehouse');
      const token = getJwtToken();
      const headers = new Headers();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const projQuery = JSON.stringify({ _id: { $in: uniqueIds } });
      const projUrl = `${baseUrl}/project?find=${encodeURIComponent(projQuery)}&limit=100&admin=true`;
      const response = await fetch(projUrl, { headers });
      if (response.ok) {
        const data = await response.json();
        const list = data.projects || data.results || data || [];
        if (Array.isArray(list)) {
          console.log("[Warehouse Debug] Resolved projects count:", list.length);
          list.forEach((p: any) => {
            if (p._id && p.name) {
              newMappings[p._id] = p.name;
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to resolve visible projects from warehouse:', err);
    }

    try {
      const instQuery = JSON.stringify({ _id: { $in: uniqueIds } });
      const res = await apiFetch<any>(`/instance?find=${encodeURIComponent(instQuery)}&limit=100`);
      const list = res.instances || res.results || res || [];
      if (Array.isArray(list)) {
        console.log("[Warehouse Debug] Resolved instances count:", list.length);
        list.forEach((inst: any) => {
          if (inst._id && inst.name) {
            newMappings[inst._id] = inst.name;
          }
        });
      }
    } catch (err) {
      console.error('Failed to resolve visible instances from amaretti:', err);
    }

    if (Object.keys(newMappings).length > 0) {
      console.log("[Warehouse Debug] Applying new dynamic mappings:", newMappings);
      set({
        projectNamesMap: {
          ...projectNamesMap,
          ...newMappings
        }
      });
    }
  },

  loadUsers: async () => {
    const { isAuthenticated } = get();
    if (!isAuthenticated) return;
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
      set({
        userNamesMap: map,
        usersList: list
      });
    } catch (err) {
      console.error('Failed to load auth users:', err);
    }
  },

  loadData: async () => {
    const { isAuthenticated, selectedTask } = get();
    if (!isAuthenticated) return;

    try {
      // Avoid flash loading state on subsequent poll loads by preserving list size check
      const { tasksList } = get();
      if (tasksList.length === 0) {
        set({ loading: true });
      }

      // 1. Fetch live compute resources
      const resourceRes = await apiFetch<{ resources: BackendResource[] }>('/resource');
      const backendResources = resourceRes.resources || [];
      const mappedResources: ComputeResource[] = backendResources.map(r => {
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
      set({ resourcesList: mappedResources });

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
      const mappedTasks: Task[] = backendTasks.map(t => {
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

      set({ tasksList: mappedTasks });

      // Auto-select the first task if nothing is currently selected
      if (mappedTasks.length > 0) {
        let newSelected = selectedTask;
        if (selectedTask && mappedTasks.some(t => t.id === selectedTask.id)) {
          newSelected = mappedTasks.find(t => t.id === selectedTask.id) || null;
        } else {
          newSelected = mappedTasks[0];
        }
        set({ selectedTask: newSelected });
      }
    } catch (error) {
      console.error('Failed to load dashboard metrics from backend API:', error);
    } finally {
      set({ loading: false });
    }
  },

  handleConfigChange: () => set((state) => ({ configVersion: state.configVersion + 1 })),
  handleLoginSuccess: () => {
    set({
      user: getUserProfile(),
      isAuthenticated: true
    });
  },
  handleLogout: () => {
    apiLogout();
    set({
      user: null,
      isAuthenticated: false,
      view: 'dashboard'
    });
  },
  handleTest: (id) => {
    set({ testingId: id });
    setTimeout(() => {
      if (get().testingId === id) {
        set({ testingId: null });
      }
    }, 2000);
  },

  checkSSORedirect: () => {
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
        set({
          user: userProfile,
          isAuthenticated: true
        });
      } catch (err) {
        console.error('Failed to decode SSO JWT payload:', err);
      }

      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }
}));
