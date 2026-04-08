"use client";

import { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Loader2, Send, RefreshCw, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DiagnosticBubble } from "./diagnostic-bubble";
import { MisconceptionReveal } from "./misconception-reveal";

interface DiagnosticChatProps {
  sessionId: string;
  initialMessages: UIMessage[];
  stage: "probe" | "classify" | "confront" | "resolve";
  outcome?: "resolved" | "unresolved" | "incomplete" | null;
  misconceptionName: string;
}

export function DiagnosticChat({
  sessionId,
  initialMessages,
  stage: initialStage,
  outcome: initialOutcome,
  misconceptionName,
}: DiagnosticChatProps) {
  const [input, setInput] = useState("");
  // Track whether probe has been initiated (to avoid double-init on Strict Mode)
  const probeInitiated = useRef(false);

  const { messages, sendMessage, status, error } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/diagnose",
      prepareSendMessagesRequest: ({ id, messages: allMessages }) => ({
        body: {
          sessionId: id,
          message: allMessages[allMessages.length - 1],
        },
      }),
    }),
  });

  const isSubmitting = status === "submitted" || status === "streaming";

  // Stage is derived from the last message pattern:
  // resolve = initialStage is "resolve" OR initialOutcome is non-null
  // Otherwise the stage advances server-side; we trust initialStage for terminal detection
  const isResolved = initialStage === "resolve" && initialOutcome === "resolved";
  const isTerminal = initialStage === "resolve";

  // For a completed session, resolve from initialOutcome
  const resolvedOutcome = initialOutcome;

  // Auto-initiate the probe question on mount if no messages exist yet
  useEffect(() => {
    if (
      initialStage === "probe" &&
      initialMessages.length === 0 &&
      messages.length === 0 &&
      !probeInitiated.current
    ) {
      probeInitiated.current = true;
      // Send a silent init message to trigger the server to generate the probe question
      sendMessage({ text: "__init__" });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSubmitting || isTerminal) return;
    setInput("");
    sendMessage({ text: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isSubmitting || isTerminal) return;
      setInput("");
      sendMessage({ text: trimmed });
    }
  };

  // Filter out the silent __init__ user message from display
  const displayMessages = messages.filter(
    (m) => !(m.role === "user" && m.parts?.some((p) => p.type === "text" && p.text === "__init__"))
  );

  // Extract text content from a UIMessage for rendering
  function extractText(message: UIMessage): string {
    return (
      message.parts
        ?.filter((p) => p.type === "text")
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("") ?? ""
    );
  }

  return (
    <div className="max-w-[680px] mx-auto">
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-muted/50">
          <h3 className="text-[16px] font-semibold text-foreground">
            Diagnostic Conversation
          </h3>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Let&apos;s explore what you think about this topic.
          </p>
        </div>

        {/* Message list */}
        <div className="flex flex-col gap-4 p-6 max-h-[480px] overflow-y-auto">
          {displayMessages.length === 0 && !isSubmitting && (
            <div className="flex items-center justify-center py-8">
              <p className="text-[14px] text-muted-foreground">
                Starting diagnostic session...
              </p>
            </div>
          )}

          {displayMessages.map((message, index) => {
            const content = extractText(message);
            const isLastMessage = index === displayMessages.length - 1;
            const isCurrentlyStreaming =
              isLastMessage &&
              message.role === "assistant" &&
              isSubmitting;

            return (
              <DiagnosticBubble
                key={message.id}
                role={message.role === "user" ? "user" : "assistant"}
                content={content}
                isStreaming={isCurrentlyStreaming}
              />
            );
          })}

          {/* Error state with retry — shown when the LLM stream fails */}
          {error && !isSubmitting && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-[14px] text-destructive">
                  {error.message?.includes("503") || error.message?.includes("ANTHROPIC_API_KEY")
                    ? "AI features require an API key. Please configure ANTHROPIC_API_KEY in your environment."
                    : "Something went wrong with the diagnostic session. Please try again."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  // Retry by re-sending the last user message text
                  const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
                  if (lastUserMsg) {
                    const text = lastUserMsg.parts
                      ?.filter((p: { type: string }) => p.type === "text")
                      .map((p: { type: string; text?: string }) => p.text ?? "")
                      .join("") ?? "";
                    if (text) sendMessage({ text });
                  }
                }}
                className="flex items-center gap-2 text-[13px]"
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            </div>
          )}

          {/* Show streaming skeleton while waiting for first token from assistant */}
          {isSubmitting &&
            (displayMessages.length === 0 ||
              displayMessages[displayMessages.length - 1]?.role !== "assistant") && (
              <div className="flex flex-col items-start gap-1">
                <span className="text-[12px] font-medium text-muted-foreground px-1">
                  MindMap
                </span>
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    <span className="text-[14px] text-muted-foreground">
                      Thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
        </div>

        {/* Misconception reveal — shown after session resolves */}
        {isTerminal && resolvedOutcome && resolvedOutcome !== "incomplete" && (
          <div className="px-6 pb-4">
            <MisconceptionReveal
              misconceptionName={misconceptionName}
              resolved={isResolved}
            />
          </div>
        )}

        {/* Input area — hidden after session is complete */}
        {!isTerminal && (
          <div className="border-t border-border p-4">
            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
              <div className="flex-1">
                <label htmlFor={`diagnostic-input-${sessionId}`} className="sr-only">
                  Your response
                </label>
                <Textarea
                  id={`diagnostic-input-${sessionId}`}
                  placeholder="Share what you think..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting}
                  className="min-h-[72px] bg-muted border-input text-[15px] resize-none"
                  aria-label="Your response"
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting || !input.trim()}
                className="h-11 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
                aria-label="Send response"
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Terminal state footer — session complete */}
        {isTerminal && (
          <div className="border-t border-border px-6 py-4 bg-muted/50">
            <p className="text-[13px] text-muted-foreground text-center">
              This diagnostic session is complete.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
