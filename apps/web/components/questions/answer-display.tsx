"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Separator } from "@/components/ui/separator";

interface AnswerDisplayProps {
  markdown: string;
  isStreaming: boolean;
}

// T-02-12: Custom component overrides — strip images, no raw HTML passthrough
const markdownComponents: Components = {
  // Strip images from LLM output entirely
  img: () => null,
  // Safe code block rendering with muted background
  pre: ({ children }) => (
    <pre className="bg-muted rounded-md p-4 overflow-x-auto text-[14px] font-mono my-3">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    // Inline code (no language class)
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
  // Body text: 16px
  p: ({ children }) => (
    <p className="text-[16px] leading-[1.6] mb-3 last:mb-0">{children}</p>
  ),
  // Headings inside answer
  h2: ({ children }) => (
    <h2 className="text-[20px] font-semibold leading-[1.2] mb-2 mt-4">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-[18px] font-semibold leading-[1.2] mb-2 mt-3">{children}</h3>
  ),
  // Lists
  ul: ({ children }) => (
    <ul className="list-disc list-inside space-y-1 mb-3 text-[16px]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside space-y-1 mb-3 text-[16px]">{children}</ol>
  ),
};

/**
 * Extracts the Socratic follow-up from the streamed answer.
 * The Socratic follow-up is the last paragraph ending with "?".
 */
function extractSocraticFollowUp(markdown: string): { body: string; followUp: string | null } {
  // Split on double newlines to get paragraphs
  const paragraphs = markdown.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  if (paragraphs.length === 0) return { body: markdown, followUp: null };

  const last = paragraphs[paragraphs.length - 1];

  // Check if last paragraph is a question (ends with ?)
  if (last.endsWith("?")) {
    const body = paragraphs.slice(0, -1).join("\n\n");
    return { body, followUp: last };
  }

  return { body: markdown, followUp: null };
}

export function AnswerDisplay({ markdown, isStreaming }: AnswerDisplayProps) {
  const { body, followUp } = extractSocraticFollowUp(markdown);

  const content = (
    <div className="bg-card rounded-xl border border-border p-6 mt-4">
      {/* Main answer body */}
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {body || markdown}
        </ReactMarkdown>
      </div>

      {/* Socratic follow-up — only show when not streaming and a follow-up exists */}
      {!isStreaming && followUp && (
        <>
          <Separator className="my-4" />
          <div className="pl-4 border-l-2 border-primary bg-muted rounded-r-md py-3 pr-3">
            <p className="text-[14px] font-semibold text-muted-foreground mb-1">
              Think about this:
            </p>
            <p className="text-[16px] font-semibold leading-[1.6]">{followUp}</p>
          </div>
        </>
      )}

      {/* Streaming indicator — show while content is arriving */}
      {isStreaming && markdown.length > 0 && (
        <span className="inline-block w-1 h-4 ml-0.5 bg-foreground animate-pulse rounded-sm" />
      )}
    </div>
  );

  if (isStreaming) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading answer"
      >
        {content}
      </div>
    );
  }

  return content;
}
