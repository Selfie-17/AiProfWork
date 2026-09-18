import React, { useState } from "react";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  TrendingUp, 
  Minus, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  ExternalLink
} from "lucide-react";

export function StatusBadge({ status }) {
  const configs = {
    QUEUED: {
      bg: "bg-amber-50 text-amber-700 border-amber-200/60",
      dot: "bg-amber-500",
      icon: Clock,
      label: "Queued",
    },
    PROCESSING: {
      bg: "bg-brand-50 text-brand-700 border-brand-200/60",
      dot: "bg-brand-500 animate-pulse",
      icon: Clock,
      label: "Processing",
    },
    READY: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
      dot: "bg-emerald-500",
      icon: CheckCircle2,
      label: "Ready",
    },
    FAILED: {
      bg: "bg-rose-50 text-rose-700 border-rose-200/60",
      dot: "bg-rose-500",
      icon: XCircle,
      label: "Failed",
    },
    ACTIVE: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
      dot: "bg-emerald-500 animate-pulse",
      icon: CheckCircle2,
      label: "Active",
    },
    IMPROVING: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
      icon: TrendingUp,
      label: "Improving",
    },
    STABLE: {
      bg: "bg-slate-100 text-slate-700 border-slate-200/60",
      icon: Minus,
      label: "Stable",
    },
    ATTENTION: {
      bg: "bg-amber-50 text-amber-800 border-amber-200/60",
      icon: AlertTriangle,
      label: "Needs Focus",
    },
  };

  const key = String(status || "").toUpperCase();
  const cfg = configs[key] || {
    bg: "bg-slate-100 text-slate-600 border-slate-200/60",
    label: status || "Unknown",
  };
  const Icon = cfg.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.bg}`}>
      {cfg.dot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
      {Icon && !cfg.dot && <Icon className="w-3 h-3" />}
      {cfg.label}
    </span>
  );
}

export function ProgressRing({ value = 0, label, size = 80, strokeWidth = 8, sublabel }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;

  let strokeColor = "#4F46E5";
  if (v >= 75) strokeColor = "#10B981";
  else if (v >= 45) strokeColor = "#6366F1";
  else if (v > 0) strokeColor = "#F59E0B";

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#F1F5F9"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <span className="absolute text-base font-bold text-slate-900 tracking-tight">
          {Math.round(v)}%
        </span>
      </div>
      {(label || sublabel) && (
        <div>
          {label && <div className="text-sm font-semibold text-slate-900">{label}</div>}
          {sublabel && <div className="text-xs text-muted mt-0.5">{sublabel}</div>}
        </div>
      )}
    </div>
  );
}

export function CitationCard({ citation }) {
  const [open, setOpen] = useState(false);
  const title = citation.source || citation.materialName || citation.fileName || "Course Notes";
  const page = citation.page || citation.pageNumber;
  const quote = citation.quote;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden text-xs transition hover:border-slate-300">
      <button
        type="button"
        onClick={() => quote && setOpen(!open)}
        className="w-full flex items-center justify-between p-2.5 text-left bg-slate-50/50 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <FileText className="w-3.5 h-3.5 text-brand-600 shrink-0" />
          <span className="font-semibold text-slate-800 truncate">{title}</span>
          {page && (
            <span className="bg-brand-50 text-brand-700 font-medium px-2 py-0.5 rounded text-[10px] border border-brand-200/50 shrink-0">
              Page {page}
            </span>
          )}
        </div>
        {quote && (
          <span className="text-muted hover:text-slate-900 shrink-0">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        )}
      </button>
      {open && quote && (
        <div className="p-3 border-t border-slate-100 bg-white text-slate-600 text-xs italic leading-relaxed">
          &ldquo;{quote}&rdquo;
        </div>
      )}
    </div>
  );
}

export function MetricCard({ title, value, subtitle, icon: Icon, trend, trendLabel }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-card hover:shadow-card-hover transition">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900 tracking-tight">{value}</span>
        {trend && (
          <span className="text-xs font-semibold text-emerald-600 flex items-center">
            <TrendingUp className="w-3 h-3 mr-0.5" /> {trend}
          </span>
        )}
      </div>
      {(subtitle || trendLabel) && (
        <p className="text-xs text-muted mt-1">{subtitle || trendLabel}</p>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon = FileText, title, description, actionLabel, onAction }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center my-4">
      <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-base font-semibold text-slate-900">{title}</h4>
      {description && <p className="text-sm text-muted max-w-sm mx-auto mt-1 mb-4">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
