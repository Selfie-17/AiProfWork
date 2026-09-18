import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import ProjectTabs from "../components/ProjectTabs";
import { StatusBadge, EmptyState } from "../components/Widgets";
import { useToast } from "../components/Toast";
import { 
  UploadCloud, 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileCheck,
  BrainCircuit,
  ArrowRight,
  Trash2,
  Edit2
} from "lucide-react";

export default function Materials() {
  const { id } = useParams();
  const [items, setItems] = useState([]);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const load = () => {
    api.get("/api/materials", { params: { projectId: id } })
      .then((r) => setItems(r.data.data || []))
      .catch((err) => console.error("Materials load failed", err));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [id]);

  const upload = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.push("Only PDF files are supported");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.push("File exceeds 20MB limit");
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", id);
    try {
      await api.post("/api/materials/upload", fd);
      toast.push("PDF uploaded successfully — Processing started!");
      load();
    } catch (ex) {
      toast.push(ex.response?.data?.message || "Upload failed. Check connection.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (mId, fileName) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"? This will also remove its indexed knowledge chunks.`)) {
      return;
    }
    try {
      await api.delete(`/api/materials/${mId}`);
      toast.push(`Deleted "${fileName}"`, "success");
      load();
    } catch (err) {
      toast.push(err.response?.data?.message || "Failed to delete material", "error");
    }
  };

  const handleRename = async (mId, currentName) => {
    const newName = window.prompt("Enter new title for this document:", currentName);
    if (!newName || newName.trim() === currentName) return;
    try {
      await api.put(`/api/materials/${mId}`, { fileName: newName.trim() });
      toast.push("Renamed successfully", "success");
      load();
    } catch (err) {
      toast.push(err.response?.data?.message || "Failed to rename", "error");
    }
  };

  const readyCount = items.filter((m) => m.status === "READY").length;

  return (
    <div className="space-y-6">
      <ProjectTabs />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Course Materials & Knowledge</h1>
          <p className="text-sm text-muted mt-1">
            Upload textbooks, lecture slides, and notes. The AI extracts text, concepts, and semantic embeddings for grounded tutoring.
          </p>
        </div>
        {readyCount > 0 && (
          <Link
            to={`/projects/${id}/tutor`}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            Study with AI Tutor
          </Link>
        )}
      </div>

      {/* Asynchronous Processing Pipeline Banner (PRD Page 5) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          Knowledge Ingestion Pipeline (Asynchronous)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs text-center">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="font-bold text-slate-800 block">1. Upload</span>
            <span className="text-[10px] text-muted">PDF up to 20MB</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="font-bold text-slate-800 block">2. Queued</span>
            <span className="text-[10px] text-muted">Worker job created</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="font-bold text-slate-800 block">3. OCR & Parsing</span>
            <span className="text-[10px] text-muted">Page-by-page extraction</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="font-bold text-slate-800 block">4. Concepts</span>
            <span className="text-[10px] text-muted">Gemini 3.6 curriculum scan</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="font-bold text-slate-800 block">5. Embeddings</span>
            <span className="text-[10px] text-muted">Dense vector indexing</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/60 text-emerald-800">
            <span className="font-bold block">6. Ready</span>
            <span className="text-[10px] text-emerald-700">Grounded in Tutor & Quiz</span>
          </div>
        </div>
      </div>

      {/* Modern Drag & Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) upload(f);
        }}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition ${
          drag ? "border-brand-500 bg-brand-50/50" : "border-slate-300 hover:border-slate-400 bg-white"
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 mx-auto flex items-center justify-center mb-3">
          <UploadCloud className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          {uploading ? "Uploading & queuing document…" : "Drop your PDF lecture notes or textbook here"}
        </h3>
        <p className="text-xs text-muted max-w-sm mx-auto mt-1 mb-4">
          Supported format: PDF documents containing text, diagrams, and formula sheets (up to 20MB).
        </p>

        <label className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-5 py-2.5 rounded-xl cursor-pointer shadow-sm transition">
          <FileText className="w-4 h-4" />
          Browse Files
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files[0] && upload(e.target.files[0])}
          />
        </label>
      </div>

      {/* Materials List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Uploaded Materials ({items.length})
          </h3>
          <span className="text-xs text-muted">Auto-refreshes every few seconds</span>
        </div>

        {items.length > 0 ? (
          items.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card hover:shadow-card-hover transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 truncate">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-brand-600" />
                </div>
                <div className="truncate">
                  <div className="font-bold text-sm text-slate-900 truncate">{m.fileName}</div>
                  <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
                    {m.pageCount ? (
                      <span>{m.pageCount} pages extracted</span>
                    ) : (
                      <span>Awaiting page parsing</span>
                    )}
                    <span>·</span>
                    <span>Uploaded {new Date(m.uploadedAt).toLocaleDateString()}</span>
                  </div>
                  {m.error && (
                    <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded mt-1.5 inline-block">
                      Error: {m.error}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <StatusBadge status={m.status} />
                {m.status === "READY" && (
                  <Link
                    to={`/projects/${id}/tutor?prompt=${encodeURIComponent(`Summarize key concepts, definitions, and equations from ${m.fileName || m.name}`)}`}
                    state={{
                      prompt: `Summarize key concepts, definitions, and equations from ${m.fileName || m.name}`,
                      autoSend: true
                    }}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition"
                  >
                    Ask Tutor →
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => handleRename(m.id, m.fileName)}
                  title="Rename document"
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(m.id, m.fileName)}
                  title="Delete document"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            icon={FileText}
            title="No materials uploaded yet"
            description="Upload your first lecture notes PDF above to begin creating concepts and studying with the AI tutor."
          />
        )}
      </div>
    </div>
  );
}
