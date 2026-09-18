import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { 
  AlertTriangle, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  HelpCircle, 
  ShieldAlert,
  BrainCircuit,
  FileQuestion
} from "lucide-react";
import api from "../api";
import ProjectTabs from "../components/ProjectTabs";
import { useToast } from "../components/Toast";

export default function Mistakes() {
  const { id } = useParams();
  const [data, setData] = useState({ mistakes: [], repeatedMistakesContext: [] });
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const toast = useToast();

  const loadMistakes = () => {
    setLoading(true);
    api.get(`/api/projects/${id}/mistakes`)
      .then((r) => setData(r.data.data || { mistakes: [], repeatedMistakesContext: [] }))
      .catch((err) => console.error("Load mistakes error", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMistakes();
  }, [id]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await api.post(`/api/projects/${id}/mistakes/analyze`);
      setAnalysis(res.data.data?.data);
      toast.push("AI Misconception Analysis complete!", "success");
      loadMistakes();
    } catch (e) {
      toast.push(e.response?.data?.message || "Analysis failed", "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const mistakes = data.mistakes || [];
  const patterns = analysis?.patterns || [];

  return (
    <div className="space-y-6">
      <ProjectTabs />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-sm">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Repeated-Mistake Patterns</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              PRD Sec 13 & 14
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Asynchronous background analyzer identifying recurring misconception patterns across quizzes.
          </p>
        </div>

        <button
          onClick={runAnalysis}
          disabled={analyzing || mistakes.length === 0}
          className="inline-flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition self-start sm:self-auto"
        >
          <Sparkles className={`w-4 h-4 ${analyzing ? "animate-spin" : ""}`} />
          <span>{analyzing ? "Diagnosing Patterns…" : "Analyze Misconceptions"}</span>
        </button>
      </div>

      {loading ? (
        <div className="h-64 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-sm text-slate-400 animate-pulse">
          Loading mistake history…
        </div>
      ) : mistakes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
          <h3 className="text-base font-bold text-slate-900">Zero Mistakes Recorded</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            No quiz mistakes found in this project yet! Keep taking adaptive assessments to discover your areas for improvement.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Misconception Patterns Section */}
          {patterns.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Diagnosed Misconception Traps
              </div>
              <div className="space-y-3">
                {patterns.map((p, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-rose-200/90 shadow-card p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <h4 className="text-sm font-bold text-slate-900">{p.patternName}</h4>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        p.severity === "HIGH" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {p.severity || "MEDIUM"} Severity
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 leading-relaxed bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                      <span className="font-semibold text-rose-900 block mb-0.5">Root Misconception:</span>
                      {p.rootMisconception}
                    </div>

                    <div className="flex items-start space-x-2 text-xs text-emerald-800 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block mb-0.5">Targeted Remediation Action:</span>
                        {p.remediationAction}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Mistakes History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Assessment Mistakes History ({mistakes.length})</span>
              <span className="text-[11px] font-normal lowercase text-slate-400">recent incorrect answers</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card divide-y divide-slate-100 overflow-hidden">
              {mistakes.map((m) => (
                <div key={m.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {m.conceptName || "General Concept"}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "Recent"}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                    {m.questionText}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100 text-rose-800">
                      <span className="text-[10px] font-bold text-rose-600 uppercase block">Your Answer:</span>
                      {m.selectedAnswer || "None selected"}
                    </div>

                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase block">Correct Answer:</span>
                      {m.correctAnswer || "See explanation"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
