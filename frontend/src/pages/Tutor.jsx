import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useSearchParams } from "react-router-dom";
import api from "../api";
import ProjectTabs from "../components/ProjectTabs";
import { CitationCard } from "../components/Widgets";
import MarkdownRenderer from "../components/MarkdownRenderer";
import { 
  Sparkles, 
  Send, 
  Plus, 
  MessageSquare, 
  Bot, 
  User, 
  AlertTriangle, 
  FileText,
  Search,
  BookOpen
} from "lucide-react";

export default function Tutor() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [cid, setCid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const messagesEndRef = useRef(null);

  const busyRef = useRef(false);
  const autoHandledRef = useRef(false);

  const incomingPrompt = location.state?.prompt || searchParams.get("prompt") || searchParams.get("q");
  const autoSend = location.state?.autoSend !== false && Boolean(incomingPrompt);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConvos = async () => {
    try {
      const res = await api.get("/api/tutor/conversations", { params: { projectId: id } });
      const convos = res.data.data || [];
      setConversations(convos);
      return convos;
    } catch (err) {
      console.error("Load conversations failed", err);
      return [];
    }
  };

  useEffect(() => {
    if (cid) {
      api.get(`/api/tutor/conversations/${cid}/messages`)
        .then((r) => {
          if (!busyRef.current) {
            setMessages(r.data.data || []);
            setTimeout(scrollToBottom, 100);
          }
        })
        .catch((err) => console.error("Load messages failed", err));
    } else {
      if (!busyRef.current) {
        setMessages([]);
      }
    }
  }, [cid]);

  // Immediately inject prompt into input box on arrival
  useEffect(() => {
    if (incomingPrompt && !autoHandledRef.current) {
      setQ(incomingPrompt);
    }
  }, [incomingPrompt]);

  // Load existing conversations
  useEffect(() => {
    let active = true;
    api.get("/api/tutor/conversations", { params: { projectId: id } })
      .then((res) => {
        if (!active) return;
        const convos = res.data.data || [];
        setConversations(convos);
        if (convos.length > 0 && !incomingPrompt) {
          setCid((prev) => prev || convos[0].id);
        }
      })
      .catch((err) => console.error("Load conversations failed", err));

    return () => {
      active = false;
    };
  }, [id, incomingPrompt]);

  // Auto-send redirected prompt
  useEffect(() => {
    if (!incomingPrompt || autoHandledRef.current) return;
    autoHandledRef.current = true;

    // Clean browser URL quietly without triggering React Router remount
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch (e) {}

    const runAutoPrompt = async () => {
      let targetConvoId = null;
      try {
        const title = incomingPrompt.length > 40 ? incomingPrompt.slice(0, 40) + "…" : incomingPrompt;
        const res = await api.post("/api/tutor/conversations", {
          projectId: id,
          title: title,
        });
        if (res.data?.data) {
          const newConvo = res.data.data;
          setConversations((prev) => [newConvo, ...prev.filter((c) => c.id !== newConvo.id)]);
          setCid(newConvo.id);
          targetConvoId = newConvo.id;
        }
      } catch (err) {
        console.warn("Could not pre-create conversation, will stream directly", err);
      }

      // Automatically send the question into the newly created or active conversation
      await sendQuestion(incomingPrompt, targetConvoId);
    };

    runAutoPrompt();
  }, [id, incomingPrompt]);

  const sendQuestion = async (questionText, overrideCid) => {
    const query = (questionText || q).trim();
    if (!query || busyRef.current) return;

    const activeCid = overrideCid !== undefined ? overrideCid : cid;
    setBusy(true);
    busyRef.current = true;
    setQ("");

    const optimisticMsg = {
      id: "opt-" + Date.now(),
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    };
    const botMsgId = "bot-" + Date.now();
    const streamingBotMsg = {
      id: botMsgId,
      role: "assistant",
      content: "",
      citations: [],
      evidenceStatus: "grounded",
      isStreaming: true,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg, streamingBotMsg]);
    setTimeout(scrollToBottom, 50);

    const token = localStorage.getItem("accessToken");
    const baseURL = api.defaults.baseURL || "http://localhost:8080";

    try {
      const response = await fetch(`${baseURL}/api/tutor/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          projectId: id,
          conversationId: activeCid,
          question: query,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Streaming failed: HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let accumulatedText = "";
      let streamCitations = [];
      let streamEvidence = "grounded";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data:")) {
            const rawData = line.slice(5).trim();
            if (!rawData) continue;
            try {
              const parsed = JSON.parse(rawData);
              if (parsed.chunk) {
                accumulatedText += parsed.chunk;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMsgId ? { ...m, content: accumulatedText } : m
                  )
                );
                scrollToBottom();
              }
              if (parsed.citations) {
                streamCitations = parsed.citations;
              }
              if (parsed.evidenceStatus) {
                streamEvidence = parsed.evidenceStatus;
              }
              if (parsed.conversationId && (!cid || cid !== parsed.conversationId)) {
                setCid(parsed.conversationId);
                loadConvos();
              }
            } catch (e) {
              // chunk parse ignore
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                content: accumulatedText || "Answer received.",
                citations: streamCitations,
                evidenceStatus: streamEvidence,
                isStreaming: false,
              }
            : m
        )
      );
      loadConvos();
    } catch (ex) {
      console.warn("Stream failed, falling back to ask API", ex);
      try {
        const res = await api.post("/api/tutor/ask", {
          projectId: id,
          conversationId: activeCid,
          question: query,
        });

        const data = res.data.data;
        if (data?.conversationId && (!cid || cid !== data.conversationId)) {
          setCid(data.conversationId);
          loadConvos();
        }

        const replyText = data?.message?.content || data?.ai?.answer || data?.answer || "Answer received.";
        const replyCites = data?.message?.citations || data?.ai?.citations || data?.citations || [];
        const replyEvidence = data?.message?.evidenceStatus || data?.ai?.evidenceStatus || data?.evidenceStatus || "grounded";

        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                  ...m,
                  content: replyText,
                  citations: replyCites,
                  confidence: data?.confidence,
                  evidenceStatus: replyEvidence,
                  isStreaming: false,
                }
              : m
          )
        );
      } catch (fallbackErr) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                  ...m,
                  content:
                    "⚠️ " +
                    (fallbackErr.response?.data?.message ||
                      "Failed to get an answer. Please verify that your PDF notes are uploaded and ready."),
                  evidenceStatus: "insufficient",
                  isStreaming: false,
                }
              : m
          )
        );
      }
    } finally {
      setBusy(false);
      busyRef.current = false;
      setTimeout(scrollToBottom, 100);
    }
  };

  const startNewChat = async () => {
    try {
      const res = await api.post("/api/tutor/conversations", {
        projectId: id,
        title: "New Study Session",
      });
      const newConvo = res.data.data;
      setConversations((prev) => [newConvo, ...prev]);
      setCid(newConvo.id);
      setMessages([]);
    } catch (err) {
      console.error("Failed to create new conversation", err);
    }
  };

  const starters = [
    "Summarize the main topics in this document",
    "Explain the primary formulas and equations covered",
    "What are the most common exam questions on this material?",
    "Give me an intuitive analogy to understand the core concept",
  ];

  const filteredConvos = conversations.filter((c) =>
    (c.title || "Untitled chat").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <ProjectTabs />

      {/* Main Split-Pane Workspace */}
      <div className="grid md:grid-cols-4 gap-6 items-start">
        {/* Left Sidebar: Conversations */}
        <aside className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-card flex flex-col h-[640px]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-brand-600" />
              <span>Study Chats</span>
            </h2>
            <button
              onClick={startNewChat}
              className="inline-flex items-center gap-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-brand-200/50 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter chats…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-500 transition"
            />
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {filteredConvos.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted">
                No conversations yet. Start a new chat!
              </div>
            ) : (
              filteredConvos.map((c) => {
                const isActive = cid === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCid(c.id)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition truncate block ${
                      isActive
                        ? "bg-brand-50 text-brand-700 font-semibold border border-brand-200/60 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="truncate">{c.title || "Untitled Session"}</div>
                    {c.updatedAt && (
                      <div className="text-[10px] text-muted mt-0.5">
                        {new Date(c.updatedAt).toLocaleDateString()}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Center Panel: Active Chat Thread */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-card flex flex-col h-[640px]">
          {/* Chat Topbar */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  Lumina AI Tutor
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 rounded-md">
                    Grounded Mode
                  </span>
                </div>
                <div className="text-[11px] text-muted">Powered by Gemini 3.6-flash with page-level citations</div>
              </div>
            </div>
            <div className="text-xs text-muted hidden sm:block">
              Press Enter to send
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center text-xl font-bold mb-3 shadow-xs">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-base text-slate-900">What would you like to master today?</h3>
                <p className="text-xs text-muted max-w-md mt-1 mb-6">
                  Ask any question about your uploaded PDF notes. The tutor will provide structured, university-grade explanations with direct page citations.
                </p>

                {/* Quick Starters */}
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {starters.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendQuestion(s)}
                      className="text-xs font-medium border border-slate-200/80 hover:border-brand-400 hover:text-brand-700 rounded-xl px-3.5 py-2 text-slate-700 transition bg-slate-50/60 hover:bg-brand-50/50 text-left"
                    >
                      💡 {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className={`max-w-[85%] space-y-2 ${isUser ? "text-right" : "text-left"}`}>
                      <div
                        className={`inline-block rounded-2xl px-5 py-3.5 text-sm leading-relaxed text-left ${
                          isUser
                            ? "bg-slate-900 text-white rounded-tr-sm shadow-xs"
                            : "bg-slate-50/80 text-slate-900 border border-slate-200/80 rounded-tl-sm shadow-xs"
                        }`}
                      >
                        {isUser ? (
                          <div className="whitespace-pre-wrap">{m.content}</div>
                        ) : (
                          <MarkdownRenderer content={m.content} />
                        )}
                      </div>

                      {/* Insufficient Evidence Warning Pill */}
                      {m.evidenceStatus === "insufficient" && (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 inline-block max-w-full text-left">
                          ⚠️ Note: The uploaded materials do not contain sufficient evidence to fully verify this specific inquiry.
                        </div>
                      )}

                      {/* Verified Citations List */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="space-y-1.5 pt-1 text-left">
                          <div className="text-[10px] font-bold tracking-wider text-muted uppercase">
                            Verified Excerpt Citations ({m.citations.length})
                          </div>
                          {m.citations.map((c, i) => (
                            <CitationCard key={i} citation={c} />
                          ))}
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {busy && (
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="inline-block bg-slate-50 border border-slate-200/80 rounded-2xl px-4 py-2.5 text-xs text-muted animate-pulse">
                  Retrieving relevant excerpts & formulating grounded explanation…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion();
            }}
            className="pt-3 border-t border-slate-100 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              className="flex-1 bg-slate-50 focus:bg-white border border-slate-200 focus:border-brand-500 outline-none rounded-xl px-4 py-3 text-sm transition shadow-2xs"
              placeholder="Ask a question about your uploaded PDF notes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !q.trim()}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-semibold rounded-xl px-4 py-3 text-sm transition shadow-sm flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
