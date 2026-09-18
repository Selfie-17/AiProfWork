import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Network, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  BrainCircuit, 
  MessageSquare,
  RefreshCw,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Plus,
  Edit2,
  Trash2,
  X
} from "lucide-react";
import api from "../api";
import ProjectTabs from "../components/ProjectTabs";
import { useToast } from "../components/Toast";

export default function ConceptMap() {
  const { id } = useParams();
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [zoom, setZoom] = useState(1);
  const toast = useToast();

  // Concept CRUD State
  const [conceptModalOpen, setConceptModalOpen] = useState(false);
  const [editingConcept, setEditingConcept] = useState(null);
  const [conceptForm, setConceptForm] = useState({
    name: "",
    description: "",
    category: "Foundations & Math",
    masteryScore: 40
  });
  const [savingConcept, setSavingConcept] = useState(false);

  const openCreateConcept = () => {
    setEditingConcept(null);
    setConceptForm({
      name: "",
      description: "",
      category: "Foundations & Math",
      masteryScore: 40
    });
    setConceptModalOpen(true);
  };

  const openEditConcept = (node) => {
    setEditingConcept(node);
    setConceptForm({
      name: node.label || node.name || "",
      description: node.description || "",
      category: node.category || "Foundations & Math",
      masteryScore: Math.round(node.masteryScore ?? 40)
    });
    setConceptModalOpen(true);
  };

  const handleSaveConcept = async (e) => {
    e.preventDefault();
    if (!conceptForm.name.trim()) return;
    setSavingConcept(true);
    try {
      if (editingConcept && editingConcept.id) {
        await api.put(`/api/concepts/${editingConcept.id}`, {
          name: conceptForm.name.trim(),
          description: conceptForm.description.trim(),
          category: conceptForm.category,
          masteryScore: Number(conceptForm.masteryScore)
        });
        toast.push("Concept updated successfully", "success");
      } else {
        await api.post(`/api/projects/${id}/concepts`, {
          name: conceptForm.name.trim(),
          description: conceptForm.description.trim(),
          category: conceptForm.category,
          masteryScore: Number(conceptForm.masteryScore)
        });
        toast.push("New concept added to knowledge map", "success");
      }
      setConceptModalOpen(false);
      loadGraph();
    } catch (err) {
      toast.push("Failed to save concept: " + (err.response?.data?.message || err.message), "error");
    } finally {
      setSavingConcept(false);
    }
  };

  const handleDeleteConcept = async (node) => {
    if (!node || !node.id) {
      toast.push("Concept is synthetic; regenerate graph to refresh", "info");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete concept "${node.label || node.name}"?`)) return;
    try {
      await api.delete(`/api/concepts/${node.id}`);
      toast.push("Concept deleted", "success");
      loadGraph();
    } catch (err) {
      toast.push("Failed to delete concept", "error");
    }
  };

  const loadGraph = (isRefresh = false) => {
    if (isRefresh) setRegenerating(true);
    else setLoading(true);

    const request = isRefresh
      ? api.post(`/api/projects/${id}/concepts/graph/regenerate`)
      : api.get(`/api/projects/${id}/concepts/graph`);

    request
      .then((r) => {
        const data = r.data.data || { nodes: [], edges: [] };
        setGraph(data);
        if (data.nodes?.length > 0) {
          setSelectedNodeId((prev) => prev || data.nodes[0].id || data.nodes[0].label);
        }
        if (isRefresh) {
          toast.push(`Concept map regenerated! (${data.nodes?.length || 0} concepts)`, "success");
        }
      })
      .catch((err) => {
        console.error("Concept graph error", err);
        toast.push("Failed to load concept graph", "error");
      })
      .finally(() => {
        setLoading(false);
        setRegenerating(false);
      });
  };

  useEffect(() => {
    loadGraph();
  }, [id]);

  const rawNodes = graph.nodes || [];
  const rawEdges = graph.edges || [];

  // Categorize nodes into sequential topological layout columns
  const layout = useMemo(() => {
    if (!rawNodes.length) return { columns: [], nodeCoords: {}, viewBox: "0 0 800 480" };

    const col1 = []; // Foundation (Level 1)
    const col2 = []; // Core Algorithm (Level 2)
    const col3 = []; // Evaluation & Optimization (Level 3+)

    rawNodes.forEach((node, idx) => {
      const lvl = node.level || (idx % 3) + 1;
      if (lvl <= 1 || node.category === "Foundation") col1.push(node);
      else if (lvl === 2 || node.category === "Core Algorithm") col2.push(node);
      else col3.push(node);
    });

    if (col1.length === 0 && rawNodes.length > 0) col1.push(...rawNodes.slice(0, 2));
    if (col2.length === 0 && rawNodes.length > 2) col2.push(...rawNodes.slice(2, 5));
    if (col3.length === 0 && rawNodes.length > 5) col3.push(...rawNodes.slice(5));

    const columns = [
      { name: "Foundations & Math", nodes: col1 },
      { name: "Core Algorithms", nodes: col2 },
      { name: "Evaluation & Tuning", nodes: col3 },
    ];

    const nodeCoords = {};
    const colX = [140, 400, 660];

    columns.forEach((col, cIdx) => {
      const x = colX[cIdx];
      const count = col.nodes.length;
      const totalH = 420;
      const step = totalH / Math.max(count + 1, 2);

      col.nodes.forEach((node, rIdx) => {
        const y = 60 + step * (rIdx + 1);
        const nid = node.id || node.label;
        nodeCoords[nid] = { x, y, node };
      });
    });

    return { columns, nodeCoords, viewBox: "0 0 800 500" };
  }, [rawNodes]);

  const selectedNode = useMemo(() => {
    return rawNodes.find((n) => (n.id || n.label) === selectedNodeId) || rawNodes[0];
  }, [rawNodes, selectedNodeId]);

  // Find edges connected to selected node
  const activeEdgeKeys = useMemo(() => {
    if (!selectedNodeId) return new Set();
    const set = new Set();
    rawEdges.forEach((e) => {
      const s = String(e.source).toLowerCase();
      const t = String(e.target).toLowerCase();
      const cur = String(selectedNodeId).toLowerCase();
      if (s === cur || t === cur || selectedNode?.label?.toLowerCase() === s || selectedNode?.label?.toLowerCase() === t) {
        set.add(`${e.source}->${e.target}`);
      }
    });
    return set;
  }, [rawEdges, selectedNodeId, selectedNode]);

  return (
    <div className="space-y-6">
      <ProjectTabs />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center shadow-sm">
              <Network className="w-4 h-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Knowledge Concept Graph</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
              Interactive Prerequisite Map
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Visual Directed Acyclic Graph (DAG) mapping prerequisite knowledge paths and live concept mastery.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={openCreateConcept}
            className="inline-flex items-center space-x-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Concept</span>
          </button>

          <button
            onClick={() => loadGraph(true)}
            disabled={regenerating}
            className="inline-flex items-center space-x-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-xs transition"
            title="Scan materials and re-generate knowledge graph"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin text-brand-600" : ""}`} />
            <span>{regenerating ? "Scanning Notes…" : "Rescan Materials"}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-96 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center space-y-3 text-slate-400 animate-pulse">
          <Network className="w-10 h-10 text-brand-400 animate-bounce" />
          <span className="text-xs font-medium">Synthesizing topological knowledge graph…</span>
        </div>
      ) : rawNodes.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300">
          <Network className="w-12 h-12 text-brand-500 mx-auto mb-3 opacity-80" />
          <h3 className="text-base font-bold text-slate-900">No Concepts Indexed Yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Upload your course PDF in the Materials tab or click below to build a domain map.
          </p>
          <button
            onClick={() => loadGraph(true)}
            disabled={regenerating}
            className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Build Knowledge Graph</span>
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Main Visual SVG Graph Stage */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 shadow-card p-4 sm:p-6 flex flex-col justify-between relative overflow-hidden">
            {/* Background grid dots */}
            <div className="absolute inset-0 bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

            {/* Stage Controls */}
            <div className="relative z-10 flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-500">
              <div className="flex items-center space-x-3">
                <span className="font-semibold text-slate-800">
                  {rawNodes.length} Concepts · {rawEdges.length} Prerequisite Links
                </span>
              </div>
              <div className="flex items-center space-x-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
                  className="p-1 hover:bg-white rounded text-slate-600 transition"
                  title="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-bold px-1.5">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
                  className="p-1 hover:bg-white rounded text-slate-600 transition"
                  title="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="p-1 hover:bg-white rounded text-slate-600 transition"
                  title="Reset zoom"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Visual SVG Diagram Canvas */}
            <div className="relative z-10 w-full overflow-auto py-4">
              <div
                style={{ transform: `scale(${zoom})`, transformOrigin: "top left", transition: "transform 0.2s ease-out" }}
                className="min-w-[760px]"
              >
                <svg viewBox={layout.viewBox} className="w-full h-[460px] select-none">
                  <defs>
                    <marker
                      id="arrow"
                      viewBox="0 0 10 10"
                      refX="22"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#94A3B8" />
                    </marker>
                    <marker
                      id="arrow-active"
                      viewBox="0 0 10 10"
                      refX="22"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#4F46E5" />
                    </marker>
                    <linearGradient id="activeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#4F46E5" />
                    </linearGradient>
                  </defs>

                  {/* Stage Columns Headers */}
                  {layout.columns.map((col, idx) => (
                    <text
                      key={idx}
                      x={[140, 400, 660][idx]}
                      y={28}
                      textAnchor="middle"
                      className="fill-slate-400 font-bold uppercase tracking-wider text-[10px]"
                    >
                      Stage {idx + 1}: {col.name}
                    </text>
                  ))}

                  {/* Curved Connection Edges */}
                  {rawEdges.map((e, idx) => {
                    const sourceNode = layout.nodeCoords[e.source] || 
                      Object.values(layout.nodeCoords).find((c) => c.node.label?.toLowerCase() === String(e.source).toLowerCase());
                    const targetNode = layout.nodeCoords[e.target] || 
                      Object.values(layout.nodeCoords).find((c) => c.node.label?.toLowerCase() === String(e.target).toLowerCase());

                    if (!sourceNode || !targetNode) return null;

                    const sx = sourceNode.x + 80;
                    const sy = sourceNode.y;
                    const tx = targetNode.x - 80;
                    const ty = targetNode.y;

                    const dx = tx - sx;
                    const cx1 = sx + dx * 0.5;
                    const cy1 = sy;
                    const cx2 = sx + dx * 0.5;
                    const cy2 = ty;

                    const isActive = activeEdgeKeys.has(`${e.source}->${e.target}`);

                    return (
                      <g key={idx}>
                        <path
                          d={`M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`}
                          fill="none"
                          stroke={isActive ? "url(#activeGrad)" : "#CBD5E1"}
                          strokeWidth={isActive ? 2.8 : 1.5}
                          strokeDasharray={e.relationship === "EXTENDS" ? "4 4" : "none"}
                          markerEnd={isActive ? "url(#arrow-active)" : "url(#arrow)"}
                          className="transition-all duration-300"
                        />
                      </g>
                    );
                  })}

                  {/* Nodes */}
                  {Object.entries(layout.nodeCoords).map(([nid, coord]) => {
                    const node = coord.node;
                    const isSelected = (node.id || node.label) === selectedNodeId;
                    const score = Number(node.masteryScore ?? 40);
                    const color = score >= 70 ? "#10B981" : score >= 45 ? "#6366F1" : "#F59E0B";

                    return (
                      <g
                        key={nid}
                        transform={`translate(${coord.x}, ${coord.y})`}
                        onClick={() => setSelectedNodeId(node.id || node.label)}
                        className="cursor-pointer group"
                      >
                        {/* Selected glow ring */}
                        {isSelected && (
                          <rect
                            x={-85}
                            y={-30}
                            width={170}
                            height={60}
                            rx={16}
                            fill="#EEF2FF"
                            stroke="#6366F1"
                            strokeWidth={2}
                            className="animate-pulse"
                          />
                        )}

                        {/* Node Card Box */}
                        <rect
                          x={-80}
                          y={-26}
                          width={160}
                          height={52}
                          rx={13}
                          fill="#FFFFFF"
                          stroke={isSelected ? "#4F46E5" : "#E2E8F0"}
                          strokeWidth={isSelected ? 2 : 1}
                          className="drop-shadow-xs transition-all duration-200 group-hover:stroke-brand-400 group-hover:drop-shadow-sm"
                        />

                        {/* Mastery Indicator Dot */}
                        <circle cx={-62} cy={0} r={5} fill={color} />

                        {/* Title text */}
                        <text
                          x={-50}
                          y={-2}
                          className="fill-slate-900 font-bold text-[11px] leading-none"
                        >
                          {(node.label || node.name).length > 15 
                            ? (node.label || node.name).substring(0, 15) + "…" 
                            : (node.label || node.name)}
                        </text>

                        {/* Subtitle / Mastery */}
                        <text
                          x={-50}
                          y={13}
                          className="fill-slate-400 font-semibold text-[9px]"
                        >
                          Mastery: {Math.round(score)}%
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Bottom Legend */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center space-x-4 text-[11px]">
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Mastered (&ge;70%)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span>Developing (45-70%)</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Needs Review (&lt;45%)</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Click any node to inspect prerequisites & drills
              </span>
            </div>
          </div>

          {/* Right Inspection & Action Drawer */}
          <div className="lg:col-span-4 space-y-4">
            {selectedNode ? (
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-brand-600 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Concept Deep Dive</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 leading-tight">
                      {selectedNode.label || selectedNode.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Category: <span className="font-semibold text-slate-700">{selectedNode.category || "Core Knowledge"}</span> · Level {selectedNode.level || 1}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => openEditConcept(selectedNode)}
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                      title="Edit Concept"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteConcept(selectedNode)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Delete Concept"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Pedagogical Description */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                  {selectedNode.description || "Core foundational concept extracted from your uploaded study materials."}
                </div>

                {/* Live Mastery Meter */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Estimated Mastery</span>
                    <span className="font-bold text-brand-600">{Math.round(selectedNode.masteryScore ?? 40)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(8, selectedNode.masteryScore ?? 40))}%` }}
                    />
                  </div>
                </div>

                {/* Direct Action Starters */}
                <div className="space-y-2.5 pt-2">
                  <div className="text-xs font-semibold text-slate-700">Practice & Master:</div>
                  <Link
                    to={`/projects/${id}/tutor?prompt=${encodeURIComponent(`Explain ${selectedNode.label || selectedNode.name} in detail with core principles, formulas, and intuitive examples`)}`}
                    state={{
                      prompt: `Explain ${selectedNode.label || selectedNode.name} in detail with core principles, formulas, and intuitive examples`,
                      autoSend: true
                    }}
                    className="w-full flex items-center justify-between p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 transition shadow-xs group"
                  >
                    <div className="flex items-center space-x-2.5">
                      <MessageSquare className="w-4 h-4 text-brand-600" />
                      <span className="truncate">Ask Tutor: Explain {selectedNode.label || selectedNode.name}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-600 transition shrink-0" />
                  </Link>

                  <Link
                    to={`/projects/${id}/quiz?topic=${encodeURIComponent(selectedNode.label || selectedNode.name)}`}
                    state={{ topic: selectedNode.label || selectedNode.name }}
                    className="w-full flex items-center justify-between p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 transition shadow-xs group"
                  >
                    <div className="flex items-center space-x-2.5">
                      <BrainCircuit className="w-4 h-4 text-indigo-600" />
                      <span>Take Adaptive Quiz on this topic</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition shrink-0" />
                  </Link>

                  <Link
                    to={`/projects/${id}/flashcards?concept=${encodeURIComponent(selectedNode.label || selectedNode.name)}`}
                    state={{ concept: selectedNode.label || selectedNode.name }}
                    className="w-full flex items-center justify-between p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 transition shadow-xs group"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>Review Spaced Flashcards</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition shrink-0" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-xs text-slate-400">
                Click any concept in the diagram to inspect its pedagogical explanation and study actions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Concept Add / Edit Modal */}
      {conceptModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 w-full max-w-md space-y-4 shadow-modal animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                  <Network className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {editingConcept ? "Edit Concept" : "Create New Concept"}
                </h3>
              </div>
              <button
                onClick={() => setConceptModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConcept} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Concept Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Euclidean Distance Metric"
                  value={conceptForm.name}
                  onChange={(e) => setConceptForm({ ...conceptForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pedagogical Description</label>
                <textarea
                  rows={3}
                  placeholder="Core intuition, mathematical formulas, or practical importance..."
                  value={conceptForm.description}
                  onChange={(e) => setConceptForm({ ...conceptForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category / Stage</label>
                  <select
                    value={conceptForm.category}
                    onChange={(e) => setConceptForm({ ...conceptForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Foundations & Math">Foundations & Math</option>
                    <option value="Core Algorithms">Core Algorithms</option>
                    <option value="Evaluation & Tuning">Evaluation & Tuning</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mastery ({conceptForm.masteryScore}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={conceptForm.masteryScore}
                    onChange={(e) => setConceptForm({ ...conceptForm, masteryScore: Number(e.target.value) })}
                    className="w-full mt-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setConceptModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConcept}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {savingConcept ? <span>Saving…</span> : <span>{editingConcept ? "Save Changes" : "Create Concept"}</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
