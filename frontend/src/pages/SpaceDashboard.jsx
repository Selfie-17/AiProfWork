import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import { useToast } from "../components/Toast";
import { EmptyState } from "../components/Widgets";
import { useAuth } from "../AuthContext";
import { 
  FolderKanban, 
  Plus, 
  ArrowRight, 
  BookOpen, 
  Sparkles, 
  Target,
  FileText,
  ChevronLeft,
  ShieldCheck
} from "lucide-react";

export default function SpaceDashboard() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", goal: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = () => {
    api.get(`/api/spaces/${id}`)
      .then((r) => setData(r.data.data))
      .catch((err) => console.error("Space load failed", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/api/projects", { ...form, spaceId: id });
      toast.push("Project created successfully!");
      setForm({ name: "", description: "", goal: "" });
      setShowCreate(false);
      load();
    } catch (ex) {
      toast.push(ex.response?.data?.message || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-24 mb-4"></div>
        <div className="h-10 bg-slate-200 rounded-xl w-1/3"></div>
        <div className="h-4 bg-slate-200 rounded-xl w-1/2"></div>
      </div>
    );
  }

  if (!data || !data.space) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Space not found"
        description="Could not locate this learning space."
        actionLabel="Back to Spaces"
        onAction={() => (window.location.href = "/spaces")}
      />
    );
  }

  const { space, projects = [] } = data;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/spaces"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-slate-900 transition"
      >
        <ChevronLeft className="w-4 h-4" />
        All Spaces
      </Link>

      {/* Space Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <span className="text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200/60 px-2 py-0.5 rounded-md">
            Learning Space
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {space.name}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {space.description || "Organized learning journey with dedicated projects and materials."}
          </p>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {user?.role === "ADMIN" && (
        <div className="bg-brand-50/80 border border-brand-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-brand-900 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-6 h-6 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-bold text-brand-950">Platform Administrator View: </span>
              <span className="text-brand-800">Showing all {projects.length} learning projects created by all learners inside this space.</span>
            </div>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center space-x-1 font-bold text-brand-700 hover:text-brand-900 underline shrink-0"
          >
            <span>Admin Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Create Project Card Form */}
      {showCreate && (
        <form
          onSubmit={create}
          className="bg-white rounded-2xl border border-brand-200 p-6 shadow-card space-y-4 animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-600" />
              <span>Create Project in {space.name}</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-xs text-muted hover:text-slate-900"
            >
              Cancel
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Project Name</label>
              <input
                required
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2 text-xs outline-none transition"
                placeholder="e.g., K-Nearest Neighbors, Attention Mechanism"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Description</label>
              <input
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2 text-xs outline-none transition"
                placeholder="What this project covers…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Learning Goal</label>
              <input
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2 text-xs outline-none transition"
                placeholder="e.g., Score >85% on midterm practice"
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting || !form.name.trim()}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-5 py-2 rounded-xl transition shadow-sm"
            >
              {submitting ? "Creating…" : "Save & Open Project"}
            </button>
          </div>
        </form>
      )}

      {/* Projects Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Projects in this Space ({projects.length})
          </h3>
        </div>

        {projects.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="group bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-card-hover hover:border-brand-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-xs group-hover:scale-105 transition">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                      {p.status || "Active"}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-brand-600 transition">
                    {p.name}
                  </h4>
                  <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                    {p.goal || p.description || "Interactive AI tutoring and adaptive assessments."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium group-hover:text-slate-900 transition">Open Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No projects in this Space yet"
            description="Add your first focused project to upload notes and begin studying."
            actionLabel="Add First Project"
            onAction={() => setShowCreate(true)}
          />
        )}
      </div>
    </div>
  );
}
