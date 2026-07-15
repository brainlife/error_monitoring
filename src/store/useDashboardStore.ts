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
  config?: any;
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
  projectsList: any[];
  instancesList: any[];
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
  tasksLimit: number;
  hasMoreTasks: boolean;
  loadMoreTasks: () => Promise<void>;
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
  projectsList: [],
  instancesList: [],
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
  tasksLimit: 50,
  hasMoreTasks: true,
  loadMoreTasks: async () => {
    const currentLimit = get().tasksLimit;
    set({ tasksLimit: currentLimit + 50 });
    await get().loadData();
  },

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
    let projects: any[] = [];
    let instances: any[] = [];

    try {
      const projectList = await fetchWarehouseProjects();
      console.log("[Warehouse Debug] Projects loaded count (pre-loader):", projectList.length);
      projects = projectList;
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
        group_id?: number;
      }
      const res = await apiFetch<any>('/instance?limit=1000&sort=-create_date');
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

    set({ projectNamesMap: map, projectsList: projects, instancesList: instances });
  },

  resolveVisibleProjectNames: async () => {
    const { isAuthenticated, tasksList, projectNamesMap, projectsList, instancesList } = get();
    if (!isAuthenticated || tasksList.length === 0) return;

    // Unique project IDs that are missing from projectNamesMap
    const uniqueProjectIds = Array.from(
      new Set(
        tasksList
          .map(t => t.realProjectId)
          .filter(id => id && id !== 'Unknown' && id !== 'Unknown Project' && !projectNamesMap[id])
      )
    ) as string[];

    // Unique instance IDs that are missing from projectNamesMap
    const uniqueInstanceIds = Array.from(
      new Set(
        tasksList
          .map(t => t.projectId)
          .filter(id => id && id !== 'Unknown' && !projectNamesMap[id])
      )
    ) as string[];

    if (uniqueProjectIds.length === 0 && uniqueInstanceIds.length === 0) return;

    console.log("[Warehouse Debug] Dynamically resolving missing projects/instances:", { uniqueProjectIds, uniqueInstanceIds });
    const newMappings: Record<string, string> = {};
    let newProjects: any[] = [];
    let newInstances: any[] = [];

    // 1. Resolve visible projects from warehouse
    if (uniqueProjectIds.length > 0) {
      try {
        const baseUrl = getApiUrl().replace(/\/amaretti\/?$/, '/warehouse');
        const token = getJwtToken();
        const headers = new Headers();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        const projQuery = JSON.stringify({ _id: { $in: uniqueProjectIds } });
        const projUrl = `${baseUrl}/project?find=${encodeURIComponent(projQuery)}&select=name%20desc&limit=100&admin=true`;
        const response = await fetch(projUrl, { headers });
        if (response.ok) {
          const data = await response.json();
          const list = data.projects || data.results || data || [];
          if (Array.isArray(list)) {
            console.log("[Warehouse Debug] Resolved missing projects count:", list.length);
            newProjects = list;
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
    }

    // 2. Resolve visible instances from amaretti (to map instance_id to its process name if any)
    if (uniqueInstanceIds.length > 0) {
      try {
        const instQuery = JSON.stringify({ _id: { $in: uniqueInstanceIds } });
        const res = await apiFetch<any>(`/instance?find=${encodeURIComponent(instQuery)}&limit=100`);
        const list = res.instances || res.results || res || [];
        if (Array.isArray(list)) {
          console.log("[Warehouse Debug] Resolved missing instances count:", list.length);
          newInstances = list;
          list.forEach((inst: any) => {
            if (inst._id && inst.name) {
              newMappings[inst._id] = inst.name;
            }
          });
        }
      } catch (err) {
        console.error('Failed to resolve visible instances from amaretti:', err);
      }
    }

    if (Object.keys(newMappings).length > 0 || newProjects.length > 0 || newInstances.length > 0) {
      console.log("[Warehouse Debug] Applying new dynamic mappings, projects and instances:", Object.keys(newMappings).length, newProjects.length, newInstances.length);
      set({
        projectNamesMap: {
          ...projectNamesMap,
          ...newMappings
        },
        projectsList: [
          ...projectsList,
          ...newProjects.filter(p => !projectsList.some(existing => existing._id === p._id))
        ],
        instancesList: [
          ...instancesList,
          ...newInstances.filter(i => !instancesList.some(existing => existing._id === i._id))
        ]
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

      // 2. Fetch live tasks (limit to dynamic tasksLimit)
      const currentLimit = get().tasksLimit || 50;
      const queryParams = new URLSearchParams({
        limit: currentLimit.toString(),
        sort: '-create_date'
      });
      const taskRes = await apiFetch<{ tasks: BackendTask[] }>(`/task?${queryParams}`);
      const backendTasks = taskRes.tasks || [];
      set({ hasMoreTasks: backendTasks.length === currentLimit });
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

        // Extract project ID from config._outputs or config._inputs
        let realProjectId = 'Unknown';
        if (t.config) {
          if (Array.isArray(t.config._outputs)) {
            const out = t.config._outputs.find((o: any) => o && o.archive && o.archive.project);
            if (out) {
              realProjectId = out.archive.project;
            }
          }
          if (realProjectId === 'Unknown' && Array.isArray(t.config._inputs)) {
            const inp = t.config._inputs.find((i: any) => i && i.project);
            if (inp) {
              realProjectId = inp.project;
            }
          }
        }

        return {
          id: t._id,
          service: t.service,
          projectId: t.instance_id || 'Unknown',
          realProjectId,
          resource: resourceName,
          status,
          runtime: resourceName,
          startedAt,
          duration,
          message: t.status_msg || '',
          startDate: t.start_date || t.create_date,
          finishDate: t.finish_date,
          userId: t.user_id ? t.user_id.toString() : 'Unknown',
          createDate: t.create_date
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
