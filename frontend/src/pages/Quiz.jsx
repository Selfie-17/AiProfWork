import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import ProjectTabs from "../components/ProjectTabs";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { 
  BrainCircuit, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  ArrowRight, 
  RotateCcw, 
  Sparkles,
  Award,
  AlertTriangle,
  BookOpen
} from "lucide-react";

export default function Quiz() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/api/quiz/start", { projectId: id });
      setQuiz(res.data.data.quiz);
      setQuestion(res.data.data.question);
      setFeedback(null);
      setSummary(null);
      setAnswer("");
    } catch (ex) {
      setError(ex.response?.data?.message || "Could not start quiz. Upload a PDF in the Materials tab and wait until it shows Ready.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!answer.trim() || loading) return;
    setLoading(true);
    try {
      const res = await api.post(`/api/quiz/${quiz.id}/answer`, { questionId: question.id, answer });
      setFeedback(res.data.data.evaluation);
    } catch (ex) {
      setError(ex.response?.data?.message || "Failed to submit answer.");
    } finally {
      setLoading(false);
    }
  };

  const next = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/api/quiz/${quiz.id}/next`);
      if (res.data.data.assessment) {
        setSummary(res.data.data);
        setQuestion(null);
        setFeedback(null);
      } else {
        setQuestion(res.data.data.question);
        setFeedback(null);
        setAnswer("");
      }
    } catch (ex) {
      setError(ex.response?.data?.message || "Failed to load next question.");
    } finally {
      setLoading(false);
    }
  };

  const letters = ["A", "B", "C", "D", "E"];

  return (
    <div className="space-y-6">
      <ProjectTabs />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-brand-600" />
            <span>Adaptive Concept Assessment</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Tests conceptual understanding and application dynamically calibrated to your notes and performance.
          </p>
        </div>

        {!quiz && (
          <button
            disabled={loading}
            onClick={start}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition shadow-sm self-start sm:self-auto shrink-0"
          >
            <BrainCircuit className="w-4 h-4" />
            {loading ? "Synthesizing Quiz…" : "Start Adaptive Quiz"}
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Initial Landing State before Quiz */}
      {!quiz && !summary && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-card space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-xs">
            <BrainCircuit className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Ready to test your knowledge?</h2>
          <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
            The adaptive assessment system queries your uploaded documents to generate 5 targeted questions across your weakest and strongest concepts.
          </p>
          <div className="pt-2">
            <button
              onClick={start}
              disabled={loading}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl px-6 py-3 text-sm transition shadow-sm"
            >
              {loading ? "Analyzing Materials…" : "Begin 5-Question Quiz"}
            </button>
          </div>
        </div>
      )}

      {/* Active Question Card */}
      {question && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 sm:p-8 space-y-6">
          {/* Metadata Row */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg uppercase tracking-wider">
                {question.type} · {question.difficulty}
              </span>
              <span className="text-xs text-muted">
                Concept: <strong className="text-slate-800">{question.conceptName || "Course Concept"}</strong>
              </span>
            </div>
            <span className="text-xs font-semibold text-brand-600 bg-brand-50 border border-brand-200/50 px-2 py-0.5 rounded-md">
              Question in Progress
            </span>
          </div>

          {/* Question Text */}
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed">
            {question.question}
          </h2>

          {/* Options / Input */}
          {question.options?.length ? (
            <div className="space-y-3">
              {question.options.map((o, idx) => {
                const isSelected = answer === o;
                const isCorrect = feedback?.correctAnswer && o.trim().toLowerCase() === feedback.correctAnswer.trim().toLowerCase();
                const isChosenWrong = feedback && isSelected && !isCorrect;

                let cardStyle = "border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 text-slate-700";
                if (feedback) {
                  if (isCorrect) {
                    cardStyle = "border-emerald-500 bg-emerald-50/90 text-emerald-950 font-semibold ring-2 ring-emerald-400";
                  } else if (isChosenWrong) {
                    cardStyle = "border-rose-400 bg-rose-50 text-rose-900 ring-1 ring-rose-300 line-through opacity-80";
                  } else {
                    cardStyle = "border-slate-200 bg-slate-50/40 text-slate-400 opacity-60";
                  }
                } else if (isSelected) {
                  cardStyle = "border-brand-600 bg-brand-50/50 ring-1 ring-brand-600 text-slate-900 font-semibold";
                }

                return (
                  <label
                    key={idx}
                    className={`flex items-start gap-3.5 p-4 rounded-xl border transition ${cardStyle} ${
                      feedback ? "pointer-events-none" : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name="quiz_option"
                      className="mt-1"
                      checked={isSelected}
                      onChange={() => setAnswer(o)}
                      disabled={!!feedback}
                    />
                    <div className="flex-1 text-sm leading-normal">
                      <span className="font-bold mr-2 text-slate-500">{letters[idx]}.</span>
                      <span>{o}</span>
                      {feedback && isCorrect && (
                        <span className="ml-2.5 text-[11px] font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Correct Choice
                        </span>
                      )}
                      {feedback && isChosenWrong && (
                        <span className="ml-2.5 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Your Choice
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div>
              <textarea
                className="w-full border border-slate-200 focus:border-brand-500 outline-none rounded-xl p-4 text-sm transition bg-slate-50 focus:bg-white"
                rows={5}
                placeholder="Write your explanation based on the principles in your uploaded notes…"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={!!feedback}
              />
            </div>
          )}

          {/* Submit Button */}
          {!feedback && (
            <div className="pt-2">
              <button
                disabled={loading || !answer.trim()}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-semibold rounded-xl px-6 py-2.5 text-sm transition shadow-sm"
                onClick={submit}
              >
                {loading ? "Evaluating Answer…" : "Submit Answer"}
              </button>
            </div>
          )}

          {/* Evaluation & Feedback Box */}
          {feedback && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-800">Concept Takeaway & Feedback</span>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-lg ${
                    (feedback.score ?? 0) >= 0.7
                      ? "bg-emerald-100 text-emerald-800"
                      : (feedback.score ?? 0) >= 0.4
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  Score: {Math.round((feedback.score ?? 0) * 100)}%
                </span>
              </div>

              {feedback.correctAnswer && !feedback.correct && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950">
                  <span className="font-bold">Correct Answer:</span> {feedback.correctAnswer}
                </div>
              )}

              <div className="bg-white p-4 rounded-xl border border-slate-200/70">
                <MarkdownRenderer content={feedback.feedback} />
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-3 bg-white rounded-xl border border-slate-100">
                  <div className="font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Points Understood
                  </div>
                  <div className="text-slate-600">{(feedback.understood || []).join(", ") || "None identified"}</div>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100">
                  <div className="font-semibold text-amber-700 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Points to Review
                  </div>
                  <div className="text-slate-600">{(feedback.missing || []).join(", ") || "None"}</div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  disabled={loading}
                  onClick={next}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl px-6 py-2.5 text-sm transition shadow-sm flex items-center gap-1.5"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completion Summary Card (PRD Page 9 & 10) */}
      {summary && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 sm:p-10 space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center text-3xl shadow-xs">
            🎉
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900">Quiz Completed!</h2>
            <p className="text-xs text-muted">Your concept mastery levels have been updated dynamically.</p>
          </div>

          <div className="py-2">
            <div className="text-4xl font-extrabold text-brand-600 tracking-tight">
              {Math.round(summary.quiz.score)}%
            </div>
            <div className="text-xs text-muted uppercase font-semibold tracking-wider mt-1">
              Overall Assessment Score
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-left max-w-xl mx-auto text-xs">
            <div className="p-4 bg-emerald-50/60 border border-emerald-200/60 rounded-xl space-y-1">
              <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Demonstrated Strengths
              </div>
              <div className="text-emerald-700 leading-relaxed">
                {(summary.assessment.strengths || []).join(", ") || "Solid understanding demonstrated."}
              </div>
            </div>

            <div className="p-4 bg-amber-50/60 border border-amber-200/60 rounded-xl space-y-1">
              <div className="font-bold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Concepts Requiring Focus
              </div>
              <div className="text-amber-700 leading-relaxed">
                {(summary.assessment.weaknesses || []).join(", ") || "No critical weak spots detected."}
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={start}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl px-5 py-2.5 text-xs transition shadow-sm flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Take Another Quiz
            </button>
            <Link
              to={`/projects/${id}/growth`}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl px-5 py-2.5 text-xs transition"
            >
              View Concept Growth Analysis →
            </Link>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
