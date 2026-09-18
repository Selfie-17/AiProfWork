import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useToast } from "../components/Toast";
import { EmptyState } from "../components/Widgets";
import { useAuth } from "../AuthContext";
import { 
  FolderKanban, 
  Plus, 
  ArrowRight, 
  X, 
  Layers, 
  BookOpen, 
  Sparkles,
  Compass,
  ShieldCheck
} from "lucide-react";

export default function Spaces() {
  const { user } = useAuth();
  const [spaces, setSpaces] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", colorTheme: "indigo" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const load = () => {
    api.get("/api/spaces")
      .then((r) => setSpaces(r.data.data || []))
      .catch((err) => console.error("Spaces load failed", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/api/spaces", form);
      toast.push("Space created successfully!");
      setForm({ name: "", description: "", colorTheme: "indigo" });
      setOpen(false);
      load();
    } catch (ex) {
      toast.push(ex.response?.data?.message || "Failed to create space");
    } finally {
      setSubmitting(false);
    }
  };

  const themes = [
    { id: "indigo", label: "Indigo", bg: "from-indigo-500 to-brand-600", bar: "bg-indigo-600" },
    { id: "emerald", label: "Emerald", bg: "from-emerald-500 to-teal-600", bar: "bg-emerald-600" },
    { id: "amber", label: "Amber", bg: "from-amber-500 to-orange-600", bar: "bg-amber-500" },
    { id: "rose", label: "Rose", bg: "from-rose-500 to-pink-600", bar: "bg-rose-500" },
    { id: "sky", label: "Sky", bg: "from-sky-500 to-blue-600", bar: "bg-sky-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Compass className="w-7 h-7 text-brand-600" />
            <span>Learning Spaces</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Spaces organize broad domains, degrees, or certifications (e.g., "Computer Science", "CFA Exam", "Bioinformatics").
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Space
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
              <span className="text-brand-800">Showing all {spaces.length} spaces created across all registered learners and courses.</span>
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

      {/* Spaces Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          <div className="h-44 bg-slate-200 rounded-2xl"></div>
          <div className="h-44 bg-slate-200 rounded-2xl"></div>
          <div className="h-44 bg-slate-200 rounded-2xl"></div>
        </div>
      ) : spaces.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {spaces.map((s) => {
            const theme = themes.find((t) => t.id === s.colorTheme) || themes[0];
            return (
              <Link
                key={s.id}
                to={`/spaces/${s.id}`}
                className="group bg-white rounded-2xl border border-slate-200/80 p-6 shadow-card hover:shadow-card-hover hover:border-brand-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className={`h-2.5 w-10 rounded-full ${theme.bar}`} />
                    <span className="text-[11px] font-bold text-muted bg-slate-100 px-2 py-0.5 rounded-md uppercase">
                      Space
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 group-hover:text-brand-600 transition">
                    {s.name}
                  </h3>
                  <p className="text-xs text-muted mt-1.5 line-clamp-3 leading-relaxed">
                    {s.description || "Organized learning journey with focused projects and materials."}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium group-hover:text-slate-900 transition">View Projects</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="No Spaces created yet"
          description="Create your first Space to organize your courses, subjects, or learning goals."
          actionLabel="Create First Space"
          onAction={() => setOpen(true)}
        />
      )}

      {/* Create Space Modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={create}
            className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 w-full max-w-lg space-y-4 shadow-modal animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-brand-600" />
                <span>Create New Learning Space</span>
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Space Name</label>
              <input
                required
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-sm outline-none transition"
                placeholder="e.g., Computer Science, Deep Learning, USMLE Step 1"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Description & Goals</label>
              <textarea
                rows={3}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-xl px-3.5 py-2.5 text-sm outline-none transition"
                placeholder="Briefly describe the topics and disciplines organized in this space…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Accent Color Tag</label>
              <div className="flex items-center gap-3">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setForm({ ...form, colorTheme: t.id })}
                    className={`w-7 h-7 rounded-full ${t.bar} transition ${
                      form.colorTheme === t.id ? "ring-3 ring-offset-2 ring-brand-500 scale-110" : "opacity-80 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !form.name.trim()}
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-5 py-2 rounded-xl transition shadow-sm"
              >
                {submitting ? "Creating…" : "Create Space"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
