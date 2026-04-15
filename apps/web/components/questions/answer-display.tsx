"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronUp } from "lucide-react";
import { extractSocraticFollowUp } from "./extract-socratic-follow-up";

// Re-export so consumers can import from either location
export { extractSocraticFollowUp } from "./extract-socratic-follow-up";

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

const COLLAPSED_HEIGHT = 200; // px

export function AnswerDisplay({ markdown, isStreaming }: AnswerDisplayProps) {
  const { body, followUp } = extractSocraticFollowUp(markdown);
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Measure content height after render to decide if collapse is needed
  useEffect(() => {
    if (!isStreaming && contentRef.current) {
      setNeedsCollapse(contentRef.current.scrollHeight > COLLAPSED_HEIGHT + 40);
    }
  }, [isStreaming, markdown]);

  const isCollapsed = needsCollapse && !expanded && !isStreaming;

  const content = (
    <div className="bg-card rounded-xl border border-border p-6 mt-4">
      {/* Main answer body — collapsible */}
      <div className="relative">
        <div
          ref={contentRef}
          className="prose prose-sm max-w-none overflow-hidden transition-[max-height] duration-300"
          style={{
            maxHeight: isCollapsed ? `${COLLAPSED_HEIGHT}px` : "none",
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {body || markdown}
          </ReactMarkdown>

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
        </div>

        {/* Fade overlay when collapsed */}
        {isCollapsed && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>

      {/* Show more / less toggle */}
      {needsCollapse && !isStreaming && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground mt-3 transition-colors"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="size-4" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="size-4" />
            </>
          )}
        </button>
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
