import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../AuthContext";
import { ProgressRing, MetricCard, EmptyState } from "../components/Widgets";
import { 
  Sparkles, 
  ArrowRight, 
  BrainCircuit, 
  BookOpen, 
  FolderKanban, 
  AlertTriangle, 
  TrendingUp,
  Target,
  FileText,
  Compass
} from "lucide-react";

export default function Home() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/home")
      .then((r) => setData(r.data.data))
      .catch((err) => console.error("Home load failed", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-xl w-1/3"></div>
        <div className="grid md:grid-cols-3 gap-5">
          <div className="md:col-span-2 h-44 bg-slate-200 rounded-2xl"></div>
          <div className="h-44 bg-slate-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  const projects = data?.projects || [];
  const currentProject = data?.continueLearning;
  const overallMastery = Math.round(data?.overallMastery || 0);
  const attention = data?.attention || [];
  const recommended = data?.recommended;

  return (
    <div className="space-y-8">
      {/* Top Greeting Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.name?.split(" ")[0] || "Student"} 👋
          </h1>
          <p className="text-sm text-muted mt-1">
            Track your concept mastery, review uploaded materials, and continue your guided learning journey.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/spaces"
            className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs hover:bg-slate-50 transition"
          >
            <Compass className="w-4 h-4 text-brand-600" />
            Explore Spaces
          </Link>
          {currentProject && (
            <Link
              to={`/projects/${currentProject.id}/quiz`}
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition"
            >
              <BrainCircuit className="w-4 h-4" />
              Quick Quiz
            </Link>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <MetricCard
          title="Overall Mastery"
          value={`${overallMastery}%`}
          subtitle="Across all indexed concepts"
          icon={TrendingUp}
          trend={overallMastery >= 50 ? "+8% this week" : null}
        />
        <MetricCard
          title="Active Projects"
          value={projects.length}
          subtitle="Focused learning journeys"
          icon={FolderKanban}
        />
        <MetricCard
          title="Attention Areas"
          value={attention.length}
          subtitle={attention.length === 0 ? "All concepts healthy" : "Concepts below 50% mastery"}
          icon={AlertTriangle}
        />
        <MetricCard
          title="AI Tutor Status"
          value="Online"
          subtitle="Gemini 3.6-flash Active"
          icon={Sparkles}
        />
      </div>

      {/* Hero Continue Learning & Mastery Section */}
      <div className="grid md:grid-cols-3 gap-5">
        {/* Continue Learning Primary Card */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-brand-50/60 to-transparent pointer-events-none rounded-bl-full" />
          
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Resume Active Study Session</span>
            </div>

            {currentProject ? (
              <>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {currentProject.name}
                </h2>
                <p className="text-sm text-slate-600 mt-2 line-clamp-2 max-w-xl">
                  {currentProject.goal || currentProject.description || "Master core concepts through grounded notes and adaptive tests."}
                </p>
                
                <div className="flex flex-wrap items-center gap-3 mt-6">
                  <Link
                    to={`/projects/${currentProject.id}/tutor`}
                    className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Ask AI Tutor
                  </Link>
                  <Link
                    to={`/projects/${currentProject.id}/quiz`}
                    className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold px-4 py-2.5 rounded-xl transition"
                  >
                    <BrainCircuit className="w-3.5 h-3.5 text-slate-500" />
                    Take Adaptive Quiz
                  </Link>
                  <Link
                    to={`/projects/${currentProject.id}/materials`}
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 text-xs font-medium px-3 py-2 transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Manage Materials
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-4">
                <p className="text-sm text-slate-600">You haven't created any learning projects yet.</p>
                <Link
                  to="/spaces"
                  className="inline-flex items-center gap-2 mt-4 bg-brand-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  Create Your First Space & Project →
                </Link>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-muted">
            <span>Primary Loop: Materials → Tutor → Quiz → Mastery → Growth</span>
            {currentProject && (
              <Link to={`/projects/${currentProject.id}`} className="text-brand-600 font-semibold hover:underline flex items-center gap-1">
                Project Details <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Overall Mastery Ring Widget */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Concept Readiness</span>
            <div className="mt-4 flex justify-center py-2">
              <ProgressRing value={overallMastery} size={110} strokeWidth={10} />
            </div>
          </div>
          <div className="text-xs text-slate-500 text-center border-t border-slate-100 pt-3">
            {overallMastery >= 75
              ? "Strong grasp across core concepts. Ready for exam practice!"
              : overallMastery >= 40
              ? "Solid progress. Complete more quizzes to strengthen weaker topics."
              : "Early stage. Upload your course PDFs and start asking the AI Tutor."}
          </div>
        </div>
      </div>

      {/* Two-Column: Attention Areas & Recommended Next Action */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Areas Needing Attention */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Areas Requiring Attention</h3>
            </div>
            <span className="text-xs font-medium text-muted">{attention.length} flagged</span>
          </div>

          {attention.length > 0 ? (
            <div className="space-y-3">
              {attention.slice(0, 5).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60 hover:bg-white hover:border-slate-300 transition"
                >
                  <div className="truncate pr-3">
                    <div className="font-semibold text-xs text-slate-800 truncate">{item.concept}</div>
                    <div className="text-[11px] text-muted truncate">Project: {item.projectName}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                      {Math.round(item.score)}% Mastery
                    </span>
                    <Link
                      to={`/projects/${item.projectId}/quiz`}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                    >
                      Practice →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted">
              <span className="text-2xl block mb-2">🎯</span>
              No concepts currently below threshold. Great job maintaining high mastery!
            </div>
          )}
        </div>

        {/* Recommended Next Action */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Recommended Next Action</h3>
            </div>

            {recommended ? (
              <div className="bg-gradient-to-br from-brand-50/50 to-indigo-50/30 border border-brand-100 p-4 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                  {recommended.text}
                </p>
                {recommended.reason && (
                  <p className="text-xs text-muted italic">
                    Why: {recommended.reason}
                  </p>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-muted">
                <span className="text-2xl block mb-2">💡</span>
                Complete a quiz or ask the tutor a question to generate personalized learning recommendations.
              </div>
            )}
          </div>

          {currentProject && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <Link
                to={`/projects/${currentProject.id}/growth`}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1"
              >
                View Full Growth Analysis <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent Projects Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Recent Learning Projects</h3>
          <Link to="/spaces" className="text-xs font-semibold text-brand-600 hover:underline">
            View All Spaces →
          </Link>
        </div>

        {projects.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="group bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-card-hover hover:border-brand-300 transition block"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider">
                    {p.status || "Active"}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 mt-3 group-hover:text-brand-600 transition">
                  {p.name}
                </h4>
                <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                  {p.goal || p.description || "Comprehensive subject learning and quiz evaluation."}
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-muted">
                  <span>Open project workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create a Space and your first Project to start studying with AI."
            actionLabel="Go to Spaces"
            onAction={() => (window.location.href = "/spaces")}
          />
        )}
      </div>
    </div>
  );
}
