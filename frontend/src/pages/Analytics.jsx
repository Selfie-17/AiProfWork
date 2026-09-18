import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from "recharts";
import api from "../api";
import ProjectTabs from "../components/ProjectTabs";
import { MetricCard, EmptyState } from "../components/Widgets";
import { 
  BarChart3, 
  Activity, 
  BrainCircuit, 
  BookOpen, 
  FolderKanban, 
  TrendingUp, 
  ArrowRight,
  Sparkles
} from "lucide-react";

export default function ProjectAnalytics() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/analytics/project/${id}`)
      .then((r) => setData(r.data.data))
      .catch((err) => console.error("Analytics load failed", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div>
        <ProjectTabs />
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-slate-200 rounded-xl w-1/3"></div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="h-28 bg-slate-200 rounded-2xl"></div>
            <div className="h-28 bg-slate-200 rounded-2xl"></div>
            <div className="h-28 bg-slate-200 rounded-2xl"></div>
          </div>
          <div className="h-64 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  const activity = Object.entries(data?.activityByDay || {}).map(([day, count]) => ({
    day: day.slice(5), // MM-DD
    count,
  }));

  const chartData = activity.length > 0 ? activity : Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (4 - i));
    return {
      day: d.toISOString().slice(5, 10),
      count: 0,
    };
  });

  return (
    <div className="space-y-6">
      <ProjectTabs />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-600" />
          <span>Project Learning Analytics</span>
        </h1>
        <p className="text-sm text-muted mt-1">
          Quantitative telemetry of your learning interactions, quiz attempts, and daily study activity.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Recorded Events"
          value={data?.eventCount || 0}
          subtitle="Tutor chats, uploads, quizzes"
          icon={Activity}
        />
        <MetricCard
          title="Avg Quiz Score"
          value={`${Math.round(data?.avgQuizScore || 0)}%`}
          subtitle="Across completed assessments"
          icon={BrainCircuit}
        />
        <MetricCard
          title="Active Concepts"
          value={(data?.concepts || []).length}
          subtitle="Indexed in knowledge graph"
          icon={BookOpen}
        />
        <MetricCard
          title="AI Telemetry"
          value="Monitored"
          subtitle="Trace ID active in headers"
          icon={Sparkles}
        />
      </div>

      {/* Activity Chart */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Daily Study Activity</h3>
            <p className="text-xs text-muted">Total learning events and AI operations per day</p>
          </div>
          <span className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200/60 px-2.5 py-0.5 rounded-md">
            Event Frequency
          </span>
        </div>

        <div className="h-64 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F172A",
                  borderRadius: "12px",
                  border: "none",
                  color: "#FFFFFF",
                  fontSize: "12px",
                  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                }}
                formatter={(val) => [`${val} interactions`, "Activity"]}
              />
              <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} maxBarSize={45} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function GlobalAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/analytics/global")
      .then((r) => setData(r.data.data))
      .catch((err) => console.error("Global analytics load failed", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded-xl w-1/3"></div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="h-28 bg-slate-200 rounded-2xl"></div>
          <div className="h-28 bg-slate-200 rounded-2xl"></div>
          <div className="h-28 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  const projects = data?.projects || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Activity className="w-7 h-7 text-brand-600" />
          <span>Global Learning Analytics</span>
        </h1>
        <p className="text-sm text-muted mt-1">
          Aggregated learning intelligence, mastery benchmarks, and engagement across all Spaces and Projects.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
        <MetricCard
          title="Total Projects"
          value={data?.totalProjects || 0}
          subtitle="Learning journeys active"
          icon={FolderKanban}
        />
        <MetricCard
          title="Total Platform Events"
          value={data?.totalEvents || 0}
          subtitle="Interactions & background jobs"
          icon={Activity}
        />
        <MetricCard
          title="Aggregate Mastery"
          value={`${Math.round(data?.overallMastery || 0)}%`}
          subtitle="Weighted concept average"
          icon={TrendingUp}
        />
      </div>

      {/* Projects Telemetry Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Project Telemetry Breakdown</h3>
            <p className="text-xs text-muted">Comparative view of mastery and interaction frequency per project</p>
          </div>
          <span className="text-xs font-semibold text-slate-500">{projects.length} Total</span>
        </div>

        {projects.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {projects.map((p) => (
              <div key={p.projectId} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/50 transition">
                <div>
                  <Link
                    to={`/projects/${p.projectId}`}
                    className="text-sm font-bold text-slate-900 hover:text-brand-600 transition flex items-center gap-1.5"
                  >
                    <span>{p.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                  <div className="text-xs text-muted mt-0.5">
                    ID: {p.projectId}
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs">
                  <div className="text-right">
                    <span className="text-muted block text-[11px]">Avg Mastery</span>
                    <span className="font-bold text-slate-900">{Math.round(p.avgMastery || 0)}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted block text-[11px]">Activity Events</span>
                    <span className="font-bold text-slate-900">{p.activity || 0}</span>
                  </div>
                  <Link
                    to={`/projects/${p.projectId}`}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-muted">
            No project activity records available yet.
          </div>
        )}
      </div>
    </div>
  );
}
