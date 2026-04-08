"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface DiagnosticBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

// T-02-12: Custom component overrides — strip images, no raw HTML passthrough
const markdownComponents: Components = {
  // Strip images from LLM output entirely
  img: () => null,
  // Safe code block rendering
  pre: ({ children }) => (
    <pre className="bg-muted rounded-md p-4 overflow-x-auto text-[14px] font-mono my-3">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-[14px] font-mono">
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
  p: ({ children }) => (
    <p className="text-[16px] leading-[1.6] mb-2 last:mb-0">{children}</p>
  ),
  h2: ({ children }) => (
    <h2 className="text-[18px] font-semibold leading-[1.2] mb-2 mt-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[16px] font-semibold leading-[1.2] mb-2 mt-2">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 mb-2 text-[16px]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 mb-2 text-[16px]">{children}</ol>
  ),
};

export function DiagnosticBubble({ role, content, isStreaming }: DiagnosticBubbleProps) {
  if (role === "assistant") {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-[12px] font-medium text-muted-foreground px-1">
          MindMap
        </span>
        <div className="bg-card rounded-xl border border-border p-4 max-w-[85%]">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {content}
            </ReactMarkdown>
          </div>
          {isStreaming && content.length > 0 && (
            <span className="inline-block w-1 h-4 ml-0.5 bg-foreground animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    );
  }

  // User message — right-aligned, plain text
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="text-[12px] font-medium text-muted-foreground px-1">
        You
      </span>
      <div className="bg-primary text-primary-foreground rounded-xl p-4 max-w-[85%]">
        <p className="text-[16px] leading-[1.6]">{content}</p>
      </div>
    </div>
  );
}
