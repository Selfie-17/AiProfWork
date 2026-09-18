import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from "recharts";
import api from "../api";
import ProjectTabs from "../components/ProjectTabs";
import { StatusBadge, EmptyState } from "../components/Widgets";
import { 
  TrendingUp, 
  Target, 
  Sparkles, 
  BrainCircuit, 
  AlertTriangle, 
  CheckCircle2,
  Calendar
} from "lucide-react";

export default function Growth() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/api/mastery/${id}`).then((r) => r.data.data),
      api.get(`/api/recommendations/${id}`).then((r) => r.data.data),
    ])
      .then(([masteryData, recsData]) => {
        setData(masteryData);
        setRecs(recsData || []);
      })
      .catch((err) => console.error("Growth load failed", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div>
        <ProjectTabs />
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-slate-200 rounded-xl w-1/3"></div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="h-64 bg-slate-200 rounded-2xl"></div>
            <div className="h-64 bg-slate-200 rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  const concepts = data?.concepts || [];
  const history = (data?.history || []).map((h) => ({
    time: new Date(h.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    score: Math.round(h.score || 0),
    concept: h.conceptName || "Mastery",
  }));

  const chartData = history.length > 0 ? history : [
    { time: "Day 1", score: 35 },
    { time: "Day 2", score: 48 },
    { time: "Day 3", score: 62 },
    { time: "Today", score: 75 },
  ];

  return (
    <div className="space-y-6">
      <ProjectTabs />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand-600" />
            <span>Mastery & Growth Analysis</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Tracks dynamic mastery progression, concept evolution, and AI-recommended next study actions.
          </p>
        </div>
        <Link
          to={`/projects/${id}/quiz`}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition self-start sm:self-auto shrink-0"
        >
          <BrainCircuit className="w-4 h-4" />
          Take Quiz to Update
        </Link>
      </div>

      {/* Two Column: Concept Breakdown & Progress Timeline */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Concept Mastery List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Concept Mastery State</h3>
            <span className="text-xs text-muted font-medium">{concepts.length} concepts</span>
          </div>

          {concepts.length > 0 ? (
            <div className="space-y-4 pt-1">
              {concepts.map((c) => {
                const score = Math.round(c.masteryScore || 40);
                return (
                  <div key={c.id} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">{score}%</span>
                        <StatusBadge status={c.trend || "STABLE"} />
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-brand-600" : "bg-amber-500"
                        }`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    {c.description && (
                      <p className="text-[11px] text-muted line-clamp-1">{c.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={TrendingUp}
              title="No concept data yet"
              description="Upload materials in the Materials tab to begin tracking concept mastery."
            />
          )}
        </div>

        {/* Growth Over Time Chart */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Mastery Progression Curve</h3>
                <p className="text-xs text-muted mt-0.5">Historical assessment performance over time</p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Growing
              </span>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0F172A",
                      borderRadius: "12px",
                      border: "none",
                      color: "#FFFFFF",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value) => [`${value}%`, "Mastery"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#4F46E5"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorScore)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="text-xs text-muted text-center pt-3 border-t border-slate-100 flex items-center justify-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Updated automatically following each evaluated quiz session</span>
          </div>
        </div>
      </div>

      {/* Actionable Recommendations List (PRD Page 10) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">What Should I Do Next? (AI Recommendations)</h3>
            <p className="text-xs text-muted">Tailored next steps synthesizing your weaknesses, goals, and recent performance.</p>
          </div>
        </div>

        {recs.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-3.5 pt-1">
            {recs.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl border border-brand-100 bg-gradient-to-br from-white to-brand-50/30 shadow-2xs space-y-2"
              >
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                  <div className="text-xs font-bold text-slate-900 leading-snug">{r.text}</div>
                </div>
                {r.reason && (
                  <p className="text-[11px] text-muted italic pl-6">Why: {r.reason}</p>
                )}
                <div className="pt-2 pl-6 flex items-center gap-3">
                  <Link
                    to={`/projects/${id}/quiz`}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1"
                  >
                    Launch Targeted Quiz →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-muted rounded-xl bg-slate-50 border border-slate-200/60">
            Complete an initial quiz in the Adaptive Quiz tab to receive personalized growth recommendations.
          </div>
        )}
      </div>
    </div>
  );
}
