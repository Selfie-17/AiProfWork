import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export default function MarkdownRenderer({ content, className = "" }) {
  if (!content) return null;

  return (
    <div className={`markdown-content text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-lg font-bold text-slate-900 mt-3 mb-2 pb-1 border-b border-slate-200" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-base font-bold text-slate-800 mt-3 mb-1.5" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-sm font-semibold text-slate-900 mt-2.5 mb-1 text-accent" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="mb-2.5 text-slate-700 last:mb-0 leading-relaxed" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 space-y-1 mb-2.5 text-slate-700" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 space-y-1 mb-2.5 text-slate-700" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-slate-900" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-3 border-slate-200" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-4 border-accent/60 bg-accent/5 px-3.5 py-2 rounded-r-xl my-2.5 text-xs text-slate-800 italic"
              {...props}
            />
          ),
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code className="bg-slate-100 text-accent font-mono text-xs px-1.5 py-0.5 rounded font-medium" {...props} />
            ) : (
              <code className="block bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-xs overflow-x-auto my-2" {...props} />
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
