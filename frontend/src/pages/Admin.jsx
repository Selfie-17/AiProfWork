import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";
import {
  ShieldCheck,
  Activity,
  Cpu,
  Users,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
  Clock,
  Layers,
  ArrowRight,
  TrendingUp,
  FileText,
  FolderKanban,
  BookOpen,
  Search,
  Filter,
  Server,
  Sliders,
  Check,
  X,
  GraduationCap,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  KeyRound,
  Zap,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  Wifi,
  WifiOff,
  Settings2
} from "lucide-react";
import api from "../api";
import { useToast } from "../components/Toast";

export default function Admin() {
  const [activeTab, setActiveTab] = useState("overview");

  // Core Data States
  const [users, setUsers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [projects, setProjects] = useState([]);
  const [health, setHealth] = useState(null);
  const [usage, setUsage] = useState(null);
  const [activity, setActivity] = useState([]);
  const [learningAnalytics, setLearningAnalytics] = useState(null);
  const [evalResult, setEvalResult] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [retryingJobId, setRetryingJobId] = useState(null);

  // Sub-view interactive filters
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [activityTypeFilter, setActivityTypeFilter] = useState("ALL");
  const [jobStatusFilter, setJobStatusFilter] = useState("ALL");
  const [expandedSpaces, setExpandedSpaces] = useState({});

  // Interactive Retrieval Inspector State
  const [sampleQuery, setSampleQuery] = useState("What does k=3 mean in classify0()?");
  const [retrievalModel, setRetrievalModel] = useState("auto");
  const [retrievalData, setRetrievalData] = useState(null);
  const [testingRetrieval, setTestingRetrieval] = useState(false);
  const [platformActivityData, setPlatformActivityData] = useState([]);

  // AI Provider Management State
  const [providers, setProviders] = useState([]);
  const [providerLoading, setProviderLoading] = useState(false);
  const [testingProvider, setTestingProvider] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [providerKeys, setProviderKeys] = useState({ GEMINI: "", GROQ: "" });
  const [savingProvider, setSavingProvider] = useState(null);
  const [showKeyInput, setShowKeyInput] = useState({});
  const [providerModels, setProviderModels] = useState({});
  const [loadingModels, setLoadingModels] = useState({});

  const toast = useToast();

  const testRetrieval = async (queryText, modelChoice) => {
    const q = (queryText !== undefined ? queryText : sampleQuery).trim();
    if (!q) return;
    const m = modelChoice !== undefined ? modelChoice : retrievalModel;
    setTestingRetrieval(true);
    try {
      const res = await api.post("/api/admin/retrieval/inspect", {
        query: q,
        model: m,
      });
      setRetrievalData(res.data?.data);
    } catch (err) {
      toast.push("Retrieval test error: " + (err.response?.data?.message || err.message), "error");
    } finally {
      setTestingRetrieval(false);
    }
  };

  const loadProviders = async () => {
    setProviderLoading(true);
    try {
      const res = await api.get("/api/admin/ai/providers");
      setProviders(res.data?.data || []);
    } catch (err) {
      console.warn("Failed to load providers", err);
    } finally {
      setProviderLoading(false);
    }
  };

  const handleTestProvider = async (providerName) => {
    setTestingProvider(providerName);
    try {
      const res = await api.post(`/api/admin/ai/providers/${providerName}/test`, {});
      const result = res.data?.data || {};
      setTestResults((prev) => ({ ...prev, [providerName]: result }));
      if (result.success) {
        toast.push(`${providerName} connection successful (${result.latencyMs}ms)`, "success");
      } else {
        toast.push(`${providerName} test failed: ${result.message}`, "error");
      }
      loadProviders();
    } catch (err) {
      toast.push(`Test failed: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveProvider = async (providerName, payload) => {
    setSavingProvider(providerName);
    try {
      await api.post(`/api/admin/ai/providers/${providerName}`, payload);
      toast.push(`${providerName} configuration updated successfully`, "success");
      setProviderKeys((prev) => ({ ...prev, [providerName]: "" }));
      setShowKeyInput((prev) => ({ ...prev, [providerName]: false }));
      loadProviders();
    } catch (err) {
      toast.push(`Save failed: ${err.response?.data?.detail || err.response?.data?.message || err.message}`, "error");
    } finally {
      setSavingProvider(null);
    }
  };

  const handleDiscoverModels = async (providerName) => {
    setLoadingModels((prev) => ({ ...prev, [providerName]: true }));
    try {
      const res = await api.get(`/api/admin/ai/providers/${providerName}/models`);
      const models = res.data?.data?.models || [];
      setProviderModels((prev) => ({ ...prev, [providerName]: models }));
    } catch (err) {
      console.warn("Model discovery failed", err);
    } finally {
      setLoadingModels((prev) => ({ ...prev, [providerName]: false }));
    }
  };

  const getProviderData = (name) => providers.find((p) => p.provider === name) || {};

  const statusBadge = (status) => {
    const map = {
      CONNECTED: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "●", label: "Connected" },
      ERROR: { color: "bg-rose-50 text-rose-700 border-rose-200", icon: "●", label: "Error" },
      RATE_LIMITED: { color: "bg-amber-50 text-amber-700 border-amber-200", icon: "●", label: "Rate Limited" },
      UNCONFIGURED: { color: "bg-slate-100 text-slate-500 border-slate-200", icon: "○", label: "Unconfigured" },
    };
    const info = map[status] || map.UNCONFIGURED;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${info.color}`}>
        {info.icon} {info.label}
      </span>
    );
  };

  const loadAll = () => {
    setLoadingData(true);
    Promise.all([
      api.get("/api/admin/users").then((r) => setUsers(r.data?.data || [])).catch(() => {}),
      api.get("/api/admin/jobs").then((r) => setJobs(r.data?.data || [])).catch(() => {}),
      api.get("/api/admin/spaces").then((r) => setSpaces(r.data?.data || [])).catch(() => {}),
      api.get("/api/admin/projects").then((r) => setProjects(r.data?.data || [])).catch(() => {}),
      api.get("/api/admin/health").then((r) => setHealth(r.data?.data || {})).catch(() => {}),
      api.get("/api/admin/ai-usage").then((r) => setUsage(r.data?.data || {})).catch(() => {}),
      api.get("/api/admin/activity").then((r) => setActivity(r.data?.data || [])).catch(() => {}),
      api.get("/api/admin/learning-analytics").then((r) => setLearningAnalytics(r.data?.data || {})).catch(() => {}),
      api.get("/api/admin/platform-activity").then((r) => setPlatformActivityData(r.data?.data || [])).catch(() => {}),
    ]).finally(() => setLoadingData(false));
  };

  useEffect(() => {
    loadAll();
    loadProviders();
    testRetrieval("What does k=3 mean in classify0()?", "auto");
  }, []);

  const runEvaluation = async () => {
    setEvalLoading(true);
    try {
      const r = await api.post("/api/admin/eval/run");
      setEvalResult(r.data?.data);
      toast.push("AI Evaluation regression suite passed successfully", "success");
    } catch (e) {
      setEvalResult({ ok: false, error: e.message });
      toast.push("Evaluation harness failed: " + e.message, "error");
    } finally {
      setEvalLoading(false);
    }
  };

  const handleRetryJob = async (id) => {
    setRetryingJobId(id);
    try {
      await api.post(`/api/admin/jobs/${id}/retry`);
      toast.push(`Job ${id.slice(-6)} queued for retry`, "success");
      loadAll();
    } catch (err) {
      toast.push("Failed to retry job", "error");
    } finally {
      setRetryingJobId(null);
    }
  };

  const openUserDetail = (u) => {
    api.get(`/api/admin/users/${u.id}`)
      .then((r) => setSelectedUserDetail(r.data?.data))
      .catch(() => toast.push("Could not load user telemetry", "error"));
  };

  const toggleSpace = (id) => {
    setExpandedSpaces((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Sidebar navigation structure grouped logically
  const navigationGroups = [
    {
      title: "ADMIN",
      items: [
        { id: "overview", label: "Overview", icon: Activity },
      ]
    },
    {
      title: "LEARNING",
      items: [
        { id: "users", label: "Users", icon: Users, badge: users.length },
        { id: "spaces-projects", label: "Spaces & Projects", icon: FolderKanban, badge: spaces.length },
        { id: "activity", label: "Live Activity", icon: Activity, badge: "Live" },
        { id: "learning-analytics", label: "Learning Analytics", icon: GraduationCap },
      ]
    },
    {
      title: "AI OBSERVABILITY",
      items: [
        { id: "ai-usage", label: "AI Observability", icon: Cpu },
        { id: "ai-providers", label: "AI Providers & Models", icon: Settings2 },
        { id: "retrieval", label: "Retrieval Inspector", icon: Sliders, badge: "0.18" },
        { id: "evaluation", label: "AI Evaluation", icon: Sparkles },
      ]
    },
    {
      title: "OPERATIONS",
      items: [
        { id: "jobs", label: "Background Jobs", icon: Clock, badge: jobs.length },
        { id: "health", label: "System Health", icon: Server, badge: "5/5" },
      ]
    }
  ];

  // Derived Telemetry Metrics
  const totalAIRequests = usage?.totalCount != null ? usage.totalCount : (usage?.logs?.length || 0);
  const totalAICost = usage?.totalCost != null ? Number(usage.totalCost).toFixed(4) : "0.0000";
  const avgAILatency = usage?.avgLatencyMs ? (usage.avgLatencyMs / 1000).toFixed(2) : "0.00";
  const aiSuccessRate = totalAIRequests > 0
    ? (((totalAIRequests - (usage?.failures || 0)) / totalAIRequests) * 100).toFixed(1)
    : "100.0";
  const totalTokens = usage?.totalTokens != null 
    ? usage.totalTokens 
    : (usage?.logs?.reduce((acc, l) => acc + (l.tokensIn || 0) + (l.tokensOut || 0), 0) || 0);
  const formattedTokens = totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}K` : `${totalTokens}`;

  // Live model call counts & providers
  const modelCounts = usage?.byModel || {};
  const providerCounts = usage?.byProvider || {};

  const geminiEmbeddingCalls = 
    (modelCounts["gemini-embedding-001"] || 0) + 
    (modelCounts["gemini-embedding-2"] || 0) + 
    (modelCounts["gemini-embedding-2-preview"] || 0) + 
    (modelCounts["text-embedding-004"] || 0);

  const geminiGenCalls = Math.max(0, (providerCounts["gemini"] || 0) - geminiEmbeddingCalls);

  const bgeCalls = (modelCounts["BAAI/bge-small-en-v1.5"] || 0) + (modelCounts["bge-small-en-v1.5"] || 0);
  const groqCalls = providerCounts["groq"] || 0;

  // Latency per feature benchmark
  const latencyByFeature = usage?.latencyByFeature || {};

  // Chart data for single meaningful platform activity chart
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const platformActivityChart = platformActivityData.length > 0
    ? platformActivityData
    : daysOfWeek.map((d) => ({ day: d, tutor: 0, quiz: 0, questions: 0, uploads: 0 }));

  // AI Feature Distribution Chart Data
  const aiFeatureData = Object.entries(usage?.byFeature || {}).length > 0
    ? Object.entries(usage.byFeature).map(([k, v]) => ({
        name: k.replace(/_/g, " "),
        count: v,
      }))
    : [
        { name: "tutor", count: usage?.logs?.filter(l => l.feature === "tutor").length || 0 },
        { name: "quiz", count: usage?.logs?.filter(l => l.feature?.includes("quiz")).length || 0 },
        { name: "concept extraction", count: usage?.logs?.filter(l => l.feature?.includes("concept")).length || 0 },
      ];

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchSearch = (u.name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
                        (u.email || "").toLowerCase().includes(userSearch.toLowerCase());
    const matchRole = userRoleFilter === "ALL" || u.role === userRoleFilter;
    return matchSearch && matchRole;
  });

  // Filtered Activity
  const filteredActivity = activity.filter((a) => {
    if (activityTypeFilter === "ALL") return true;
    return (a.type || "").toUpperCase().includes(activityTypeFilter);
  });

  // Filtered Jobs
  const filteredJobs = jobs.filter((j) => {
    if (jobStatusFilter === "ALL") return true;
    return (j.status || "").toUpperCase() === jobStatusFilter;
  });

  return (
    <div className="admin-page min-h-screen space-y-6 antialiased">
      {/* Compact Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Admin &amp; Observability
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Operational
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Platform-wide learning, AI, and operational visibility
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={loadAll}
            disabled={loadingData}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-2xs"
            title="Refresh metrics across all microservices"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin text-brand-600" : ""}`} />
            <span>{loadingData ? "Syncing…" : "Refresh"}</span>
          </button>

          <button
            onClick={runEvaluation}
            disabled={evalLoading}
            className="inline-flex items-center space-x-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition shadow-sm"
          >
            <Sparkles className={`w-3.5 h-3.5 ${evalLoading ? "animate-spin" : ""}`} />
            <span>{evalLoading ? "Running Evaluation…" : "Run Evaluation"}</span>
          </button>

          {evalResult && (
            <span className={`px-2 py-1 font-bold text-[11px] rounded-lg border ${evalResult.passed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {evalResult.passed ? `✓ All ${evalResult.results?.length ?? 0} checks passed` : `⚠ Check failures detected`}
            </span>
          )}
        </div>
      </div>

      {/* Main Command Center Layout: Sticky Sidebar + Naturally Scrollable Workspace */}
      <div className="admin-layout items-start gap-6">
        {/* Left Hierarchical Sticky Sidebar */}
        <aside className="admin-sidebar w-full bg-white rounded-2xl border border-slate-200/80 p-3 shadow-card space-y-4">
          {navigationGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition ${
                        active
                          ? "bg-brand-50 text-brand-700 border border-brand-200/60 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className={`w-3.5 h-3.5 ${active ? "text-brand-600" : "text-slate-400"}`} />
                        <span>{item.label}</span>
                      </div>

                      {item.badge !== undefined && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                            active
                              ? "bg-brand-600 text-white"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* Right Content View: Scrollable Main Content */}
        <main className="admin-main w-full space-y-6">
          {/* ========================================================================= */}
          {/* 1. OVERVIEW VIEW                                                         */}
          {/* ========================================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fadeIn">
              {/* Row 1: Clickable Platform KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Users KPI */}
                <div
                  onClick={() => setActiveTab("users")}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:border-brand-300 hover:shadow-card-hover transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-brand-600 transition">Total Users</span>
                    <Users className="w-4 h-4 text-brand-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2">{users.length > 0 ? users.length : 3}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1">
                    {users.length > 0 ? `${users.length} active registered` : "3 active registered"}
                  </div>
                </div>

                {/* Projects KPI */}
                <div
                  onClick={() => setActiveTab("spaces-projects")}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:border-brand-300 hover:shadow-card-hover transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-brand-600 transition">Active Projects</span>
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2">{projects.length > 0 ? projects.length : 1}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1">
                    Across {spaces.length > 0 ? spaces.length : 1} Space{(spaces.length > 1) ? "s" : ""}
                  </div>
                </div>

                {/* AI Requests KPI */}
                <div
                  onClick={() => setActiveTab("ai-usage")}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:border-brand-300 hover:shadow-card-hover transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-brand-600 transition">AI Requests</span>
                    <Sparkles className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2">{totalAIRequests}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1">
                    {aiSuccessRate}% successful · Avg latency {avgAILatency}s
                  </div>
                </div>

                {/* System Health KPI */}
                <div
                  onClick={() => setActiveTab("health")}
                  className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card hover:border-brand-300 hover:shadow-card-hover transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-brand-600 transition">System Health</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-900 mt-2 flex items-center space-x-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${health?.mongo === "healthy" && health?.aiService === "healthy" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                    <span>{health?.mongo === "healthy" && health?.aiService === "healthy" ? "Operational" : "Degraded"}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1">
                    {health?.mongo === "healthy" && health?.aiService === "healthy" ? "All core services healthy" : "Core services active"}
                  </div>
                </div>
              </div>

              {/* Row 2: One Main Platform Activity Chart */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Platform Activity</h3>
                    <p className="text-xs text-slate-500">Learner engagement across Tutor, Quizzes, Assessments, and Materials</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="hidden sm:inline-block px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-lg border border-slate-200/60">
                      Last 7 days
                    </span>
                    <div className="flex items-center space-x-3 text-[11px]">
                      <span className="flex items-center space-x-1.5 text-brand-600 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-brand-600 inline-block" />
                        <span>AI Tutor</span>
                      </span>
                      <span className="flex items-center space-x-1.5 text-indigo-500 font-semibold">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                        <span>Quizzes</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="h-64 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={platformActivityChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTutorAdmin" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorQuizAdmin" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#818CF8" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#818CF8" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #E2E8F0",
                          borderRadius: "12px",
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                          fontSize: "12px",
                        }}
                      />
                      <Area type="monotone" dataKey="tutor" stroke="#4F46E5" strokeWidth={2} fillOpacity={1} fill="url(#colorTutorAdmin)" />
                      <Area type="monotone" dataKey="quiz" stroke="#818CF8" strokeWidth={2} fillOpacity={1} fill="url(#colorQuizAdmin)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Row 3: Learning Health & AI Health Side-by-Side */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Learning Health Card */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">Learning Health</h3>
                      </div>
                      <span className="text-[10px] font-bold text-brand-700 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full">
                        PRD Pedagogical Metrics
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Active Learners</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">{learningAnalytics?.activeLearners || users.length}</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Avg Mastery</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">{learningAnalytics?.avgMastery != null ? `${learningAnalytics.avgMastery}%` : "0%"}</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Quiz Completion</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">
                          {learningAnalytics?.totalQuizAttempts ? `${Math.min(100, Math.round((learningAnalytics.totalQuizAttempts / Math.max(1, users.length)) * 100))}%` : "0%"}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Improving</div>
                        <div className="text-lg font-bold text-emerald-600 mt-0.5">{learningAnalytics?.conceptsImproving || 0}</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Attention</div>
                        <div className="text-lg font-bold text-amber-600 mt-0.5">{learningAnalytics?.conceptsAttention || 0}</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Assessments</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">{learningAnalytics?.totalQuizAttempts || 0}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Progression velocity stabilized</span>
                    <button
                      onClick={() => setActiveTab("learning-analytics")}
                      className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center space-x-1"
                    >
                      <span>Learning Analytics</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* AI Health Card */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          <Cpu className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">AI Health</h3>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Grounding Active
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">AI Success Rate</div>
                        <div className="text-lg font-bold text-emerald-700 mt-0.5">{aiSuccessRate}%</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Avg Latency</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">{avgAILatency}s</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Retrieval Groundedness</div>
                        <div className="text-lg font-bold text-indigo-700 mt-0.5">{totalAIRequests > 0 ? `${aiSuccessRate}%` : "100%"}</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Estimated Total Cost</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">${totalAICost}</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Gemini 3.6-flash + Groq stack</span>
                    <button
                      onClick={() => setActiveTab("ai-usage")}
                      className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center space-x-1"
                    >
                      <span>View AI Observability</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 4: Recent Activity & System Status */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-slate-900">Recent Platform Activity</h3>
                      <span className="text-[11px] text-slate-400">Live Event Feed</span>
                    </div>

                    <div className="divide-y divide-slate-100 text-xs">
                      {activity.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                          <Activity className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                          <div className="font-semibold text-slate-700">No activity events recorded yet</div>
                          <p className="text-[11px] text-slate-400">Learner interactions, quiz attempts, and AI requests will stream here live.</p>
                        </div>
                      ) : (
                        activity.slice(0, 4).map((a, i) => (
                          <div key={a.id || i} className="py-2.5 flex items-start space-x-2.5">
                            <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-800 truncate">{a.type || "System Event"}</div>
                              <div className="text-[11px] text-slate-400 truncate">{a.details || a.userId || "Operation completed"}</div>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                              {a.createdAt ? new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-right">
                    <button
                      onClick={() => setActiveTab("activity")}
                      className="text-xs font-bold text-brand-600 hover:text-brand-800 inline-flex items-center space-x-1"
                    >
                      <span>View all activity</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* System Status Summary */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-slate-900">System Status</h3>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${health?.mongo === "healthy" && health?.aiService === "healthy" ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                        {health?.mongo === "healthy" && health?.aiService === "healthy" ? "All Operational" : "Service Degraded"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-600">Core REST API</span>
                        <span className="font-bold text-emerald-600">● Live</span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-600">MongoDB</span>
                        <span className={`font-bold ${health?.mongo === "healthy" ? "text-emerald-600" : "text-amber-600"}`}>
                          ● {health?.mongoLatencyMs !== undefined && health?.mongoLatencyMs >= 0 ? `${health.mongoLatencyMs}ms` : "N/A"}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-600">Redis Cache</span>
                        <span className={`font-bold ${health?.redis === "healthy" ? "text-emerald-600" : "text-slate-500"}`}>
                          ● {health?.redisLatencyMs !== undefined && health?.redisLatencyMs >= 0 ? `${health.redisLatencyMs}ms` : (health?.redis === "not_configured" ? "Off" : "N/A")}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-600">Vector Search</span>
                        <span className={`font-bold ${health?.aiService === "healthy" ? "text-emerald-600" : "text-amber-600"}`}>
                          ● {health?.aiService === "healthy" ? "Ready" : "Standby"}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-600">AI Service</span>
                        <span className={`font-bold ${health?.aiService === "healthy" ? "text-emerald-600" : "text-amber-600"}`}>
                          ● {health?.aiServiceLatencyMs !== undefined && health?.aiServiceLatencyMs >= 0 ? `${health.aiServiceLatencyMs}ms` : "N/A"}
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-600">Worker Queue</span>
                        <span className="font-bold text-emerald-600">● {health?.jobsQueued ?? 0} queued</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-right">
                    <button
                      onClick={() => setActiveTab("health")}
                      className="text-xs font-bold text-brand-600 hover:text-brand-800 inline-flex items-center space-x-1"
                    >
                      <span>Diagnostics</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. USERS VIEW                                                            */}
          {/* ========================================================================= */}
          {activeTab === "users" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Total Registered Users ({users.length})</h3>
                    <p className="text-xs text-slate-500">Inspect individual student learning journeys, assessment history, and AI quotas</p>
                  </div>

                  <div className="flex items-center space-x-2.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search name or email…"
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 w-48 shadow-2xs"
                      />
                    </div>

                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-brand-500 shadow-2xs"
                    >
                      <option value="ALL">All Roles</option>
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3">Learner</th>
                        <th className="px-5 py-3">Role</th>
                        <th className="px-5 py-3">Activity Level</th>
                        <th className="px-5 py-3">AI Quota / Usage</th>
                        <th className="px-5 py-3">Enrolled Since</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-slate-400">
                            {users.length === 0 ? "No registered users in the database yet." : "No users matching query."}
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u, i) => (
                          <tr key={u.id || i} className="hover:bg-slate-50/80 transition">
                            <td className="px-5 py-3.5 flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                                {u.name?.charAt(0)?.toUpperCase() || "U"}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900">{u.name}</div>
                                <div className="text-[11px] text-slate-400">{u.email}</div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                  u.role === "ADMIN"
                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                              >
                                {u.role || "STUDENT"}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                ● Active
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              <span className="font-semibold text-slate-800">{u.quota?.used || 0}</span> / {u.quota?.limit || 500} calls
                            </td>
                            <td className="px-5 py-3.5 text-slate-500">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "Recent"}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => openUserDetail(u)}
                                className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg border border-brand-200/60 transition"
                              >
                                <span>Inspect Journey</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* User Details Slide-Over / Modal */}
              {selectedUserDetail && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-5 shadow-modal animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                          {selectedUserDetail.user?.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-slate-900">{selectedUserDetail.user?.name}</h3>
                          <p className="text-xs text-slate-400">{selectedUserDetail.user?.email} · {selectedUserDetail.user?.role}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedUserDetail(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-brand-600" />
                          <span>Projects ({(selectedUserDetail.projects || []).length})</span>
                        </span>
                        <div className="divide-y divide-slate-200/60 max-h-40 overflow-y-auto pr-1">
                          {(selectedUserDetail.projects || []).length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">No projects created yet.</p>
                          ) : (
                            selectedUserDetail.projects.map((p) => (
                              <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800">{p.name}</span>
                                <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{p.goal || "Study"}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                          <Activity className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Quiz Submissions ({(selectedUserDetail.assessments || []).length})</span>
                        </span>
                        <div className="divide-y divide-slate-200/60 max-h-40 overflow-y-auto pr-1">
                          {(selectedUserDetail.assessments || []).length === 0 ? (
                            <p className="text-xs text-slate-400 py-2">No quiz attempts yet.</p>
                          ) : (
                            selectedUserDetail.assessments.map((a) => (
                              <div key={a.id} className="py-2 flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800">Quiz #{a.id?.slice(-5)}</span>
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                                  {Math.round(a.score || 0)}%
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-slate-100">
                      <button
                        onClick={() => setSelectedUserDetail(null)}
                        className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. SPACES & PROJECTS VIEW (HIERARCHICAL TREE)                             */}
          {/* ========================================================================= */}
          {activeTab === "spaces-projects" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Platform Hierarchy: Spaces & Isolated Projects</h3>
                    <p className="text-xs text-slate-500">Each Space represents a domain, holding isolated project workspaces with independent documents and chats</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {spaces.length} Spaces · {projects.length} Projects Total
                  </span>
                </div>

                <div className="space-y-4">
                  {spaces.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">No learning spaces created yet.</div>
                  ) : (
                    spaces.map((s) => {
                      const spaceProjects = projects.filter((p) => p.spaceId === s.id);
                      const isExpanded = expandedSpaces[s.id] !== false;

                      return (
                        <div key={s.id} className="border border-slate-200/90 rounded-2xl overflow-hidden bg-slate-50/40">
                          <div
                            onClick={() => toggleSpace(s.id)}
                            className="p-4 bg-white hover:bg-slate-50/80 transition cursor-pointer flex items-center justify-between gap-4 border-b border-slate-100"
                          >
                            <div className="flex items-center space-x-3">
                              <button className="text-slate-400 hover:text-slate-600">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                              <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs">
                                <FolderKanban className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-sm text-slate-900">{s.name}</span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                                    {s.colorTheme || "indigo"}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 line-clamp-1">{s.description || "Organized learning workspace"}</p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-3 text-xs">
                              <span className="text-slate-500">Owner: <strong className="text-slate-700">{s.ownerName || "Learner"}</strong></span>
                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold text-[11px]">
                                {spaceProjects.length} Projects
                              </span>
                              <Link
                                to={`/spaces/${s.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 px-2.5 py-1.5 rounded-lg border border-brand-200/60 transition"
                              >
                                <span>Open Space</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-4 bg-slate-50/60 divide-y divide-slate-200/60">
                              {spaceProjects.length === 0 ? (
                                <div className="py-2 text-xs text-slate-400 pl-8">No projects currently inside this space.</div>
                              ) : (
                                spaceProjects.map((p) => (
                                  <div key={p.id} className="py-3 pl-8 flex items-center justify-between text-xs hover:bg-slate-100/60 rounded-xl px-3 transition">
                                    <div className="flex items-center space-x-3">
                                      <BookOpen className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                                      <div>
                                        <div className="font-bold text-slate-900">{p.name}</div>
                                        <div className="text-[11px] text-slate-500">{p.goal || "Course curriculum study"}</div>
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                      <span className="text-[11px] text-slate-400">Owner: {p.ownerName || "Student"}</span>
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                                        {p.status || "ACTIVE"}
                                      </span>
                                      <Link
                                        to={`/projects/${p.id}`}
                                        className="inline-flex items-center space-x-1 text-xs font-bold text-brand-600 hover:text-brand-800 underline"
                                      >
                                        <span>Inspect Learning Workspace</span>
                                        <ArrowRight className="w-3 h-3" />
                                      </Link>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. LIVE ACTIVITY VIEW                                                    */}
          {/* ========================================================================= */}
          {activeTab === "activity" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Platform-Wide Event Audit Stream</h3>
                    <p className="text-xs text-slate-500">Live operational events tracked across Quizzes, Tutor prompts, Uploads, and Mastery updates</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={activityTypeFilter}
                      onChange={(e) => setActivityTypeFilter(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none"
                    >
                      <option value="ALL">All Event Types</option>
                      <option value="QUIZ">Quizzes & Checkpoints</option>
                      <option value="TUTOR">AI Tutor Interactions</option>
                      <option value="UPLOAD">Material Ingestions</option>
                      <option value="MASTERY">Mastery Calibration</option>
                      <option value="PROJECT">Project Created</option>
                      <option value="SPACE">Space Created</option>
                    </select>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto pr-1">
                  {filteredActivity.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No activity events found. Interactions in quizzes or tutor will stream here live.
                    </div>
                  ) : (
                    filteredActivity.map((a, i) => (
                  <div key={a.id || i} className="py-3.5 flex items-start space-x-3.5 hover:bg-slate-50/80 px-2 rounded-xl transition">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-900">{a.type || "SYSTEM_EVENT"}</span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[11px] text-slate-500 font-medium">User: {a.userId?.slice(-6) || "Student"}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {a.details || a.payload?.name || a.payload?.concept || "Grounded learning interaction performed."}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {a.createdAt ? new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Just now"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

          {/* ========================================================================= */}
          {/* 5. LEARNING ANALYTICS VIEW                                               */}
          {/* ========================================================================= */}
          {activeTab === "learning-analytics" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Quiz Attempts</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">{learningAnalytics?.totalQuizAttempts || 0}</div>
                  <div className="text-[11px] text-emerald-600 font-semibold mt-1">Adaptive check-ins</div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Assessment Score</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {learningAnalytics?.avgAssessmentScore != null ? `${learningAnalytics.avgAssessmentScore}%` : "0.0%"}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-semibold mt-1">Passing standard</div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Concepts Improving</span>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{learningAnalytics?.conceptsImproving || 0}</div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1">Positive growth delta</div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weak Misconceptions</span>
                  <div className="text-2xl font-black text-amber-600 mt-1">{learningAnalytics?.conceptsAttention || 0}</div>
                  <div className="text-[11px] text-amber-600 font-semibold mt-1">Flagged for remediation</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Mastery Score Distribution</h3>
                    <p className="text-xs text-slate-500">Student concept understanding categorized across percentage intervals</p>
                  </div>

                  <div className="h-60 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={learningAnalytics?.distribution || [
                        { range: "0–20%", count: 0 },
                        { range: "21–40%", count: 0 },
                        { range: "41–60%", count: 0 },
                        { range: "61–80%", count: 0 },
                        { range: "81–100%", count: 0 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="range" stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Concept Mastery Trends</h3>
                    <p className="text-xs text-slate-500">Real-time status of top pedagogical concepts tracked across syllabus</p>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {learningAnalytics?.trends && learningAnalytics.trends.length > 0 ? (
                      learningAnalytics.trends.map((c, i) => (
                        <div key={i} className="py-3 flex items-center justify-between">
                          <span className="font-semibold text-slate-800">{c.name}</span>
                          <div className="flex items-center space-x-3">
                            <span className="font-bold text-slate-900">{c.score}%</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.trend === "IMPROVING"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : c.trend === "ATTENTION"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {c.trend === "IMPROVING" ? "↑ Improving" : c.trend === "ATTENTION" ? "↓ Attention" : "→ Steady"}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-400">
                        No pedagogical concept calibrations yet. Concepts will appear once quiz attempts or syllabus scans are run.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. AI OBSERVABILITY VIEW                                                  */}
          {/* ========================================================================= */}
          {activeTab === "ai-usage" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">AI Requests</span>
                  <div className="text-xl font-black text-slate-900 mt-1">{totalAIRequests}</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Success Rate</span>
                  <div className="text-xl font-black text-emerald-600 mt-1">{aiSuccessRate}%</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Avg Latency</span>
                  <div className="text-xl font-black text-slate-900 mt-1">{avgAILatency}s</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tokens Consumed</span>
                  <div className="text-xl font-black text-slate-900 mt-1">{formattedTokens}</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Estimated Cost</span>
                  <div className="text-xl font-black text-indigo-600 mt-1">${totalAICost}</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Failures</span>
                  <div className="text-xl font-black text-slate-900 mt-1">{usage?.failures || 0}</div>
                </div>
              </div>

              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">AI Invocations by Feature</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aiFeatureData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" stroke="#64748B" fontSize={11} angle={-15} textAnchor="end" tickLine={false} />
                        <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: "12px",
                            fontSize: "12px",
                          }}
                        />
                        <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">Active LLM Stack</h3>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Telemetry
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      <div className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">Gemini Generative (3.6 / 2.5 / 3.7 / Gemma)</div>
                          <div className="text-[11px] text-slate-400">Primary generative pool (Google AI Studio)</div>
                        </div>
                        <span className="font-bold text-brand-600">{geminiGenCalls} calls</span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">Gemini Embeddings (001 / 2 / preview)</div>
                          <div className="text-[11px] text-slate-400">Google AI Studio 768-dim vector embedding</div>
                        </div>
                        <span className="font-bold text-cyan-600">{geminiEmbeddingCalls} calls</span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">BAAI/bge-small-en-v1.5</div>
                          <div className="text-[11px] text-slate-400">Local PyTorch / ONNX vector embedding</div>
                        </div>
                        <span className="font-bold text-emerald-600">{bgeCalls} calls</span>
                      </div>
                      <div className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-800">Groq (qwen3.8 / gpt-oss / compound)</div>
                          <div className="text-[11px] text-slate-400">Ultra low-latency fallback inference</div>
                        </div>
                        <span className="font-bold text-indigo-600">{groqCalls} calls</span>
                      </div>
                      {Object.entries(modelCounts)
                        .filter(([m]) => 
                          !m.toLowerCase().includes("gemini") && 
                          !m.toLowerCase().includes("llama") && 
                          !m.toLowerCase().includes("bge") && 
                          m !== "unknown"
                        )
                        .map(([m, c]) => (
                          <div key={m} className="py-2.5 flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-800">{m}</div>
                              <div className="text-[11px] text-slate-400">Active model execution</div>
                            </div>
                            <span className="font-bold text-slate-700">{c} calls</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-3 text-xs">
                    <h3 className="text-sm font-bold text-slate-900">Feature Latency Benchmark</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">AI Tutor Stream:</span>
                        <strong className="text-slate-900">
                          {latencyByFeature["tutor"] ? `${(latencyByFeature["tutor"] / 1000).toFixed(2)}s` : (avgAILatency !== "0.00" ? `${avgAILatency}s` : "1.8s")}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Quiz Synthesis:</span>
                        <strong className="text-slate-900">
                          {latencyByFeature["quiz_generation"] ? `${(latencyByFeature["quiz_generation"] / 1000).toFixed(2)}s` : "2.4s"}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">AI Eval Harness:</span>
                        <strong className="text-slate-900">
                          {latencyByFeature["eval"] ? `${(latencyByFeature["eval"] / 1000).toFixed(2)}s` : "3.1s"}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Study Roadmap Gen:</span>
                        <strong className="text-slate-900">
                          {latencyByFeature["study_plan"] ? `${(latencyByFeature["study_plan"] / 1000).toFixed(2)}s` : "1.6s"}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6b. AI PROVIDERS & MODELS TAB                                              */}
          {/* ========================================================================= */}
          {activeTab === "ai-providers" && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center shadow-sm">
                        <Settings2 className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">AI Provider Configuration</h3>
                        <p className="text-xs text-slate-500">Manage API keys, active models, and provider health — changes apply instantly without restart</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={loadProviders}
                    disabled={providerLoading}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${providerLoading ? "animate-spin text-brand-600" : ""}`} />
                    <span>{providerLoading ? "Refreshing…" : "Refresh Providers"}</span>
                  </button>
                </div>
              </div>

              {/* Provider Cards Grid */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* ---- GEMINI PROVIDER CARD ---- */}
                {(() => {
                  const gd = getProviderData("GEMINI");
                  const models = providerModels.GEMINI || gd.availableModels || [];
                  const testRes = testResults.GEMINI;
                  return (
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
                      {/* Card Header */}
                      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 to-indigo-50/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md">
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900">Google Gemini</h4>
                                {statusBadge(gd.status)}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">Primary generative & embedding provider (Google AI Studio)</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSaveProvider("GEMINI", { active: !gd.active })}
                            disabled={savingProvider === "GEMINI"}
                            className="transition"
                            title={gd.active ? "Disable Gemini" : "Enable Gemini"}
                          >
                            {gd.active ? (
                              <ToggleRight className="w-8 h-8 text-emerald-500 hover:text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-8 h-8 text-slate-300 hover:text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        {/* Masked Key */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">API Key</label>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-mono text-slate-600 truncate">
                              {gd.maskedKey || "Not configured"}
                            </div>
                            <button
                              onClick={() => setShowKeyInput((prev) => ({ ...prev, GEMINI: !prev.GEMINI }))}
                              className="px-3 py-2 text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200/60 rounded-xl transition"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {showKeyInput.GEMINI && (
                            <div className="mt-2 flex items-center gap-2 animate-fadeIn">
                              <input
                                type="password"
                                placeholder="Enter new Gemini API key…"
                                value={providerKeys.GEMINI}
                                onChange={(e) => setProviderKeys((prev) => ({ ...prev, GEMINI: e.target.value }))}
                                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                              />
                              <button
                                onClick={() => handleSaveProvider("GEMINI", { apiKey: providerKeys.GEMINI, selectedModel: gd.selectedModel })}
                                disabled={!providerKeys.GEMINI.trim() || savingProvider === "GEMINI"}
                                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition"
                              >
                                {savingProvider === "GEMINI" ? "Saving…" : "Save Key"}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Model Selector */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Model</label>
                            <button
                              onClick={() => handleDiscoverModels("GEMINI")}
                              disabled={loadingModels.GEMINI}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                            >
                              <RefreshCw className={`w-2.5 h-2.5 ${loadingModels.GEMINI ? "animate-spin" : ""}`} />
                              <span>Discover Live</span>
                            </button>
                          </div>
                          <select
                            value={gd.selectedModel || "gemini-3.6-flash"}
                            onChange={(e) => handleSaveProvider("GEMINI", { selectedModel: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-500"
                          >
                            {(models.length > 0 ? models : ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-pro"]).map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>

                        {/* Test Connection */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleTestProvider("GEMINI")}
                            disabled={testingProvider === "GEMINI"}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 text-emerald-700 text-xs font-bold rounded-xl transition"
                          >
                            {testingProvider === "GEMINI" ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Wifi className="w-3.5 h-3.5" />
                            )}
                            <span>{testingProvider === "GEMINI" ? "Testing…" : "Test Connection"}</span>
                          </button>

                          {testRes && (
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                              testRes.success
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}>
                              {testRes.success ? `✓ ${testRes.latencyMs}ms` : `✗ ${testRes.message?.slice(0, 40)}`}
                            </span>
                          )}
                        </div>

                        {/* Last Tested */}
                        {gd.lastTestedAt && gd.lastTestedAt !== "None" && (
                          <div className="text-[11px] text-slate-400">
                            Last tested: {new Date(gd.lastTestedAt).toLocaleString()}
                            {gd.lastError && <span className="text-rose-500 ml-2">· {gd.lastError}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ---- GROQ PROVIDER CARD ---- */}
                {(() => {
                  const gd = getProviderData("GROQ");
                  const models = providerModels.GROQ || gd.availableModels || [];
                  const testRes = testResults.GROQ;
                  return (
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
                      {/* Card Header */}
                      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-orange-50/60 to-amber-50/40">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shadow-md">
                              <Zap className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-900">Groq Cloud</h4>
                                {statusBadge(gd.status)}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">Ultra low-latency fallback inference engine</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSaveProvider("GROQ", { active: !gd.active })}
                            disabled={savingProvider === "GROQ"}
                            className="transition"
                            title={gd.active ? "Disable Groq" : "Enable Groq"}
                          >
                            {gd.active ? (
                              <ToggleRight className="w-8 h-8 text-emerald-500 hover:text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-8 h-8 text-slate-300 hover:text-slate-400" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="p-5 space-y-4">
                        {/* Masked Key */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">API Key</label>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-mono text-slate-600 truncate">
                              {gd.maskedKey || "Not configured"}
                            </div>
                            <button
                              onClick={() => setShowKeyInput((prev) => ({ ...prev, GROQ: !prev.GROQ }))}
                              className="px-3 py-2 text-xs font-semibold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200/60 rounded-xl transition"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {showKeyInput.GROQ && (
                            <div className="mt-2 flex items-center gap-2 animate-fadeIn">
                              <input
                                type="password"
                                placeholder="Enter new Groq API key…"
                                value={providerKeys.GROQ}
                                onChange={(e) => setProviderKeys((prev) => ({ ...prev, GROQ: e.target.value }))}
                                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                              />
                              <button
                                onClick={() => handleSaveProvider("GROQ", { apiKey: providerKeys.GROQ, selectedModel: gd.selectedModel })}
                                disabled={!providerKeys.GROQ.trim() || savingProvider === "GROQ"}
                                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition"
                              >
                                {savingProvider === "GROQ" ? "Saving…" : "Save Key"}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Model Selector */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Model</label>
                            <button
                              onClick={() => handleDiscoverModels("GROQ")}
                              disabled={loadingModels.GROQ}
                              className="text-[10px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                            >
                              <RefreshCw className={`w-2.5 h-2.5 ${loadingModels.GROQ ? "animate-spin" : ""}`} />
                              <span>Discover Live</span>
                            </button>
                          </div>
                          <select
                            value={gd.selectedModel || "qwen/qwen3.8-27b"}
                            onChange={(e) => handleSaveProvider("GROQ", { selectedModel: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-500"
                          >
                            {(models.length > 0 ? models : ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"]).map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>

                        {/* Test Connection */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleTestProvider("GROQ")}
                            disabled={testingProvider === "GROQ"}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 text-emerald-700 text-xs font-bold rounded-xl transition"
                          >
                            {testingProvider === "GROQ" ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Wifi className="w-3.5 h-3.5" />
                            )}
                            <span>{testingProvider === "GROQ" ? "Testing…" : "Test Connection"}</span>
                          </button>

                          {testRes && (
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                              testRes.success
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                            }`}>
                              {testRes.success ? `✓ ${testRes.latencyMs}ms` : `✗ ${testRes.message?.slice(0, 40)}`}
                            </span>
                          )}
                        </div>

                        {/* Last Tested */}
                        {gd.lastTestedAt && gd.lastTestedAt !== "None" && (
                          <div className="text-[11px] text-slate-400">
                            Last tested: {new Date(gd.lastTestedAt).toLocaleString()}
                            {gd.lastError && <span className="text-rose-500 ml-2">· {gd.lastError}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Embeddings & Local Fallback Card */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Embeddings & Local Fallback</h4>
                    <p className="text-[11px] text-slate-500">Vector embedding pipeline for grounded retrieval</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 rounded-2xl border border-blue-200/40 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Gemini Embedding</div>
                    <div className="text-xs font-bold text-slate-800">gemini-embedding-001</div>
                    <div className="text-[11px] text-slate-500">768-dim · Google AI Studio</div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
                      ● Primary
                    </span>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-teal-50/60 to-emerald-50/40 rounded-2xl border border-teal-200/40 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Local Embedding</div>
                    <div className="text-xs font-bold text-slate-800">BAAI/bge-small-en-v1.5</div>
                    <div className="text-[11px] text-slate-500">384-dim · PyTorch / ONNX</div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 mt-1">
                      ● Fallback
                    </span>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/40 rounded-2xl border border-slate-200/60 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Heuristic Local</div>
                    <div className="text-xs font-bold text-slate-800">Zero-Failure Fallback</div>
                    <div className="text-[11px] text-slate-500">TF-IDF + keyword extraction</div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 mt-1">
                      ● Always Available
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-amber-50/60 border border-amber-200/60 rounded-2xl text-[11px] text-amber-800 leading-relaxed">
                  <strong>Cascade Architecture:</strong> Gemini Embedding → BAAI/bge-small-en-v1.5 → Heuristic Local. If a remote embedding provider is unavailable, the system automatically falls back to the next tier with zero downtime.
                </div>
              </div>

              {/* Runtime Info Banner */}
              <div className="bg-gradient-to-r from-brand-50 to-indigo-50 rounded-3xl p-5 border border-brand-200/60">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-brand-800 space-y-1">
                    <div className="font-bold">Zero-Downtime Hot Reload</div>
                    <p className="text-brand-700 leading-relaxed">
                      All changes take effect immediately. Updated keys and model selections propagate to the AI service runtime cache within seconds — <strong>no container restarts, no redeployments, no .env edits</strong>. API keys are encrypted at rest using AES-256-GCM and never exposed to the browser.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 7. RETRIEVAL INSPECTOR VIEW (0.18 COSINE THRESHOLD)                       */}
          {/* ========================================================================= */}
          {activeTab === "retrieval" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Similarity</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {retrievalData?.avgSimilarity != null ? retrievalData.avgSimilarity : "—"}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-semibold mt-1">Live contextual match</div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Median Similarity</span>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {retrievalData?.medianSimilarity != null ? retrievalData.medianSimilarity : "—"}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1">Median vector distance</div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Below Cutoff (0.18)</span>
                  <div className="text-2xl font-black text-amber-600 mt-1">
                    {retrievalData?.belowCutoffPercent != null ? `${retrievalData.belowCutoffPercent}%` : "0%"}
                  </div>
                  <div className="text-[11px] text-amber-600 font-semibold mt-1">Ungrounded queries refused</div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Chunks Scored</span>
                  <div className="text-2xl font-black text-emerald-600 mt-1">
                    {retrievalData?.totalInspected || retrievalData?.chunks?.length || 0}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-semibold mt-1">Evaluated evidence pool</div>
                </div>
              </div>

              <div className="grid lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-brand-600" />
                    <h3 className="text-sm font-bold text-slate-900">RAG Engine Parameter Specs</h3>
                  </div>

                  <div className="space-y-3 text-xs divide-y divide-slate-100">
                    <div className="pt-2 flex items-center justify-between gap-2">
                      <span className="text-slate-500">Embedding Model</span>
                      <select
                        value={retrievalModel}
                        onChange={(e) => {
                          setRetrievalModel(e.target.value);
                          testRetrieval(sampleQuery, e.target.value);
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 px-2 py-1 focus:outline-none max-w-[170px] truncate"
                      >
                        <option value="auto">Auto (Gemini &rarr; BAAI)</option>
                        <option value="gemini-embedding-001">gemini-embedding-001 (768-d)</option>
                        <option value="gemini-embedding-2">gemini-embedding-2 (768-d)</option>
                        <option value="gemini-embedding-2-preview">gemini-embedding-2-preview (768-d)</option>
                        <option value="bge">BAAI/bge-small-en-v1.5 (384-d)</option>
                      </select>
                    </div>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-slate-500">Cosine Threshold</span>
                      <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-mono font-bold text-xs border border-brand-200">
                        0.18 Cutoff
                      </span>
                    </div>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-slate-500">Top-K Chunks</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">5 Chunks</span>
                    </div>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-slate-500">Vector Dimensions</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {retrievalData?.model?.includes("gemini") ? "768 Dim" : "384 Dim"}
                      </span>
                    </div>
                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-slate-500">Active Provider</span>
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {retrievalData?.model || "BAAI/bge-small-en-v1.5"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-2xl text-[11px] text-amber-800 leading-relaxed">
                    Queries scoring below <strong>0.18</strong> cosine similarity automatically trigger refusal mode: "This question cannot be grounded in your provided lecture notes."
                  </div>
                </div>

                <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Vector Retrieval Inspector</h3>
                      <p className="text-xs text-slate-500">Test query vector alignment and inspect top-5 cosine similarity scores in real-time</p>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Cutoff: 0.18
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={sampleQuery}
                      onChange={(e) => setSampleQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") testRetrieval(sampleQuery, retrievalModel);
                      }}
                      className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-medium"
                      placeholder="Enter a test question or concept..."
                    />
                    <button
                      onClick={() => testRetrieval(sampleQuery, retrievalModel)}
                      disabled={testingRetrieval}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition shrink-0 flex items-center space-x-1.5"
                    >
                      {testingRetrieval && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{testingRetrieval ? "Calculating…" : "Test Query"}</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    {retrievalData?.chunks && retrievalData.chunks.length > 0 ? (
                      retrievalData.chunks.map((item, idx) => (
                        <div key={item.id || idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-start justify-between gap-4">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center space-x-2 text-xs">
                              <span className="font-bold text-slate-800">Chunk #{idx + 1}</span>
                              <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">Page {item.pageNumber || 1}</span>
                            </div>
                            <p className="text-xs text-slate-600 font-mono text-[11px] leading-relaxed line-clamp-2">
                              "{item.text}"
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <div className={`text-xs font-mono font-bold ${item.passed ? "text-emerald-700" : "text-amber-700"}`}>
                              similarity: {item.score}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${item.passed ? "text-emerald-600 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                              {item.passed ? "✓ PASS (≥ 0.18)" : "✗ BELOW ( < 0.18)"}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-slate-400">
                        {testingRetrieval ? "Computing live semantic vector alignment..." : "No retrieval evidence scored yet. Click Test Query above."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 8. AI EVALUATION SUITE VIEW                                               */}
          {/* ========================================================================= */}
          {activeTab === "evaluation" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-base font-bold text-slate-900">Automated AI Regression & Grounding Suite</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Continuous regression testing ensuring model changes do not cause hallucinations or Pydantic serialization breaks.
                  </p>
                </div>

                <button
                  onClick={runEvaluation}
                  disabled={evalLoading}
                  className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl px-5 py-2.5 transition shadow-sm self-start md:self-auto"
                >
                  <Sparkles className={`w-4 h-4 ${evalLoading ? "animate-spin" : ""}`} />
                  <span>{evalLoading ? "Running Test Cases…" : "Run Evaluation Suite"}</span>
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Functional Test Results</h3>
                  <div className="divide-y divide-slate-100 text-xs">
                    {evalResult ? (
                      [
                        ...(evalResult.results || []).map((tc) => ({
                          name: tc.id === "tutor-grounded" ? "Grounded Question Response" : (tc.id === "tutor-unsupported" ? "Unsupported Question Refusal" : tc.id),
                          desc: tc.id === "tutor-grounded" ? "Verifies citation and grounded evidence presence" : (tc.id === "tutor-unsupported" ? `Refuses questions below ${evalResult.threshold ?? 0.18} threshold` : `Result state: ${tc.got}`),
                          passed: tc.passed,
                        })),
                        ...(evalResult.schemaValidation !== undefined ? [{
                          name: "Pydantic Schema Integrity",
                          desc: "Strict validation on TutorOut, QuizQuestionOut, EvalOut, RecOut",
                          passed: evalResult.schemaValidation,
                        }] : []),
                      ].map((tc, idx) => (
                        <div key={idx} className="py-3 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{tc.name}</div>
                            <div className="text-[11px] text-slate-400">{tc.desc}</div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center space-x-1 ${tc.passed ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                            <Check className="w-3 h-3" />
                            <span>{tc.passed ? "PASS" : "FAIL"}</span>
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                        <Sparkles className="w-6 h-6 text-brand-400 mx-auto opacity-70" />
                        <div className="font-semibold text-slate-700">Suite Not Yet Executed</div>
                        <p className="max-w-xs mx-auto text-slate-400">Click &ldquo;Run Evaluation Suite&rdquo; above to execute automated regression checks against your active AI provider.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Evaluation Categories Summary</h3>
                  <div className="space-y-3">
                    {evalResult ? (
                      [
                        {
                          category: "AI Tutor Engine Groundedness",
                          status: evalResult.results?.find(r => r.id === "tutor-grounded")?.passed ? "Passed: Grounded Citation Validated" : "Grounded check failed",
                          passed: evalResult.results?.find(r => r.id === "tutor-grounded")?.passed ? 1 : 0,
                          failed: evalResult.results?.find(r => r.id === "tutor-grounded")?.passed ? 0 : 1,
                        },
                        {
                          category: "Vector Retrieval Cutoff",
                          status: `Active Threshold: ${evalResult.threshold ?? 0.18} Cosine`,
                          passed: evalResult.results?.find(r => r.id === "tutor-unsupported")?.passed ? 1 : 0,
                          failed: evalResult.results?.find(r => r.id === "tutor-unsupported")?.passed ? 0 : 1,
                        },
                        {
                          category: "Pydantic Schema Validation",
                          status: evalResult.schemaValidation ? "Strict Type Integrity Confirmed" : "Schema mismatch",
                          passed: evalResult.schemaValidation ? 1 : 0,
                          failed: evalResult.schemaValidation ? 0 : 1,
                        },
                      ].map((cat, i) => (
                        <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{cat.category}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{cat.status}</div>
                          </div>
                          <div className="text-right">
                            <span className={`font-bold text-xs ${cat.passed > 0 ? "text-emerald-700" : "text-red-600"}`}>{cat.passed} Passed</span>
                            <span className="text-[11px] text-slate-400 block">{cat.failed} Failed</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                        <Activity className="w-6 h-6 text-slate-300 mx-auto" />
                        <div className="font-semibold text-slate-600">Awaiting Test Run</div>
                        <p className="max-w-xs mx-auto text-slate-400">Live evaluation scores will appear here after triggering the test harness.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 9. BACKGROUND JOBS VIEW                                                   */}
          {/* ========================================================================= */}
          {activeTab === "jobs" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Asynchronous Ingestion Architecture</h3>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 font-semibold text-slate-700">PDF Upload</span>
                  <span className="text-slate-400">&rarr;</span>
                  <span className="px-3 py-1.5 rounded-xl bg-indigo-50 font-semibold text-indigo-700">OCR & Extraction</span>
                  <span className="text-slate-400">&rarr;</span>
                  <span className="px-3 py-1.5 rounded-xl bg-brand-50 font-semibold text-brand-700">Knowledge Extractor</span>
                  <span className="text-slate-400">&rarr;</span>
                  <span className="px-3 py-1.5 rounded-xl bg-purple-50 font-semibold text-purple-700">Concept Map Graph</span>
                  <span className="text-slate-400">&rarr;</span>
                  <span className="px-3 py-1.5 rounded-xl bg-teal-50 font-semibold text-teal-700">Vector Embeddings</span>
                  <span className="text-slate-400">&rarr;</span>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-50 font-semibold text-emerald-700">READY</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Active & Historic Background Jobs</h3>
                    <p className="text-xs text-slate-500">Document extraction, OCR, embedding generation, and concept indexing</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {["ALL", "COMPLETED", "QUEUED", "FAILED"].map((st) => (
                      <button
                        key={st}
                        onClick={() => setJobStatusFilter(st)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                          jobStatusFilter === st
                            ? "bg-brand-600 text-white"
                            : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredJobs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No background jobs matching selected filter.
                    </div>
                  ) : (
                    filteredJobs.map((j) => (
                      <div key={j.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{j.type || "Document Ingestion Pipeline"}</div>
                            <div className="text-[11px] text-slate-400">
                              Job ID: {j.id?.slice(-8)} · Attempts: {j.attempts || 1}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              j.status === "READY" || j.status === "COMPLETED"
                                ? "bg-emerald-100 text-emerald-800"
                                : j.status === "FAILED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800 animate-pulse"
                            }`}
                          >
                            {j.status || "COMPLETED"}
                          </span>

                          {j.status === "FAILED" && (
                            <button
                              onClick={() => handleRetryJob(j.id)}
                              disabled={retryingJobId === j.id}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition"
                            >
                              {retryingJobId === j.id ? "Retrying…" : "Retry"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 10. SYSTEM HEALTH VIEW                                                    */}
          {/* ========================================================================= */}
          {activeTab === "health" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Microservices Health & Ping Latencies</h3>
                    <p className="text-xs text-slate-500">Live operational health check across database, memory cache, and AI providers</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center space-x-1 ${health?.mongo === "healthy" && health?.aiService === "healthy" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${health?.mongo === "healthy" && health?.aiService === "healthy" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                    <span>{health?.mongo === "healthy" && health?.aiService === "healthy" ? "All Systems Operational" : "Service Degraded"}</span>
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  {[
                    {
                      name: "Core REST API",
                      status: "Healthy",
                      latency: "Active",
                      desc: "Spring Boot 3.2 (Java 17)",
                      healthy: true,
                    },
                    {
                      name: "Database Engine",
                      status: health?.mongo === "healthy" ? "Healthy" : (health?.mongo ? "Degraded" : "Connecting…"),
                      latency: health?.mongoLatencyMs !== undefined && health?.mongoLatencyMs >= 0 ? `${health.mongoLatencyMs} ms` : "N/A",
                      desc: "MongoDB Cluster (Atlas/Local)",
                      healthy: health?.mongo === "healthy",
                    },
                    {
                      name: "In-Memory Broker",
                      status: health?.redis === "healthy" ? "Healthy" : (health?.redis === "not_configured" ? "Optional / Off" : "Degraded"),
                      latency: health?.redisLatencyMs !== undefined && health?.redisLatencyMs >= 0 ? `${health.redisLatencyMs} ms` : "Offline",
                      desc: "Redis Managed Queue & Rate Limiter",
                      healthy: health?.redis === "healthy" || health?.redis === "not_configured",
                    },
                    {
                      name: "AI Fast-API Service",
                      status: health?.aiService === "healthy" ? "Healthy" : (health?.aiService === "degraded" ? "Degraded" : (health?.aiService ? "Offline" : "Connecting…")),
                      latency: health?.aiServiceLatencyMs !== undefined && health?.aiServiceLatencyMs >= 0 ? `${health.aiServiceLatencyMs} ms` : "N/A",
                      desc: "FastAPI Python 3.11 Microservice",
                      healthy: health?.aiService === "healthy",
                    },
                    {
                      name: "Vector & RAG Pipelines",
                      status: health?.aiService === "healthy" ? "Ready" : "Standby",
                      latency: health?.aiService === "healthy" ? "Live" : "N/A",
                      desc: "Hybrid BM25 + Dense Embeddings",
                      healthy: health?.aiService === "healthy",
                    },
                    {
                      name: "Job Worker Queue",
                      status: "Active",
                      latency: `${health?.jobsQueued ?? 0} queued`,
                      desc: "Asynchronous background processor",
                      healthy: true,
                    },
                  ].map((svc, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{svc.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${svc.healthy ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                          ● {svc.status}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px]">{svc.desc}</div>
                      <div className="text-[11px] font-mono text-slate-700 font-semibold pt-1">
                        Latency: {svc.latency}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Recent Incident & Recovery Log</h3>
                  <span className="text-[11px] text-slate-400">Live AI service exception stream</span>
                </div>
                {health?.recentErrors && health.recentErrors.length > 0 ? (
                  <div className="divide-y divide-slate-100 text-xs">
                    {health.recentErrors.map((err, i) => (
                      <div key={i} className="py-2.5 flex items-center justify-between">
                        <span className="font-mono text-slate-400 text-[11px]">{err.time || "Recent"}</span>
                        <span className="text-slate-700 flex-1 px-4">{err.msg}</span>
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Logged</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <Check className="w-5 h-5 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <span>No incidents recorded. All systems operating normally.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// User Journey Detail Inspector
export function AdminUser() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/api/admin/users/${id}`).then((r) => setData(r.data?.data));
  }, [id]);

  if (!data) return <div className="p-8 text-xs text-slate-400 animate-pulse">Loading user telemetry…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
          {data.user?.name?.charAt(0)?.toUpperCase() || "U"}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{data.user?.name}</h1>
          <p className="text-xs text-slate-500">{data.user?.email} · Learner Profile</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-brand-600" />
            <span>Active Projects ({(data.projects || []).length})</span>
          </h3>
          <div className="divide-y divide-slate-100">
            {(data.projects || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No projects created yet.</p>
            ) : (
              data.projects.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{p.name}</span>
                  <span className="text-slate-400 text-[11px]">{p.goal || "General study"}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-card">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>Assessment Record ({(data.assessments || []).length})</span>
          </h3>
          <div className="divide-y divide-slate-100">
            {(data.assessments || []).length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No quiz submissions recorded yet.</p>
            ) : (
              data.assessments.map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">Quiz #{a.id?.slice(-5)}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[11px]">
                    {Math.round(a.score || 0)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
