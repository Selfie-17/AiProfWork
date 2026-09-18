import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, ShieldCheck, BookOpen, BrainCircuit, CheckCircle2, Lock, Mail, User } from "lucide-react";
import api from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../components/Toast";

export default function Login({ mode = "login" }) {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await api.post(path, form);
      login(res.data.data);
      toast.push(`Welcome, ${res.data.data.name}!`, "success");
      nav("/home");
    } catch (ex) {
      const msg = ex.response?.data?.message || "Unable to authenticate. Please check your credentials.";
      setErr(msg);
      toast.push(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email, password) => {
    setForm({ name: "Demo User", email, password });
  };

  return (
    <div className="min-h-screen bg-canvas grid lg:grid-cols-12 text-slate-900 font-sans">
      {/* Left Hero Pane */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 bg-gradient-to-br from-slate-50 via-brand-50/40 to-indigo-50/30 p-14 flex-col justify-between border-r border-slate-200/80 relative overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-brand-500/20">
            L
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-lg tracking-tight">Lumina Study</div>
            <div className="text-xs text-slate-500 font-medium">Autonomous Learning Workspace</div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-lg space-y-6 my-auto">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-100/80 text-brand-700 text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-POWERED LEARNING & GROWTH</span>
          </div>
          
          <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
            Turn course documents into <span className="text-brand-600 bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent">mastered knowledge</span>.
          </h1>
          
          <p className="text-base text-slate-600 leading-relaxed">
            Not another disconnected chatbot. Lumina pairs evidence-grounded AI tutoring with adaptive quizzes, KaTeX formula formatting, and measurable concept mastery.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-white/80 border border-slate-200/70 shadow-sm backdrop-blur-sm">
              <BookOpen className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-900">Grounded Citations</div>
                <div className="text-[11px] text-slate-500">Every response traced to exact PDF pages</div>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-white/80 border border-slate-200/70 shadow-sm backdrop-blur-sm">
              <BrainCircuit className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-slate-900">Adaptive Quizzing</div>
                <div className="text-[11px] text-slate-500">AI questions calibrate to concept weak spots</div>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 border-t border-slate-200/60 pt-6">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Strict Project Context Isolation</span>
          </div>
          <span>Version 3.0 · Candidate Edition</span>
        </div>
      </div>

      {/* Right Form Pane */}
      <div className="lg:col-span-6 xl:col-span-5 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-7">
          {/* Mobile Brand */}
          <div className="flex lg:hidden items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              L
            </div>
            <div>
              <div className="font-semibold text-slate-900 text-base">Lumina Study</div>
              <div className="text-xs text-slate-500">Autonomous Learning Workspace</div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {mode === "register" ? "Create your learning workspace" : "Welcome back"}
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              {mode === "register" 
                ? "Enter your details to begin your guided study journey."
                : "Sign in to resume your active projects and adaptive quizzes."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    required
                    type="text"
                    placeholder="e.g. Alex Chen"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  required
                  type="email"
                  placeholder="name@university.edu"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-700">Password</label>
                {mode === "login" && (
                  <span className="text-xs text-brand-600 hover:text-brand-700 cursor-pointer">
                    Forgot password?
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  required
                  type="password"
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>

            {err && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                {err}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl text-sm shadow-sm transition flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Authenticating…</span>
              ) : (
                <>
                  <span>{mode === "register" ? "Create Account" : "Sign In to Workspace"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="pt-2 border-t border-slate-200/80">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Quick Test Credentials
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemo("student@example.com", "password123")}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium transition text-left"
              >
                <div className="font-semibold text-slate-900">Student Account</div>
                <div className="text-[11px] text-slate-500 truncate">student@example.com</div>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("admin@example.com", "adminpassword123")}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium transition text-left"
              >
                <div className="font-semibold text-slate-900">Admin Account</div>
                <div className="text-[11px] text-slate-500 truncate">admin@example.com</div>
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-slate-500">
            {mode === "register" ? (
              <>
                Already have an account?{" "}
                <Link className="font-semibold text-brand-600 hover:text-brand-700" to="/login">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to Lumina?{" "}
                <Link className="font-semibold text-brand-600 hover:text-brand-700" to="/register">
                  Create a free workspace
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
