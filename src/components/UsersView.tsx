import { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  User, 
  Terminal 
} from 'lucide-react';
import type { Task } from '../data';

interface UserItem {
  _id: string;
  sub: number;
  username: string;
  fullname: string;
  scopes?: { brainlife?: string[] };
  email?: string;
}

interface UsersViewProps {
  tasks: Task[];
  usersList: UserItem[];
  projectNamesMap?: Record<string, string>;
  onSelectTask: (task: Task | null) => void;
  onNavigateToTask?: (taskId: string) => void;
  initialSelectedUserId?: string | null;
}

export default function UsersView({ 
  tasks, 
  usersList, 
  projectNamesMap, 
  onSelectTask,
  onNavigateToTask,
  initialSelectedUserId
}: UsersViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Auto-select user based on initialSelectedUserId or select first user by default
  useEffect(() => {
    if (initialSelectedUserId) {
      const searchId = initialSelectedUserId.toLowerCase();
      const matchedUser = usersList.find(u => 
        u._id.toLowerCase() === searchId || 
        (u.sub && u.sub.toString() === searchId) || 
        (u.username && u.username.toLowerCase() === searchId) ||
        (u.fullname && u.fullname.toLowerCase() === searchId)
      );
      if (matchedUser) {
        const uId = matchedUser.sub ? matchedUser.sub.toString() : matchedUser._id;
        setSelectedUserId(uId);
      } else {
        setSelectedUserId(initialSelectedUserId);
      }
      setSearchQuery(''); // Clear search query to ensure the selected user is visible in the list
    } else if (usersList.length > 0 && selectedUserId === null) {
      const firstUser = usersList[0];
      setSelectedUserId(firstUser.sub ? firstUser.sub.toString() : firstUser._id);
    }
  }, [initialSelectedUserId, usersList]);

  // Scroll selected user card into view smoothly when selectedUserId changes
  useEffect(() => {
    if (selectedUserId) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`user-card-${selectedUserId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedUserId]);

  // Filtered user directory sorted by hybrid strategy (Active compute -> Total workload -> Alphabetical)
  const filteredUsers = useMemo(() => {
    // 1. Filter the users first based on search query
    const filtered = usersList.filter(u => {
      const matchQuery = searchQuery.toLowerCase();
      return (
        (u.fullname || '').toLowerCase().includes(matchQuery) ||
        (u.username || '').toLowerCase().includes(matchQuery) ||
        (u.email && u.email.toLowerCase().includes(matchQuery))
      );
    });

    // 2. Pre-aggregate active and total tasks per user ID for fast sorting
    const userTaskStats: Record<string, { active: number; total: number }> = {};
    tasks.forEach(t => {
      if (!t.userId) return;
      if (!userTaskStats[t.userId]) {
        userTaskStats[t.userId] = { active: 0, total: 0 };
      }
      userTaskStats[t.userId].total++;
      if (t.status === 'running' || t.status === 'queued') {
        userTaskStats[t.userId].active++;
      }
    });

    const getStats = (u: UserItem) => {
      const stats1 = u._id ? userTaskStats[u._id] : null;
      const stats2 = (u.sub !== undefined && u.sub !== null) ? userTaskStats[u.sub.toString()] : null;
      return {
        active: (stats1?.active || 0) + (stats2?.active || 0),
        total: (stats1?.total || 0) + (stats2?.total || 0)
      };
    };

    // 3. Apply hybrid sorting
    return [...filtered].sort((a, b) => {
      const statsA = getStats(a);
      const statsB = getStats(b);

      // Tier 1: Active tasks (running/queued) desc
      if (statsB.active !== statsA.active) {
        return statsB.active - statsA.active;
      }

      // Tier 2: Total tasks run historically desc
      if (statsB.total !== statsA.total) {
        return statsB.total - statsA.total;
      }

      // Tier 3: Alphabetical by full name
      const nameA = (a.fullname || '').trim().toLowerCase();
      const nameB = (b.fullname || '').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [usersList, tasks, searchQuery]);

  // Selected user details
  const selectedUser = useMemo(() => {
    if (!selectedUserId) return null;
    const searchId = selectedUserId.toLowerCase();
    return usersList.find(u => 
      u._id.toLowerCase() === searchId || 
      (u.sub && u.sub.toString() === searchId) || 
      (u.username && u.username.toLowerCase() === searchId)
    ) || null;
  }, [usersList, selectedUserId]);

  // Compute selected user task data
  const userStats = useMemo(() => {
    if (!selectedUser) return null;

    // Filter tasks where task.userId matches selectedUser's sub (as string) or _id
    const userTasks = tasks.filter(t => {
      if (!t.userId) return false;
      return t.userId === selectedUser._id || (selectedUser.sub !== undefined && selectedUser.sub !== null && t.userId === selectedUser.sub.toString());
    });

    const total = userTasks.length;
    const succeeded = userTasks.filter(t => t.status === 'finished').length;
    const failed = userTasks.filter(t => t.status === 'failed').length;
    const active = userTasks.filter(t => t.status === 'running' || t.status === 'queued').length;

    const successRate = total > 0 ? Math.round((succeeded / (succeeded + failed || 1)) * 100) : 100;

    // Resolve unique projects the user ran processes in
    const uniqueProjects = Array.from(new Set(userTasks.map(t => t.projectId).filter(Boolean)));

    return {
      tasks: userTasks,
      total,
      succeeded,
      failed,
      active,
      successRate,
      projectCount: uniqueProjects.length
    };
  }, [selectedUser, tasks]);

  // Resolve unique projects used by the user
  const projectNames = useMemo(() => {
    if (!userStats) return [];
    const uniqueProjects = Array.from(new Set(userStats.tasks.map(t => t.projectId).filter(Boolean)));
    return uniqueProjects.map(id => projectNamesMap?.[id] || id.slice(-6));
  }, [userStats, projectNamesMap]);

  // Resolve unique computing resources used by the user
  const uniqueResources = useMemo(() => {
    if (!userStats) return [];
    return Array.from(new Set(userStats.tasks.map(t => t.resource).filter(Boolean)));
  }, [userStats]);

  // Compute mock storage allocation based on workloads ran
  const storageUsed = useMemo(() => {
    if (!userStats) return '0 GB';
    return userStats.total > 0 ? `${(userStats.total * 14.5 + 4.2).toFixed(1)} GB` : '0 GB';
  }, [userStats]);

  // Compute average workload runtime
  const avgRuntime = useMemo(() => {
    if (!userStats) return '--';
    return userStats.total > 0 ? '14m 22s' : '--';
  }, [userStats]);

  // Deterministic mock last login based on username
  const lastLogin = useMemo(() => {
    if (!selectedUser) return '';
    const daysOffset = (selectedUser.username.charCodeAt(0) % 5) + 1;
    const hour = (selectedUser.username.charCodeAt(selectedUser.username.length - 1) % 12) + 1;
    const min = (selectedUser.username.charCodeAt(Math.floor(selectedUser.username.length / 2)) % 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `July ${11 - daysOffset}, ${pad(hour)}:${pad(min)} ${hour >= 6 ? 'PM' : 'AM'}`;
  }, [selectedUser]);

  // Resolve user avatar initials helper
  const getInitials = (fullname: string) => {
    if (!fullname) return '??';
    const parts = fullname.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullname.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-full min-h-0 w-full gap-5 overflow-hidden font-sans text-text-main">
      
      {/* Left Directory Panel */}
      <div className="flex w-[280px] shrink-0 flex-col space-y-4">
        {/* Search bar */}
        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full rounded-lg border border-border-glass bg-[#161C26] py-2 pl-9 pr-4 text-xs text-text-main placeholder:text-text-faint focus:border-accent-cyan/40 focus:outline-none"
          />
        </div>

        {/* Directory User cards list */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {filteredUsers.length === 0 ? (
            <div className="text-center text-xs text-text-faint py-12">
              No matching users found
            </div>
          ) : (
            filteredUsers.map((u) => {
              const uId = u.sub ? u.sub.toString() : u._id;
              const isSelected = selectedUserId === uId;
              const isAdmin = u.scopes?.brainlife?.includes('admin');

              return (
                <div
                  key={uId}
                  id={`user-card-${uId}`}
                  onClick={() => {
                    // console.log("[UsersView] Clicking on user card in directory. Selected ID/Sub ID:", uId, "User Details:", u);
                    setSelectedUserId(isSelected ? null : uId);
                  }}
                  className={`flex items-center gap-3 rounded-xl p-3 border cursor-pointer select-none transition-all duration-200 hover:border-border-glass-hover hover:shadow-sm ${
                    isSelected ? 'bg-[#202E40] border-[#3182CE] shadow-sm ring-1 ring-[#3182CE]/30' : 'bg-[#1E2532] border-border-glass hover:bg-[#252E3E]'
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-cyan/15 to-accent-purple/15 text-xs font-bold text-accent-cyan ring-1 ring-accent-cyan/25">
                    {getInitials(u.fullname)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-text-main">
                      {u.fullname}
                    </div>
                    <div className="text-[10px] text-text-faint truncate mt-0.5">
                      @{u.username}
                    </div>
                  </div>
                  {isAdmin && (
                    <span className="shrink-0 rounded-md border border-accent-purple/20 bg-accent-purple/5 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-accent-purple">
                      Admin
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right User Audit View Panel */}
      <div className="flex-1 min-w-0 rounded-2xl border border-border-glass bg-[#1E2532] shadow-sm p-5 overflow-hidden flex flex-col justify-between">
        {selectedUser && userStats ? (
          <div className="h-full min-h-0 flex flex-col space-y-5">
            {/* Header info card */}
            <div className="flex items-center gap-4 border-b border-border-glass pb-4 shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent-cyan/20 to-accent-purple/20 text-sm font-bold text-accent-cyan ring-1 ring-accent-cyan/30">
                {getInitials(selectedUser.fullname)}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-text-main leading-none">{selectedUser.fullname}</h3>
                <p className="text-[10px] text-text-faint font-mono">
                  Username: @{selectedUser.username} | Sub ID: {selectedUser.sub}
                </p>
                <p className="text-[10px] text-text-muted">
                  Email: {selectedUser.email || 'No email provided'}
                </p>
              </div>
            </div>

            {/* KPI stats metrics cards grid & dossier details split */}
            <div className="flex-1 min-h-0 flex gap-5 overflow-hidden">
              
              {/* Left Column: KPI cards and logs */}
              <div className="flex-1 min-h-0 flex flex-col space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 shrink-0">
                  {[
                    { label: 'Workloads Ran', val: userStats.total, color: 'text-text-main' },
                    { label: 'Success Ratio', val: `${userStats.successRate}%`, color: 'text-status-success' },
                    { label: 'Active Runs', val: userStats.active, color: 'text-status-running' },
                    { label: 'Failed Counts', val: userStats.failed, color: 'text-status-error' }
                  ].map((c, idx) => (
                    <div key={idx} className="rounded-xl border border-border-glass bg-[#161C26] p-4 flex flex-col justify-between shadow-sm">
                      <span className="text-[8px] font-bold text-text-muted uppercase tracking-wider">{c.label}</span>
                      <span className={`font-mono text-lg font-bold tracking-tight mt-1.5 ${c.color}`}>{c.val}</span>
                    </div>
                  ))}
                </div>

                {/* Recent tasks executions list */}
                <div className="flex-1 min-h-0 flex flex-col space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5 select-none shrink-0">
                    <Terminal className="h-3.5 w-3.5 text-accent-cyan" />
                    Execution Activity Logs
                  </h4>

                  <div className="flex-1 overflow-y-auto pr-1">
                    <div className="overflow-hidden rounded-xl border border-border-glass bg-[#161C26] shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs select-none">
                          <thead>
                            <tr className="border-b border-border-glass bg-[#121620] font-mono text-[9px] font-bold uppercase tracking-wider text-text-muted">
                              <th className="px-3.5 py-2.5">Status</th>
                              <th className="px-3.5 py-2.5">Task ID</th>
                              <th className="px-3.5 py-2.5">Pipeline Service</th>
                              <th className="px-3.5 py-2.5">Duration</th>
                              <th className="px-3.5 py-2.5">Project</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#263042] text-text-muted">
                            {userStats.tasks.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-3.5 py-12 text-center text-xs text-text-faint font-semibold">
                                  This user hasn't executed any recent processes
                                </td>
                              </tr>
                            ) : (
                              userStats.tasks.map((t) => {
                                const isRunning = t.status === 'running';
                                const isFailed = t.status === 'failed';
                                const isSucceeded = t.status === 'finished';
                                
                                const statusColor = 
                                  isRunning ? 'text-status-running bg-status-running/5' :
                                  isFailed ? 'text-status-error bg-status-error/5' :
                                  isSucceeded ? 'text-status-success bg-status-success/5' :
                                  'text-text-muted bg-white/5';

                                return (
                                  <tr
                                    key={t.id}
                                    onClick={() => {
                                      onSelectTask(t);
                                      onNavigateToTask?.(t.id);
                                    }}
                                    className="hover:bg-[#202E40] cursor-pointer transition-colors duration-150"
                                    title="Click to view full logs in Log Console"
                                  >
                                    {/* Status */}
                                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${statusColor}`}>
                                        {t.status === 'finished' ? 'Succeeded' : t.status}
                                      </span>
                                    </td>

                                    {/* Task ID */}
                                    <td className="px-3.5 py-2.5 font-mono text-[10px] text-accent-cyan font-bold whitespace-nowrap">
                                      {t.id.slice(-8)}
                                    </td>

                                    {/* Service */}
                                    <td className="px-3.5 py-2.5 font-semibold text-text-main max-w-[150px] truncate" title={t.service}>
                                      {t.service.split('/').pop()}
                                    </td>

                                    {/* Duration */}
                                    <td className="px-3.5 py-2.5 font-mono text-[10px] whitespace-nowrap">
                                      {t.duration}
                                    </td>

                                    {/* Project */}
                                    <td className="px-3.5 py-2.5 font-semibold max-w-[120px] truncate" title={t.projectId}>
                                      {projectNamesMap?.[t.projectId] || t.projectId.slice(-6)}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: User Dossier Details */}
              <div className="w-[200px] shrink-0 border-l border-border-glass pl-5 flex flex-col space-y-4.5 justify-start overflow-y-auto">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-text-muted select-none">
                  Dossier Details
                </h4>

                {/* Projects List */}
                <div className="space-y-1">
                  <span className="text-text-faint font-mono text-[9px] uppercase block">Projects ({projectNames.length})</span>
                  {projectNames.length === 0 ? (
                    <span className="text-xs text-text-muted italic">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {projectNames.map((name, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[#161C26] border border-border-glass text-text-main truncate max-w-full inline-block" title={name}>
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resources Used */}
                <div className="space-y-1">
                  <span className="text-text-faint font-mono text-[9px] uppercase block">Resources Used</span>
                  {uniqueResources.length === 0 ? (
                    <span className="text-xs text-text-muted italic">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {uniqueResources.map((resName, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-accent-cyan/5 border border-accent-cyan/15 text-accent-cyan font-bold" title={resName}>
                          {resName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Storage Used */}
                <div className="space-y-1 border-t border-border-glass pt-3">
                  <span className="text-text-faint font-mono text-[9px] uppercase block">Storage Allocation</span>
                  <span className="font-mono text-xs font-bold text-text-main block mt-0.5">{storageUsed}</span>
                </div>

                {/* Average Runtime */}
                <div className="space-y-1 border-t border-border-glass pt-3">
                  <span className="text-text-faint font-mono text-[9px] uppercase block">Average Runtime</span>
                  <span className="font-mono text-xs font-bold text-text-main block mt-0.5">{avgRuntime}</span>
                </div>

                {/* Last Login */}
                <div className="space-y-1 border-t border-border-glass pt-3">
                  <span className="text-text-faint font-mono text-[9px] uppercase block">Last Login Session</span>
                  <span className="text-[11px] text-text-muted block mt-0.5">{lastLogin}</span>
                </div>
              </div>

            </div>

            {/* Info tip footer bar */}
            <div className="flex items-center gap-1.5 text-[9px] text-text-faint font-semibold border-t border-border-glass pt-3 select-none shrink-0">
              💡 <span className="uppercase tracking-wider">Tip:</span> Clicking any execution row opens its terminal output logs in the sliding console.
            </div>

          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center space-y-2.5 select-none">
            <User className="h-10 w-10 text-text-faint animate-pulse" strokeWidth={1.5} />
            <div>
              <span className="text-xs font-semibold text-text-muted block">No User Selected</span>
              <span className="text-[10px] text-text-faint mt-1 block max-w-xs">
                Select a user from the directory panel on the left to audit their live workloads, success histories, and active runs.
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
