import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { 
  Compass, 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  Clock, 
  Calendar, 
  BookOpen, 
  ArrowRight,
  ListTodo,
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  RotateCcw
} from "lucide-react";
import api from "../api";
import ProjectTabs from "../components/ProjectTabs";
import { useToast } from "../components/Toast";

export default function StudyPlan() {
  const { id } = useParams();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();

  const loadPlan = () => {
    setLoading(true);
    api.get(`/api/projects/${id}/study-plan`)
      .then((r) => setPlan(r.data.data))
      .catch((err) => console.error("Load plan error", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlan();
  }, [id]);

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const r = await api.post(`/api/projects/${id}/study-plan/generate`);
      setPlan(r.data.data);
      toast.push("Personalized study roadmap generated!", "success");
    } catch (e) {
      toast.push(e.response?.data?.message || "Failed to generate study plan", "error");
    } finally {
      setGenerating(false);
    }
  };

  const toggleMilestone = async (milestoneNumber) => {
    try {
      const r = await api.post(`/api/projects/${id}/study-plan/milestones/${milestoneNumber}/toggle`);
      setPlan(r.data.data);
    } catch (e) {
      toast.push("Failed to update milestone status", "error");
    }
  };

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingNum, setEditingNum] = useState(null);
  const [msForm, setMsForm] = useState({ title: "", description: "", targetDays: 3, actionItems: "" });

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    if (!msForm.title.trim()) return;
    try {
      const items = msForm.actionItems ? msForm.actionItems.split("\n").map(s => s.trim()).filter(Boolean) : [];
      const res = await api.post(`/api/projects/${id}/study-plan/milestones`, {
        title: msForm.title.trim(),
        description: msForm.description.trim(),
        targetDays: Number(msForm.targetDays) || 3,
        actionItems: items
      });
      setPlan(res.data.data);
      setIsAddOpen(false);
      setMsForm({ title: "", description: "", targetDays: 3, actionItems: "" });
      toast.push("Milestone added to roadmap!", "success");
    } catch (err) {
      toast.push(err.response?.data?.message || "Failed to add milestone", "error");
    }
  };

  const handleEditMilestone = async (e) => {
    e.preventDefault();
    if (!editingNum) return;
    try {
      const items = msForm.actionItems ? msForm.actionItems.split("\n").map(s => s.trim()).filter(Boolean) : [];
      const res = await api.put(`/api/projects/${id}/study-plan/milestones/${editingNum}`, {
        title: msForm.title.trim(),
        description: msForm.description.trim(),
        targetDays: Number(msForm.targetDays) || 3,
        actionItems: items
      });
      setPlan(res.data.data);
      setIsEditOpen(false);
      toast.push("Milestone updated!", "success");
    } catch (err) {
      toast.push(err.response?.data?.message || "Failed to update milestone", "error");
    }
  };

  const handleDeleteMilestone = async (num) => {
    if (!window.confirm(`Delete Milestone #${num}?`)) return;
    try {
      const res = await api.delete(`/api/projects/${id}/study-plan/milestones/${num}`);
      setPlan(res.data.data);
      toast.push(`Milestone #${num} removed`, "info");
    } catch (err) {
      toast.push(err.response?.data?.message || "Failed to delete milestone", "error");
    }
  };

  const handleResetPlan = async () => {
    if (!window.confirm("Are you sure you want to reset this study roadmap? This will delete all milestones.")) return;
    try {
      await api.delete(`/api/projects/${id}/study-plan`);
      setPlan(null);
      toast.push("Study plan reset successfully", "info");
    } catch (err) {
      toast.push(err.response?.data?.message || "Failed to reset plan", "error");
    }
  };

  const milestones = plan?.milestones || [];
  const completed = plan?.completedMilestones || [];
  const progressPct = milestones.length > 0 ? Math.round((completed.length / milestones.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <ProjectTabs />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-sm">
              <Compass className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Personalized Learning Roadmap</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
              PRD Sec 20 · Milestones
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Goal-oriented milestones with concrete reading tasks, tutor prompts, and quiz checkpoints.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setMsForm({ title: "", description: "", targetDays: 3, actionItems: "" });
              setIsAddOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5 text-brand-600" />
            <span>Add Milestone</span>
          </button>

          {plan && (
            <button
              onClick={handleResetPlan}
              className="inline-flex items-center space-x-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-semibold px-3 py-2.5 rounded-xl shadow-xs transition"
              title="Reset study plan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={generatePlan}
            disabled={generating}
            className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <Sparkles className={`w-4 h-4 ${generating ? "animate-spin" : ""}`} />
            <span>{generating ? "Calibrating Roadmap…" : (plan ? "Re-generate" : "Generate Study Plan")}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-sm text-slate-400 animate-pulse">
          Loading learning plan…
        </div>
      ) : !plan || milestones.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <ListTodo className="w-12 h-12 text-brand-500 mx-auto mb-3 opacity-80" />
          <h3 className="text-base font-bold text-slate-900">No Study Roadmap Created</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Click below to generate a tailored step-by-step roadmap targeting your weak concepts and project goals.
          </p>
          <button
            onClick={generatePlan}
            disabled={generating}
            className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Personalized Study Roadmap</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Plan Overview Banner */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider">Active Study Roadmap</span>
              <h2 className="text-xl font-bold text-slate-900">{plan.title}</h2>
              <p className="text-xs text-slate-600 leading-relaxed">{plan.overview}</p>
            </div>

            <div className="flex items-center space-x-6 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase">Target Horizon</div>
                <div className="text-lg font-bold text-slate-900 mt-0.5 flex items-center space-x-1.5">
                  <Calendar className="w-4 h-4 text-brand-600" />
                  <span>{plan.targetCompletionDays || 14} Days</span>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase">Roadmap Progress</div>
                <div className="text-lg font-bold text-emerald-600 mt-0.5 flex items-center space-x-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span>{progressPct}% Done</span>
                </div>
              </div>
            </div>
          </div>

          {/* Milestones Vertical Timeline */}
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Roadmap Milestones ({completed.length}/{milestones.length} Completed)
            </div>

            <div className="space-y-3.5">
              {milestones.map((m, idx) => {
                const num = m.milestoneNumber || (idx + 1);
                const isDone = completed.includes(num);

                return (
                  <div
                    key={num}
                    className={`bg-white rounded-2xl border p-5 transition-all ${
                      isDone
                        ? "border-emerald-200/80 bg-emerald-50/20 shadow-xs"
                        : "border-slate-200 shadow-card hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start space-x-3.5">
                        <button
                          onClick={() => toggleMilestone(num)}
                          className="mt-0.5 text-slate-400 hover:text-emerald-600 transition"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              Milestone #{num}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center space-x-1">
                              <Clock className="w-3 h-3" />
                              <span>{m.estimatedHours || 2.5} hrs</span>
                            </span>
                          </div>
                          <h3 className={`text-base font-bold mt-1.5 ${isDone ? "line-through text-slate-500" : "text-slate-900"}`}>
                            {m.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{m.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          onClick={() => toggleMilestone(num)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition ${
                            isDone
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {isDone ? "Completed ✓" : "Mark Done"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNum(num);
                            setMsForm({
                              title: m.title || "",
                              description: m.description || "",
                              targetDays: m.targetDays || 3,
                              actionItems: (m.actionableTasks || []).join("\n")
                            });
                            setIsEditOpen(true);
                          }}
                          title="Edit milestone"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMilestone(num)}
                          title="Delete milestone"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Action Items */}
                    {m.actionableTasks?.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 pl-8 space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Prescribed Actions:
                        </div>
                        {m.actionableTasks.map((task, ti) => (
                          <div key={ti} className="text-xs text-slate-700 flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                            <span>{task}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Milestone Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {isAddOpen ? "Add Study Milestone" : `Edit Milestone #${editingNum}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setIsEditOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={isAddOpen ? handleAddMilestone : handleEditMilestone} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Milestone Title *</label>
                <input
                  type="text"
                  required
                  value={msForm.title}
                  onChange={(e) => setMsForm({ ...msForm, title: e.target.value })}
                  placeholder="e.g. Master Gradient Descent & Backpropagation"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Target Outcome</label>
                <textarea
                  rows={3}
                  value={msForm.description}
                  onChange={(e) => setMsForm({ ...msForm, description: e.target.value })}
                  placeholder="Understand loss function formulation, compute partial derivatives, and implement optimization loop."
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Days</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={msForm.targetDays}
                  onChange={(e) => setMsForm({ ...msForm, targetDays: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Action Tasks (one per line)</label>
                <textarea
                  rows={3}
                  value={msForm.actionItems}
                  onChange={(e) => setMsForm({ ...msForm, actionItems: e.target.value })}
                  placeholder={"Read Lecture 4 slides\nDerive chain rule equations\nPass 5-question checkpoint quiz"}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setIsEditOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-xs transition"
                >
                  {isAddOpen ? "Add Milestone" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
