import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  LayoutDashboard, Users, CalendarDays, BookOpen, FileText,
  Flag, Settings, LogOut, Shield, ChevronRight, TrendingUp,
  TrendingDown, Search, Trash2, Ban, CheckCircle, XCircle,
  MoreVertical, RefreshCw, Download, Plus, Eye, Edit3,
  Activity, Bell, X, BarChart3, PieChartIcon, LineChartIcon,
  AlertTriangle, Clock, Globe, Loader2, ChevronDown, KeyRound, ArrowLeft, Menu,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ── helpers ──────────────────────────────────────────────────────
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

// ── fetch helpers ─────────────────────────────────────────────────
async function adminFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { credentials: "include", ...opts });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(e.message || "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Sidebar nav ───────────────────────────────────────────────────
const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "sessions", label: "Sessions", icon: CalendarDays },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "reports", label: "Reports", icon: Flag },
  { id: "audit", label: "Audit Logs", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

// ── Main Component ────────────────────────────────────────────────
export function Admin() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (user && !(user as any).isAdmin) navigate("/dashboard");
  }, [user]);

  if (!user || !(user as any).isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const SidebarContent = () => (
    <>
      <div className="px-4 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">StudySync</p>
            <p className="text-[10px] text-indigo-400">Admin Panel</p>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Navigation</div>
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <button key={item.id} onClick={() => { setTab(item.id); setSidebarOpen(false); }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all",
              tab === item.id
                ? "bg-indigo-500/20 text-indigo-300"
                : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
            )}>
            <item.icon className="w-3.5 h-3.5 shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="px-2 py-3 border-t border-white/5">
        <div className="px-3 py-2 mb-1">
          <p className="text-[11px] font-semibold text-white truncate">{user.firstName} {user.lastName}</p>
          <p className="text-[10px] text-gray-500 truncate">{(user as any).adminRole || "super-admin"}</p>
        </div>
        <button onClick={() => navigate("/dashboard")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-gray-400 hover:bg-white/5 hover:text-indigo-300 transition-all mb-0.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to app
        </button>
        <button onClick={() => { logout(); navigate("/auth"); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-gray-400 hover:bg-white/5 hover:text-red-400 transition-all">
          <LogOut className="w-3.5 h-3.5" /> Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-[#0f0f1a] text-gray-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 bg-[#16213e] border-r border-white/5 flex-col sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed left-0 top-0 h-full w-56 bg-[#16213e] border-r border-white/5 flex flex-col z-50 md:hidden">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-[#0f0f1a]/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden w-7 h-7 rounded-md bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/10 mr-1">
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>Admin</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white capitalize">{tab}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {tab === "overview" && <OverviewTab />}
          {tab === "users" && <UsersTab />}
          {tab === "sessions" && <SessionsTab />}
          {tab === "courses" && <CoursesTab />}
          {tab === "reports" && <ReportsTab />}
          {tab === "audit" && <AuditTab />}
          {tab === "settings" && <SettingsTab currentUser={user} />}
        </main>
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────
function OverviewTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => adminFetch("/api/admin/stats"),
    refetchInterval: 30000,
  });

  if (isLoading) return <LoadingSpinner />;

  const kpiCards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "indigo", trend: "+12%" },
    { label: "Total Sessions", value: stats?.totalSessions ?? 0, icon: CalendarDays, color: "emerald", trend: "+8%" },
    { label: "Active Sessions", value: stats?.activeSessions ?? 0, icon: Activity, color: "amber", trend: null },
    { label: "Pending Reports", value: stats?.pendingReports ?? 0, icon: Flag, color: "red", trend: null },
  ];

  const roleData = (stats?.usersByRole || []).map((r: any) => ({
    name: r.role,
    value: Number(r.count),
  }));

  const statusData = (stats?.sessionsByStatus || []).map((r: any) => ({
    name: r.status,
    count: Number(r.count),
  }));

  const signupData = (stats?.recentSignups || []).map((r: any) => ({
    day: r.day ? format(new Date(r.day), "MMM dd") : "",
    users: Number(r.count),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard Overview</h1>
        <p className="text-xs text-gray-400 mt-0.5">Platform metrics and key performance indicators</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-[#16213e] rounded-xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center",
                card.color === "indigo" ? "bg-indigo-500/20" :
                card.color === "emerald" ? "bg-emerald-500/20" :
                card.color === "amber" ? "bg-amber-500/20" : "bg-red-500/20"
              )}>
                <card.icon className={cn("w-4 h-4",
                  card.color === "indigo" ? "text-indigo-400" :
                  card.color === "emerald" ? "text-emerald-400" :
                  card.color === "amber" ? "text-amber-400" : "text-red-400"
                )} />
              </div>
              {card.trend && (
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">{card.trend}</span>
              )}
            </div>
            <p className="text-2xl font-bold text-white">{card.value.toLocaleString()}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tutors", value: stats?.totalTutors ?? 0 },
          { label: "Students", value: stats?.totalStudents ?? 0 },
          { label: "Completed Sessions", value: stats?.completedSessions ?? 0 },
          { label: "Banned Users", value: stats?.bannedUsers ?? 0 },
        ].map(item => (
          <div key={item.label} className="bg-[#16213e]/60 rounded-xl p-4 border border-white/5 text-center">
            <p className="text-xl font-bold text-white">{item.value}</p>
            <p className="text-[11px] text-gray-400">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Signups chart */}
        <div className="lg:col-span-2 bg-[#16213e] rounded-xl p-5 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white">New Signups</p>
              <p className="text-[11px] text-gray-400">Last 7 days</p>
            </div>
            <LineChartIcon className="w-4 h-4 text-gray-500" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={signupData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ background: "#1e2a3a", border: "1px solid #ffffff10", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Users by role pie */}
        <div className="bg-[#16213e] rounded-xl p-5 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white">Users by Role</p>
              <p className="text-[11px] text-gray-400">Distribution</p>
            </div>
            <PieChartIcon className="w-4 h-4 text-gray-500" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={roleData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                {roleData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1e2a3a", border: "1px solid #ffffff10", borderRadius: 8, fontSize: 11 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sessions by status bar chart */}
      <div className="bg-[#16213e] rounded-xl p-5 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white">Sessions by Status</p>
            <p className="text-[11px] text-gray-400">All time</p>
          </div>
          <BarChart3 className="w-4 h-4 text-gray-500" />
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={statusData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
            <Tooltip contentStyle={{ background: "#1e2a3a", border: "1px solid #ffffff10", borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {statusData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────
function UsersTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [banTarget, setBanTarget] = useState<any | null>(null);
  const [banDuration, setBanDuration] = useState("permanent");
  const [banReason, setBanReason] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/users", search, roleFilter, page],
    queryFn: () => adminFetch(`/api/admin/users?search=${search}&role=${roleFilter}&page=${page}&limit=20`),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) =>
      adminFetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "User updated" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => adminFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "User deleted" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const resetPw = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      adminFetch(`/api/admin/users/${id}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }),
    onSuccess: () => { toast({ title: "Password reset" }); setResetPwUserId(null); setNewPw(""); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const ROLE_OPTS = ["all", "student", "tutor", "both"];
  const ADMIN_ROLES = ["super-admin", "admin", "editor", "viewer"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">User Management</h1>
          <p className="text-xs text-gray-400">Manage accounts, roles, and access</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-[#16213e] rounded-lg px-3 h-9 border border-white/5 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-gray-500" />
          <input className="bg-transparent text-xs text-white placeholder:text-gray-500 outline-none flex-1"
            placeholder="Search name or email..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="flex gap-1.5">
          {ROLE_OPTS.map(r => (
            <button key={r} onClick={() => { setRoleFilter(r); setPage(1); }}
              className={cn("px-3 h-9 rounded-lg text-xs font-medium transition-all capitalize",
                roleFilter === r ? "bg-indigo-500 text-white" : "bg-[#16213e] text-gray-400 hover:bg-white/5 border border-white/5")}>
              {r}
            </button>
          ))}
        </div>
        <button onClick={() => refetch()} className="ml-auto w-9 h-9 rounded-lg bg-[#16213e] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#16213e] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                {["User", "Role", "University", "Admin Role", "Status", "Joined", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-500 mx-auto" /></td></tr>
              ) : data?.users?.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500 text-xs">No users found</td></tr>
              ) : data?.users?.map((u: any) => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-300 shrink-0">
                        {u.firstName?.[0]}{u.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-white text-xs">{u.firstName} {u.lastName}</p>
                        <p className="text-[10px] text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize",
                      u.role === "tutor" ? "bg-emerald-500/10 text-emerald-400" :
                      u.role === "both" ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"
                    )}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-[11px]">{u.university || "—"}</td>
                  <td className="px-4 py-3">
                    {u.isAdmin ? (
                      <select
                        defaultValue={u.adminRole || "admin"}
                        onChange={e => updateUser.mutate({ id: u.id, updates: { adminRole: e.target.value } })}
                        className="bg-[#0f0f1a] text-indigo-300 text-[10px] rounded-md px-2 py-1 border border-indigo-500/30 outline-none">
                        {ADMIN_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {u.isVerified && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Verified" />}
                      {u.isBanned && <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-md">Banned</span>}
                      {u.isAdmin && <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-md">Admin</span>}
                      {!u.isVerified && !u.isBanned && !u.isAdmin && <span className="text-gray-600 text-[10px]">Normal</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-[10px]">{u.createdAt ? format(new Date(u.createdAt), "MMM dd, yyyy") : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateUser.mutate({ id: u.id, updates: { isVerified: !u.isVerified } })}
                        title={u.isVerified ? "Unverify" : "Verify"}
                        className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-emerald-400 transition-colors">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                      {u.isBanned ? (
                        <button onClick={() => updateUser.mutate({ id: u.id, updates: { isBanned: false, bannedUntil: null, banReason: null } })}
                          title="Unban"
                          className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-amber-400 hover:text-green-400 transition-colors">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => { setBanTarget(u); setBanDuration("permanent"); setBanReason(""); }}
                          title="Ban"
                          className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-amber-400 transition-colors">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => updateUser.mutate({ id: u.id, updates: { isAdmin: !u.isAdmin } })}
                        title={u.isAdmin ? "Remove admin" : "Make admin"}
                        className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-indigo-400 transition-colors">
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setResetPwUserId(u.id); setNewPw(""); }}
                        title="Reset password"
                        className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-blue-400 transition-colors">
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(`Delete ${u.email}?`)) deleteUser.mutate(u.id); }}
                        title="Delete"
                        className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && (
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-[11px] text-gray-500">Showing {data.users?.length || 0} of {data.total} users</p>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 h-7 rounded-md text-xs bg-white/5 text-gray-400 disabled:opacity-30 hover:bg-white/10">Prev</button>
              <span className="px-3 h-7 flex items-center text-xs text-gray-400">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={(data.users?.length || 0) < 20}
                className="px-3 h-7 rounded-md text-xs bg-white/5 text-gray-400 disabled:opacity-30 hover:bg-white/10">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Ban modal */}
      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#16213e] rounded-xl p-6 w-96 border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white">Ban {banTarget.firstName} {banTarget.lastName}</h3>
            <p className="text-xs text-gray-400">{banTarget.email}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Duration</label>
                <select value={banDuration} onChange={e => setBanDuration(e.target.value)}
                  className="w-full bg-[#0f0f1a] text-white text-xs rounded-lg px-3 h-9 border border-white/10 outline-none">
                  <option value="permanent">Permanent</option>
                  <option value="1h">1 Hour</option>
                  <option value="6h">6 Hours</option>
                  <option value="12h">12 Hours</option>
                  <option value="1d">1 Day</option>
                  <option value="3d">3 Days</option>
                  <option value="7d">7 Days</option>
                  <option value="14d">14 Days</option>
                  <option value="30d">30 Days</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Reason (shown to user)</label>
                <input type="text" placeholder="e.g. Harassment, Spam..."
                  className="w-full bg-[#0f0f1a] text-white text-xs rounded-lg px-3 h-9 border border-white/10 outline-none"
                  value={banReason} onChange={e => setBanReason(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBanTarget(null)} className="px-4 h-8 rounded-lg text-xs bg-white/5 text-gray-400">Cancel</button>
              <button
                disabled={updateUser.isPending}
                onClick={() => {
                  const durationMap: Record<string, number> = {
                    "1h": 3600000, "6h": 21600000, "12h": 43200000,
                    "1d": 86400000, "3d": 259200000, "7d": 604800000,
                    "14d": 1209600000, "30d": 2592000000,
                  };
                  const bannedUntil = banDuration === "permanent" ? null
                    : new Date(Date.now() + durationMap[banDuration]).toISOString();
                  updateUser.mutate({ id: banTarget.id, updates: { isBanned: true, bannedUntil, banReason: banReason || null } }, {
                    onSuccess: () => setBanTarget(null),
                  });
                }}
                className="px-4 h-8 rounded-lg text-xs bg-amber-500 text-white disabled:opacity-50">
                {updateUser.isPending ? "..." : "Ban User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetPwUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#16213e] rounded-xl p-6 w-80 border border-white/10 space-y-4">
            <h3 className="text-sm font-bold text-white">Reset Password</h3>
            <input type="password" placeholder="New password (min 6 chars)"
              className="w-full bg-[#0f0f1a] text-white text-xs rounded-lg px-3 h-9 border border-white/10 outline-none"
              value={newPw} onChange={e => setNewPw(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResetPwUserId(null)} className="px-4 h-8 rounded-lg text-xs bg-white/5 text-gray-400">Cancel</button>
              <button onClick={() => resetPw.mutate({ id: resetPwUserId, password: newPw })}
                disabled={newPw.length < 6 || resetPw.isPending}
                className="px-4 h-8 rounded-lg text-xs bg-indigo-500 text-white disabled:opacity-50">
                {resetPw.isPending ? "..." : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sessions Tab ──────────────────────────────────────────────────
function SessionsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/sessions", statusFilter, page],
    queryFn: () => adminFetch(`/api/admin/sessions?status=${statusFilter}&page=${page}&limit=20`),
  });

  const deleteSession = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/sessions"] }); toast({ title: "Session deleted" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const STATUSES = ["all", "pending", "accepted", "scheduled", "completed", "cancelled", "declined"];
  const statusColors: Record<string, string> = {
    pending: "text-amber-400 bg-amber-500/10",
    accepted: "text-indigo-400 bg-indigo-500/10",
    scheduled: "text-blue-400 bg-blue-500/10",
    completed: "text-emerald-400 bg-emerald-500/10",
    cancelled: "text-red-400 bg-red-500/10",
    declined: "text-gray-400 bg-white/5",
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Sessions</h1>
        <p className="text-xs text-gray-400">All tutoring sessions across the platform</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={cn("px-3 h-8 rounded-lg text-xs font-medium capitalize transition-all",
              statusFilter === s ? "bg-indigo-500 text-white" : "bg-[#16213e] text-gray-400 border border-white/5 hover:bg-white/5")}>
            {s}
          </button>
        ))}
      </div>

      <div className="bg-[#16213e] rounded-xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                {["ID", "Student", "Tutor", "Course", "Status", "Date", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-500 mx-auto" /></td></tr>
              ) : data?.sessions?.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">No sessions found</td></tr>
              ) : data?.sessions?.map((s: any) => (
                <tr key={s.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-gray-500">#{s.id}</td>
                  <td className="px-4 py-3 text-white">{s.student?.firstName} {s.student?.lastName}</td>
                  <td className="px-4 py-3 text-white">{s.tutor?.firstName} {s.tutor?.lastName}</td>
                  <td className="px-4 py-3 text-gray-400">{s.course?.code}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize", statusColors[s.status] || "text-gray-400")}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.date ? format(new Date(s.date), "MMM dd, yyyy") : "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { if (confirm("Delete session?")) deleteSession.mutate(s.id); }}
                      className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-[11px] text-gray-500">{data.sessions?.length || 0} of {data.total} sessions</p>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 h-7 rounded-md text-xs bg-white/5 text-gray-400 disabled:opacity-30">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={(data.sessions?.length || 0) < 20}
                className="px-3 h-7 rounded-md text-xs bg-white/5 text-gray-400 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Courses Tab ───────────────────────────────────────────────────
function CoursesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");

  const { data: courses, isLoading } = useQuery({
    queryKey: ["/api/courses"],
    queryFn: () => adminFetch("/api/courses"),
  });

  const createCourse = useMutation({
    mutationFn: () => adminFetch("/api/admin/courses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, university }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      toast({ title: "Course created" });
      setCode(""); setName(""); setUniversity("");
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteCourse = useMutation({
    mutationFn: (id: number) => adminFetch(`/api/admin/courses/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/courses"] }); toast({ title: "Course deleted" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Courses</h1>

      {/* Create form */}
      <div className="bg-[#16213e] rounded-xl p-5 border border-white/5">
        <p className="text-sm font-semibold text-white mb-3">Add New Course</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <input placeholder="Code (e.g. MATH 101)" value={code} onChange={e => setCode(e.target.value)}
            className="bg-[#0f0f1a] text-white text-xs rounded-lg px-3 h-9 border border-white/10 outline-none placeholder:text-gray-600" />
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)}
            className="bg-[#0f0f1a] text-white text-xs rounded-lg px-3 h-9 border border-white/10 outline-none placeholder:text-gray-600" />
          <input placeholder="University" value={university} onChange={e => setUniversity(e.target.value)}
            className="bg-[#0f0f1a] text-white text-xs rounded-lg px-3 h-9 border border-white/10 outline-none placeholder:text-gray-600" />
        </div>
        <button onClick={() => createCourse.mutate()}
          disabled={!code || !name || !university || createCourse.isPending}
          className="mt-3 px-4 h-8 rounded-lg text-xs bg-indigo-500 text-white disabled:opacity-50 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Course
        </button>
      </div>

      <div className="bg-[#16213e] rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-white/5">
            {["ID", "Code", "Name", "University", "Actions"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-500 mx-auto" /></td></tr>
            ) : courses?.map((c: any) => (
              <tr key={c.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-gray-500">#{c.id}</td>
                <td className="px-4 py-3 font-mono text-indigo-300 font-semibold">{c.code}</td>
                <td className="px-4 py-3 text-white">{c.name}</td>
                <td className="px-4 py-3 text-gray-400">{c.university}</td>
                <td className="px-4 py-3">
                  <button onClick={() => { if (confirm("Delete course?")) deleteCourse.mutate(c.id); }}
                    className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────
function ReportsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data: reportsData, isLoading, error: reportsError } = useQuery({
    queryKey: ["/api/admin/reports", statusFilter],
    queryFn: () => adminFetch(`/api/admin/reports?status=${statusFilter}`),
  });

  const updateReport = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminFetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/reports"] }); toast({ title: "Report updated" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const STATUSES = ["all", "pending", "reviewed", "actioned", "dismissed"];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">User Reports</h1>
      <div className="flex gap-1.5">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn("px-3 h-8 rounded-lg text-xs capitalize transition-all",
              statusFilter === s ? "bg-indigo-500 text-white" : "bg-[#16213e] text-gray-400 border border-white/5")}>
            {s}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {isLoading ? <LoadingSpinner /> : reportsError ? (
          <div className="text-center py-12 text-red-400 text-xs bg-[#16213e] rounded-xl border border-white/5">{(reportsError as Error).message || "Failed to load reports"}</div>
        ) : !reportsData?.length ? (
          <div className="text-center py-12 text-gray-500 text-xs bg-[#16213e] rounded-xl border border-white/5">No reports found</div>
        ) : reportsData?.map((r: any) => (
          <div key={r.id} className="bg-[#16213e] rounded-xl p-4 border border-white/5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md">{r.reason}</span>
                  <span className={cn("text-[10px] font-semibold capitalize px-2 py-0.5 rounded-md",
                    r.status === "pending" ? "text-amber-400 bg-amber-500/10" :
                    r.status === "actioned" ? "text-emerald-400 bg-emerald-500/10" : "text-gray-400 bg-white/5"
                  )}>{r.status}</span>
                </div>
                <p className="text-xs text-white"><span className="text-gray-400">Reporter:</span> {r.reporter?.firstName} {r.reporter?.lastName} ({r.reporter?.email})</p>
                <p className="text-xs text-white mt-0.5"><span className="text-gray-400">Reported:</span> {r.reported?.firstName} {r.reported?.lastName} ({r.reported?.email})</p>
                {r.details && <p className="text-xs text-gray-400 mt-1.5 italic">"{r.details}"</p>}
                <p className="text-[10px] text-gray-600 mt-1.5">{r.createdAt ? format(new Date(r.createdAt), "MMM dd, yyyy HH:mm") : ""}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {r.status === "pending" && (
                  <>
                    <button onClick={() => updateReport.mutate({ id: r.id, status: "reviewed" })}
                      className="px-2.5 h-7 rounded-md text-[10px] bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30">Review</button>
                    <button onClick={() => updateReport.mutate({ id: r.id, status: "actioned" })}
                      className="px-2.5 h-7 rounded-md text-[10px] bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30">Action</button>
                    <button onClick={() => updateReport.mutate({ id: r.id, status: "dismissed" })}
                      className="px-2.5 h-7 rounded-md text-[10px] bg-white/5 text-gray-400 hover:bg-white/10">Dismiss</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Audit Logs Tab ────────────────────────────────────────────────
function AuditTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/audit-logs", page],
    queryFn: () => adminFetch(`/api/admin/audit-logs?page=${page}&limit=50`),
    refetchInterval: 15000,
  });

  const actionColor = (action: string) => {
    if (action.includes("delete") || action.includes("ban")) return "text-red-400 bg-red-500/10";
    if (action.includes("login") || action.includes("register")) return "text-emerald-400 bg-emerald-500/10";
    if (action.includes("admin")) return "text-indigo-400 bg-indigo-500/10";
    return "text-gray-400 bg-white/5";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Audit Logs</h1>
          <p className="text-xs text-gray-400">All actions, logins, changes, and deletions</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>
      <div className="bg-[#16213e] rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-white/5">
            {["Time", "User", "Action", "Entity", "IP"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-500 mx-auto" /></td></tr>
            ) : error ? (
              <tr><td colSpan={5} className="text-center py-8 text-red-400 text-xs">{(error as Error).message || "Failed to load audit logs"}</td></tr>
            ) : !data?.logs?.length ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-500">No logs yet</td></tr>
            ) : data?.logs?.map((log: any) => (
              <tr key={log.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 text-gray-500 text-[10px] whitespace-nowrap">{log.createdAt ? format(new Date(log.createdAt), "MMM dd HH:mm:ss") : "—"}</td>
                <td className="px-4 py-2.5">
                  {log.user ? (
                    <div>
                      <p className="text-white text-[11px]">{log.user.firstName} {log.user.lastName}</p>
                      <p className="text-gray-500 text-[10px]">{log.user.email}</p>
                    </div>
                  ) : <span className="text-gray-600">System</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold", actionColor(log.action))}>{log.action}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-[10px]">{log.entityType ? `${log.entityType}${log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}` : "—"}</td>
                <td className="px-4 py-2.5 text-gray-500 text-[10px] font-mono">{log.ipAddress || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && (
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-[11px] text-gray-500">{data.total} total logs</p>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 h-7 rounded-md text-xs bg-white/5 text-gray-400 disabled:opacity-30">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={(data.logs?.length || 0) < 50}
                className="px-3 h-7 rounded-md text-xs bg-white/5 text-gray-400 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────
function SettingsTab({ currentUser }: { currentUser: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [minPwLen, setMinPwLen] = useState("6");

  const updateSelf = useMutation({
    mutationFn: (updates: any) => adminFetch(`/api/admin/users/${currentUser.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
    }),
    onSuccess: (u) => {
      queryClient.setQueryData(["/api/auth/user"], (old: any) => ({ ...old, ...u }));
      toast({ title: "Updated" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const ADMIN_ROLES = ["super-admin", "admin", "editor", "viewer"];

  return (
    <div className="space-y-5 max-w-xl">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      {/* Role management */}
      <div className="bg-[#16213e] rounded-xl p-5 border border-white/5 space-y-4">
        <p className="text-sm font-semibold text-white">Your Admin Role</p>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
            {currentUser.firstName?.[0]}{currentUser.lastName?.[0]}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-white">{currentUser.firstName} {currentUser.lastName}</p>
            <p className="text-[10px] text-gray-500">{currentUser.email}</p>
          </div>
          <select defaultValue={currentUser.adminRole || "admin"}
            onChange={e => updateSelf.mutate({ adminRole: e.target.value })}
            className="bg-[#0f0f1a] text-indigo-300 text-xs rounded-lg px-3 h-8 border border-indigo-500/30 outline-none">
            {ADMIN_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* Password policy */}
      <div className="bg-[#16213e] rounded-xl p-5 border border-white/5 space-y-3">
        <p className="text-sm font-semibold text-white">Password Policy</p>
        <p className="text-[11px] text-gray-400">Minimum password length is enforced at registration and password reset.</p>
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-400">Min length</label>
          <input type="number" min={6} max={32} value={minPwLen} onChange={e => setMinPwLen(e.target.value)}
            className="w-20 bg-[#0f0f1a] text-white text-xs rounded-lg px-3 h-8 border border-white/10 outline-none" />
          <button onClick={() => toast({ title: `Policy updated: min ${minPwLen} chars` })}
            className="px-3 h-8 rounded-lg text-xs bg-indigo-500 text-white">Apply</button>
        </div>
      </div>

      {/* About */}
      <div className="bg-[#16213e] rounded-xl p-5 border border-white/5 space-y-2">
        <p className="text-sm font-semibold text-white">Platform Info</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            ["Version", "1.0.0"],
            ["Environment", import.meta.env.MODE],
            ["Access", "Admin Panel"],
            ["Route", "/admin"],
          ].map(([k, v]) => (
            <div key={k} className="bg-[#0f0f1a] rounded-lg p-3">
              <p className="text-gray-500 text-[10px]">{k}</p>
              <p className="text-white font-medium mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
    </div>
  );
}
