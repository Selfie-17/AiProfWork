import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { 
  Sparkles, 
  Home, 
  FolderKanban, 
  BarChart2, 
  ShieldCheck, 
  LogOut, 
  GraduationCap
} from "lucide-react";

export default function AppShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const navItem = (to, label, Icon) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition ${
          isActive
            ? "bg-brand-50 text-brand-700 shadow-sm border border-brand-200/50 font-semibold"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
        }`
      }
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </NavLink>
  );

  const initials = (user?.name || "User")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col antialiased">
      {/* SaaS Light Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Mark */}
          <div className="flex items-center gap-6">
            <NavLink to="/home" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 tracking-tight text-base flex items-center gap-1.5">
                  Lumina Study
                  <span className="bg-brand-50 text-brand-700 border border-brand-200/60 font-semibold text-[10px] px-1.5 py-0.2 rounded-md">
                    AI
                  </span>
                </span>
                <span className="text-[10px] text-muted block -mt-0.5 font-medium tracking-wide">
                  Autonomous Learning Companion
                </span>
              </div>
            </NavLink>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-slate-200">
              {navItem("/home", "Dashboard", Home)}
              {navItem("/spaces", "Spaces", FolderKanban)}
              {navItem("/analytics/global", "Global Analytics", BarChart2)}
              {user?.role === "ADMIN" && navItem("/admin", "Admin Console", ShieldCheck)}
            </nav>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 pl-3 pr-2 py-1 bg-slate-50 border border-slate-200/80 rounded-full shadow-xs">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {initials}
              </div>
              <div className="hidden sm:block text-left text-xs pr-1">
                <div className="font-semibold text-slate-800 leading-none truncate max-w-[120px]">
                  {user?.name || "Student"}
                </div>
                <div className="text-[10px] text-muted mt-0.5 leading-none capitalize">
                  {user?.role === "ADMIN" ? "Administrator" : "Learner"}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                nav("/login");
              }}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition border border-transparent hover:border-rose-100"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Sub-Nav */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-100 px-3 py-1.5 bg-slate-50/50">
          <NavLink to="/home" className={({isActive}) => `text-xs font-medium py-1 px-2.5 rounded-lg ${isActive ? "bg-white text-brand-700 shadow-xs font-semibold" : "text-muted"}`}>Home</NavLink>
          <NavLink to="/spaces" className={({isActive}) => `text-xs font-medium py-1 px-2.5 rounded-lg ${isActive ? "bg-white text-brand-700 shadow-xs font-semibold" : "text-muted"}`}>Spaces</NavLink>
          <NavLink to="/analytics/global" className={({isActive}) => `text-xs font-medium py-1 px-2.5 rounded-lg ${isActive ? "bg-white text-brand-700 shadow-xs font-semibold" : "text-muted"}`}>Analytics</NavLink>
          {user?.role === "ADMIN" && <NavLink to="/admin" className={({isActive}) => `text-xs font-medium py-1 px-2.5 rounded-lg ${isActive ? "bg-white text-brand-700 shadow-xs font-semibold" : "text-muted"}`}>Admin</NavLink>}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        <Outlet />
      </main>

      {/* Modern SaaS Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Lumina Study</span>
            <span>· Grounded AI Learning Workspace</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Active Models: Gemini 3.6-flash & Groq</span>
            <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block" />
            <span className="text-emerald-700 font-medium">All Systems Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
