import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import ProjectTabs from "../components/ProjectTabs";
import { ProgressRing, StatusBadge, MetricCard, EmptyState } from "../components/Widgets";
import { 
  Sparkles, 
  BrainCircuit, 
  FileText, 
  TrendingUp, 
  ArrowRight, 
  Target,
  CheckCircle2,
  BookOpen,
  Compass
} from "lucide-react";

export default function ProjectDashboard() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/projects/${id}`)
      .then((r) => setData(r.data.data))
      .catch((err) => console.error("Project load failed", err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div>
        <ProjectTabs />
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-slate-200 rounded-xl w-1/3"></div>
          <div className="h-4 bg-slate-200 rounded-xl w-1/2"></div>
          <div className="grid md:grid-cols-3 gap-4 pt-4">
            <div className="h-36 bg-slate-200 rounded-2xl"></div>
            <div className="h-36 bg-slate-200 rounded-2xl"></div>
            <div className="h-36 bg-slate-200 rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.project) {
    return (
      <div>
        <ProjectTabs />
        <EmptyState
          icon={Compass}
          title="Project not found"
          description="Could not load details for this project."
          actionLabel="Back to Spaces"
          onAction={() => (window.location.href = "/spaces")}
        />
      </div>
    );
  }

  const { project, concepts = [], materials = [], recommendations = [], avgMastery = 0 } = data;
  const readyMaterials = materials.filter((m) => m.status === "READY");
  const roundedMastery = Math.round(avgMastery);
  const nextRec = recommendations?.[0]?.text;

  return (
    <div className="space-y-6">
      <ProjectTabs />

      {/* Project Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200/60 px-2 py-0.5 rounded-md">
              Project Workspace
            </span>
            <StatusBadge status={project.status || "ACTIVE"} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {project.name}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {project.goal || project.description || "Master core concepts through course notes, grounded tutoring, and adaptive assessments."}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap sm:flex-col gap-2.5 shrink-0">
          <Link
            to={`/projects/${id}/tutor`}
            className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <Sparkles className="w-4 h-4" />
            Ask AI Tutor
          </Link>
          <Link
            to={`/projects/${id}/quiz`}
            className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-xs font-semibold px-4 py-2.5 rounded-xl transition"
          >
            <BrainCircuit className="w-4 h-4 text-slate-500" />
            Start Adaptive Quiz
          </Link>
          <Link
            to={`/projects/${id}/materials`}
            className="inline-flex items-center justify-center gap-2 text-slate-500 hover:text-slate-800 text-xs font-medium px-3 py-1.5 transition"
          >
            <FileText className="w-3.5 h-3.5" />
            Upload Materials
          </Link>
        </div>
      </div>

      {/* Primary Learning Loop Step Tracker (PRD Page 1) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          Primary Learning Loop
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <Link to={`/projects/${id}/materials`} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 hover:border-brand-300 transition block">
            <div className="flex items-center justify-between text-muted mb-1">
              <span>Step 1</span>
              <FileText className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <div className="font-bold text-slate-900">Add Materials</div>
            <div className="text-[11px] text-muted mt-0.5">{materials.length} files ({readyMaterials.length} ready)</div>
          </Link>

          <Link to={`/projects/${id}/tutor`} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 hover:border-brand-300 transition block">
            <div className="flex items-center justify-between text-muted mb-1">
              <span>Step 2</span>
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <div className="font-bold text-slate-900">Learn with AI</div>
            <div className="text-[11px] text-muted mt-0.5">Grounded answers & citations</div>
          </Link>

          <Link to={`/projects/${id}/quiz`} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 hover:border-brand-300 transition block">
            <div className="flex items-center justify-between text-muted mb-1">
              <span>Step 3</span>
              <BrainCircuit className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <div className="font-bold text-slate-900">Adaptive Quiz</div>
            <div className="text-[11px] text-muted mt-0.5">Evaluate understanding</div>
          </Link>

          <Link to={`/projects/${id}/growth`} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 hover:border-brand-300 transition block">
            <div className="flex items-center justify-between text-muted mb-1">
              <span>Step 4</span>
              <TrendingUp className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <div className="font-bold text-slate-900">Concept Mastery</div>
            <div className="text-[11px] text-muted mt-0.5">{roundedMastery}% current mastery</div>
          </Link>

          <Link to={`/projects/${id}/growth`} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 hover:border-brand-300 transition block">
            <div className="flex items-center justify-between text-muted mb-1">
              <span>Step 5</span>
              <Target className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <div className="font-bold text-slate-900">Next Action</div>
            <div className="text-[11px] text-muted mt-0.5">AI growth guidance</div>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card flex items-center justify-between">
          <ProgressRing
            value={roundedMastery}
            size={90}
            strokeWidth={9}
            label="Project Mastery"
            sublabel={`${concepts.length} concepts indexed`}
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              <Target className="w-3.5 h-3.5 text-brand-600" />
              <span>Recommended Next Step</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-relaxed">
              {nextRec || (readyMaterials.length === 0 ? "Upload a PDF in Materials to extract concepts." : "Take a 5-question adaptive quiz to evaluate concept mastery.")}
            </p>
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <Link
              to={`/projects/${id}/${readyMaterials.length === 0 ? "materials" : "quiz"}`}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              {readyMaterials.length === 0 ? "Upload Materials →" : "Start Quiz Now →"}
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Uploaded Materials</span>
              <Link to={`/projects/${id}/materials`} className="text-xs font-semibold text-brand-600 hover:underline">
                View All ({materials.length})
              </Link>
            </div>
            {materials.length > 0 ? (
              <div className="space-y-2 mt-2">
                {materials.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <span className="font-medium text-slate-800 truncate pr-2">{m.fileName}</span>
                    <StatusBadge status={m.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted py-3">No PDFs uploaded yet. Upload lecture notes to get started.</p>
            )}
          </div>
          <div className="pt-3 border-t border-slate-100">
            <Link to={`/projects/${id}/materials`} className="text-xs text-slate-500 hover:text-slate-900 block text-center font-medium">
              + Upload New PDF Material
            </Link>
          </div>
        </div>
      </div>

      {/* Key Concepts List (PRD Page 10) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Extracted Concepts & Estimated Mastery</h3>
            <p className="text-xs text-muted">Concepts automatically extracted from your course materials and updated as you take quizzes.</p>
          </div>
          <Link to={`/projects/${id}/growth`} className="text-xs font-semibold text-brand-600 hover:underline shrink-0">
            Growth Breakdown →
          </Link>
        </div>

        {concepts.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {concepts.map((c) => {
              const score = Math.round(c.masteryScore || 40);
              return (
                <div key={c.id} className="p-4 rounded-xl border border-slate-200/60 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-slate-800 truncate">{c.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-slate-700">{score}%</span>
                      <StatusBadge status={c.trend || "STABLE"} />
                    </div>
                  </div>
                  {c.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{c.description}</p>
                  )}
                  <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-brand-600" : "bg-amber-500"
                      }`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No concepts extracted yet"
            description="Concepts will be automatically discovered once you upload your lecture notes or PDF textbooks in the Materials tab."
            actionLabel="Go to Materials"
            onAction={() => (window.location.href = `/projects/${id}/materials`)}
          />
        )}
      </div>
    </div>
  );
}
