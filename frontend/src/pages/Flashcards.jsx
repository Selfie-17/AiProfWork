import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { 
  Layers, 
  RotateCw, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  ChevronLeft,
  Flame,
  BrainCircuit,
  Eye,
  Shuffle,
  Trophy,
  Zap,
  BookOpen,
  Keyboard,
  Award,
  MessageSquare
} from "lucide-react";
import api from "../api";
import ProjectTabs from "../components/ProjectTabs";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { useToast } from "../components/Toast";

export default function Flashcards() {
  const { id } = useParams();
  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [streak, setStreak] = useState(3);
  const [xp, setXp] = useState(60);
  const [showCelebration, setShowCelebration] = useState(false);
  const [filterDueOnly, setFilterDueOnly] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const toast = useToast();

  const [searchParams] = useSearchParams();
  const targetConcept = searchParams.get("concept");

  const loadCards = useCallback(() => {
    setLoading(true);
    api.get(`/api/projects/${id}/flashcards`)
      .then((r) => {
        const cards = r.data.data?.cards || [];
        setDeck(cards);
        if (targetConcept && cards.length > 0) {
          const matchIdx = cards.findIndex(
            (c) => (c.conceptName || "").toLowerCase().includes(targetConcept.toLowerCase()) ||
                   (c.front || "").toLowerCase().includes(targetConcept.toLowerCase())
          );
          if (matchIdx !== -1) {
            setCurrentIndex(matchIdx);
            return;
          }
        }
        if (cards.length > 0 && currentIndex >= cards.length) {
          setCurrentIndex(0);
        }
      })
      .catch((err) => toast.push("Failed to load flashcards: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, [id, currentIndex, toast, targetConcept]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const activeCards = filterDueOnly
    ? deck.filter((c) => !c.nextReviewDate || new Date(c.nextReviewDate) <= new Date())
    : deck;

  const currentCard = activeCards[currentIndex];

  const generateCards = async () => {
    setGenerating(true);
    try {
      const r = await api.post(`/api/projects/${id}/flashcards/generate`);
      setDeck(r.data.data || []);
      setCurrentIndex(0);
      setFlipped(false);
      setIsCompleted(false);
      toast.push(`Generated ${r.data.data?.length || 0} active-recall flashcards from course materials!`, "success");
    } catch (e) {
      toast.push(e.response?.data?.message || "Flashcard generation failed", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleReview = async (quality) => {
    if (!currentCard) return;

    try {
      const res = await api.post(`/api/projects/${id}/flashcards/${currentCard.id}/review`, { quality });
      const updatedCard = res.data.data;

      // Update deck state
      setDeck((prev) => prev.map((c) => (c.id === updatedCard.id ? updatedCard : c)));
      
      // Gamification XP boost & celebration
      if (quality >= 3) {
        setXp((prev) => prev + (quality === 5 ? 20 : 10));
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 900);
      }

      setFlipped(false);

      if (currentIndex < activeCards.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsCompleted(true);
        toast.push("🎉 Session complete! All cards in deck reviewed.", "success");
      }
    } catch (e) {
      toast.push("Failed to submit review: " + e.message, "error");
    }
  };

  const shuffleDeck = () => {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setFlipped(false);
    setIsCompleted(false);
    toast.push("Deck shuffled!", "info");
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      if (["input", "textarea"].includes(e.target.tagName?.toLowerCase())) return;

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped) {
        if (e.key === "1") handleReview(1);
        if (e.key === "2") handleReview(2);
        if (e.key === "3") handleReview(3);
        if (e.key === "4" || e.key === "5") handleReview(5);
      } else {
        if (e.code === "ArrowRight") {
          setCurrentIndex((i) => Math.min(activeCards.length - 1, i + 1));
        } else if (e.code === "ArrowLeft") {
          setCurrentIndex((i) => Math.max(0, i - 1));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flipped, activeCards.length, currentCard]);

  const dueCount = deck.filter((c) => !c.nextReviewDate || new Date(c.nextReviewDate) <= new Date()).length;
  const progressPct = activeCards.length > 0 ? Math.round(((currentIndex + (isCompleted ? 1 : 0)) / activeCards.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <ProjectTabs />

      <div className="max-w-4xl mx-auto space-y-6 select-none">
        {/* Gamified Header Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-brand-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Active Recall Arena</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                SM-2 Spaced Repetition
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Reinforce long-term memory with evidence-based interval schedules.
            </p>
          </div>
        </div>

        {/* Gamification Stats: Streak & XP */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-xs">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
            <span>{streak} Day Streak</span>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold shadow-xs">
            <Zap className="w-4 h-4 text-indigo-600 fill-indigo-600" />
            <span>{xp} XP</span>
          </div>

          <button
            onClick={generateCards}
            disabled={generating}
            className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm transition"
          >
            <Sparkles className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
            <span>{generating ? "Synthesizing…" : "New Cards"}</span>
          </button>
        </div>
      </div>

      {/* Progress & Deck Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Progress Bar */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Progress: {currentIndex + 1} of {activeCards.length || 0} cards</span>
            <span className="text-brand-600">{progressPct}% Complete</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-brand-600 to-indigo-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Deck Filter & Shuffle */}
        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={() => {
              setFilterDueOnly(!filterDueOnly);
              setCurrentIndex(0);
              setFlipped(false);
              setIsCompleted(false);
            }}
            className={`px-3 py-1.5 rounded-xl font-semibold border transition text-xs flex items-center space-x-1.5 ${
              filterDueOnly
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Due Today ({dueCount})</span>
          </button>

          <button
            onClick={shuffleDeck}
            disabled={deck.length === 0}
            className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl transition shadow-xs"
            title="Shuffle deck"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Flashcard Stage */}
      {loading ? (
        <div className="h-80 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center space-y-3 text-slate-400 animate-pulse">
          <Layers className="w-10 h-10 text-brand-400 animate-bounce" />
          <span className="text-xs font-medium">Preparing active-recall cards…</span>
        </div>
      ) : activeCards.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-inner">
            <BrainCircuit className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {filterDueOnly ? "No Cards Due for Review Today!" : "No Flashcards Generated Yet"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {filterDueOnly
                ? "You've reviewed all scheduled cards for now. Switch to 'All Cards' to practice anytime."
                : "Synthesize high-yield active-recall cards from your uploaded PDF lecture notes."}
            </p>
          </div>
          <button
            onClick={generateCards}
            disabled={generating}
            className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-brand-500/20 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Synthesize Flashcard Deck</span>
          </button>
        </div>
      ) : isCompleted ? (
        /* Celebration Completed Stage */
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card p-10 text-center space-y-5 animate-fadeIn">
          <div className="w-20 h-20 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-md">
            <Trophy className="w-10 h-10" />
          </div>
          <div>
            <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">Session Complete</span>
            <h2 className="text-2xl font-black text-slate-900 mt-1">Outstanding Effort!</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5">
              You reviewed all {activeCards.length} cards in this study run. Next intervals have been calibrated with the SM-2 algorithm.
            </p>
          </div>

          <div className="grid grid-cols-2 max-w-xs mx-auto gap-3 text-left">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Cards Reviewed</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{activeCards.length} Cards</div>
            </div>
            <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">XP Awarded</span>
              <div className="text-lg font-bold text-emerald-800 mt-0.5">+{activeCards.length * 15} XP</div>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              onClick={() => {
                setCurrentIndex(0);
                setFlipped(false);
                setIsCompleted(false);
              }}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              Review Deck Again
            </button>
            <button
              onClick={shuffleDeck}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Shuffle & Replay</span>
            </button>
          </div>
        </div>
      ) : (
        /* Active 3D Flipping Card Stage */
        <div className="space-y-5">
          {/* Card Wrapper with 3D perspective */}
          <div
            style={{ perspective: "1400px" }}
            className="w-full min-h-[320px] cursor-pointer group"
            onClick={() => setFlipped(!flipped)}
          >
            <div
              style={{
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                transition: "transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1)",
              }}
              className="w-full h-full min-h-[320px] relative select-none"
            >
              {/* FRONT FACE */}
              <div
                style={{ backfaceVisibility: "hidden" }}
                className="absolute inset-0 w-full h-full bg-white rounded-3xl border-2 border-slate-200 group-hover:border-brand-300 shadow-card p-7 sm:p-9 flex flex-col justify-between transition-shadow duration-300 group-hover:shadow-lg"
              >
                {/* Front Top Meta */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
                    <span className="px-2.5 py-1 rounded-xl bg-brand-50 text-brand-700 font-bold text-[11px] border border-brand-200/60">
                      {currentCard?.conceptName || "Concept"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
                    <span>Interval: {currentCard?.interval || 1}d</span>
                    <span>·</span>
                    <span>Ease: {(currentCard?.easeFactor || 2.5).toFixed(2)}</span>
                  </div>
                </div>

                {/* Front Question / Equation */}
                <div className="my-auto py-6">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Active Recall Challenge
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-slate-900 leading-snug">
                    <MarkdownRenderer content={currentCard?.front || ""} />
                  </div>
                </div>

                {/* Front Bottom Prompt */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-[11px]">
                    Card {currentIndex + 1} of {activeCards.length}
                  </span>
                  <div className="flex items-center space-x-3">
                    <Link
                      to={`/projects/${id}/tutor?prompt=${encodeURIComponent(`Explain ${currentCard?.conceptName || "this concept"} in detail with formulas and examples: ${currentCard?.front || ""}`)}`}
                      state={{
                        prompt: `Explain ${currentCard?.conceptName || "this concept"} in detail with formulas and examples: ${currentCard?.front || ""}`,
                        autoSend: true
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-slate-500 hover:text-brand-600 font-semibold text-[11px] flex items-center space-x-1 transition"
                      title="Ask AI Tutor about this card"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
                      <span>Ask AI Tutor</span>
                    </Link>
                    <span className="text-brand-600 font-semibold flex items-center space-x-1.5 group-hover:translate-x-0.5 transition-transform">
                      <Eye className="w-3.5 h-3.5" />
                      <span>Click or [Space] to flip</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* BACK FACE (Rotated 180deg) */}
              <div
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
                className="absolute inset-0 w-full h-full bg-white rounded-3xl border-2 border-emerald-300 shadow-card p-7 sm:p-9 flex flex-col justify-between"
              >
                {/* Back Top Meta */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                      Answer & Derivation
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    {currentCard?.conceptName || "Mastery Check"}
                  </span>
                </div>

                {/* Back Answer Content */}
                <div className="my-auto py-6">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Grounded Explanation</span>
                  </div>
                  <div className="text-base md:text-lg text-slate-800 leading-relaxed font-medium">
                    <MarkdownRenderer content={currentCard?.back || ""} />
                  </div>
                </div>

                {/* Back Bottom Note */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span className="text-[11px]">
                    Rate your recall difficulty below to calibrate SM-2 schedule
                  </span>
                  <Link
                    to={`/projects/${id}/tutor?prompt=${encodeURIComponent(`Explain ${currentCard?.conceptName || "this concept"} in detail with formulas and examples: ${currentCard?.front || ""}`)}`}
                    state={{
                      prompt: `Explain ${currentCard?.conceptName || "this concept"} in detail with formulas and examples: ${currentCard?.front || ""}`,
                      autoSend: true
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-brand-600 hover:text-brand-800 font-bold text-[11px] flex items-center space-x-1 hover:underline"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
                    <span>Ask AI Tutor about this concept &rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* SM-2 Rating Controls / Floating Dock */}
          {flipped ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card p-5 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">How well did you recall this? (Keys 1-4)</span>
                <span className="text-slate-400 text-[11px]">SM-2 calculates next optimal review time</span>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {/* Again */}
                <button
                  onClick={() => handleReview(1)}
                  className="py-3 px-3 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 rounded-2xl border border-rose-200 transition text-center shadow-xs group"
                >
                  <div className="font-black text-sm flex items-center justify-center space-x-1">
                    <span>Again</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-rose-200/60 font-mono text-rose-900">1</span>
                  </div>
                  <div className="text-[11px] text-rose-500 font-medium mt-0.5">Reset · 1 Day</div>
                </button>

                {/* Hard */}
                <button
                  onClick={() => handleReview(2)}
                  className="py-3 px-3 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-700 rounded-2xl border border-amber-200 transition text-center shadow-xs group"
                >
                  <div className="font-black text-sm flex items-center justify-center space-x-1">
                    <span>Hard</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-amber-200/60 font-mono text-amber-900">2</span>
                  </div>
                  <div className="text-[11px] text-amber-600 font-medium mt-0.5">Short Step · 2-3d</div>
                </button>

                {/* Good */}
                <button
                  onClick={() => handleReview(3)}
                  className="py-3 px-3 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 rounded-2xl border border-indigo-200 transition text-center shadow-xs group"
                >
                  <div className="font-black text-sm flex items-center justify-center space-x-1">
                    <span>Good</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-indigo-200/60 font-mono text-indigo-900">3</span>
                  </div>
                  <div className="text-[11px] text-indigo-500 font-medium mt-0.5">Standard · 4-6d</div>
                </button>

                {/* Easy */}
                <button
                  onClick={() => handleReview(5)}
                  className="py-3 px-3 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 rounded-2xl border border-emerald-200 transition text-center shadow-xs group relative overflow-hidden"
                >
                  <div className="font-black text-sm flex items-center justify-center space-x-1">
                    <span>Easy</span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-200/60 font-mono text-emerald-900">4</span>
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium mt-0.5">Mastered · 8-12d</div>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">Want deeper intuition or derivation?</span>
                <Link
                  to={`/projects/${id}/tutor?prompt=${encodeURIComponent(`Explain ${currentCard?.conceptName || "this concept"} in detail with formulas and examples: ${currentCard?.front || ""}`)}`}
                  state={{
                    prompt: `Explain ${currentCard?.conceptName || "this concept"} in detail with formulas and examples: ${currentCard?.front || ""}`,
                    autoSend: true
                  }}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-xl transition shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
                  <span>Ask AI Tutor about {currentCard?.conceptName || "this concept"} &rarr;</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Pre-flip Navigation Bar */
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  setFlipped(false);
                  setCurrentIndex((prev) => Math.max(0, prev - 1));
                }}
                disabled={currentIndex === 0}
                className="inline-flex items-center space-x-1 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-xl hover:bg-slate-100 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <button
                onClick={() => setFlipped(true)}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-xs font-bold rounded-2xl shadow-md shadow-brand-500/25 transition flex items-center space-x-2"
              >
                <span>Reveal Grounded Answer</span>
                <Eye className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  setFlipped(false);
                  setCurrentIndex((prev) => Math.min(activeCards.length - 1, prev + 1));
                }}
                disabled={currentIndex >= activeCards.length - 1}
                className="inline-flex items-center space-x-1 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-xl hover:bg-slate-100 transition"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Keyboard Shortcuts Cheatsheet */}
          <div className="flex items-center justify-center space-x-4 text-[11px] text-slate-400 pt-2">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600">Space</kbd>
              <span>Flip Card</span>
            </span>
            <span>·</span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600">1 - 4</kbd>
              <span>Recall Rating</span>
            </span>
            <span>·</span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600">&larr; / &rarr;</kbd>
              <span>Navigate</span>
            </span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
