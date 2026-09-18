import React from "react";
import { NavLink, useParams } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  Sparkles, 
  BrainCircuit, 
  Layers, 
  Network, 
  Compass, 
  ShieldAlert, 
  TrendingUp, 
  BarChart3 
} from "lucide-react";

export default function ProjectTabs() {
  const { id } = useParams();

  const tabs = [
    { label: "Overview", to: `/projects/${id}`, icon: LayoutDashboard, end: true },
    { label: "Materials", to: `/projects/${id}/materials`, icon: FileText },
    { label: "AI Tutor", to: `/projects/${id}/tutor`, icon: Sparkles, badge: "Stream" },
    { label: "Quiz", to: `/projects/${id}/quiz`, icon: BrainCircuit },
    { label: "Flashcards", to: `/projects/${id}/flashcards`, icon: Layers, badge: "SM-2" },
    { label: "Concept Map", to: `/projects/${id}/concept-map`, icon: Network },
    { label: "Study Plan", to: `/projects/${id}/study-plan`, icon: Compass },
    { label: "Mistakes", to: `/projects/${id}/mistakes`, icon: ShieldAlert },
    { label: "Growth", to: `/projects/${id}/growth`, icon: TrendingUp },
    { label: "Analytics", to: `/projects/${id}/analytics`, icon: BarChart3 },
  ];

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-xs mb-6 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {tabs.map(({ label, to, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition tracking-tight ${
                isActive
                  ? "bg-brand-600 text-white shadow-sm shadow-brand-500/25"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{label}</span>
                {badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md uppercase tracking-wider ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-brand-50 text-brand-700 border border-brand-200/60"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
