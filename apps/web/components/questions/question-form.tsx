"use client";

import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Sparkles, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AnswerDisplay } from "./answer-display";

interface TodayQuestion {
  text: string;
  aiResponse: string | null;
}

interface ConceptLink {
  id: string;
  name: string;
}

interface DiagnosticSessionInfo {
  id: string;
  stage: string;
  outcome?: string | null;
  misconceptionName: string;
}

interface QuestionFormProps {
  hasAskedToday: boolean;
  todayQuestion?: TodayQuestion | null;
  gradeLevel: number;
  todayConcepts?: ConceptLink[];
  todayDiagnostic?: DiagnosticSessionInfo | null;
}

function getErrorMessage(error: Error | undefined): string {
  if (!error) return "Something went wrong. Please try again later.";
  const msg = error.message ?? "";
  if (msg.includes("503") || msg.includes("ANTHROPIC_API_KEY") || msg.includes("AI features require")) {
    return "AI features require an API key. Please configure ANTHROPIC_API_KEY in your environment.";
  }
  if (msg.includes("504") || msg.includes("timeout") || msg.includes("Timeout")) {
    return "The AI is taking longer than expected. Please try again.";
  }
  if (msg.includes("401") || msg.includes("API key") || msg.includes("Unauthorized")) {
    return "AI features require an API key. Please configure ANTHROPIC_API_KEY in your environment.";
  }
  return "Something went wrong. Please try again later.";
}

export function QuestionForm({
  hasAskedToday,
  todayQuestion,
  gradeLevel,
  todayConcepts = [],
  todayDiagnostic = null,
}: QuestionFormProps) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [localQuestion, setLocalQuestion] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<ConceptLink[]>(todayConcepts);
  const [diagnosticSession, setDiagnosticSession] = useState<DiagnosticSessionInfo | null>(todayDiagnostic);
  const [pollingDiagnostic, setPollingDiagnostic] = useState(false);
  // D-02: Transition state for auto-navigate flow
  const [transitioning, setTransitioning] = useState(false);

  const { completion, complete, isLoading, error } = useCompletion({
    api: "/api/ask",
    streamProtocol: "text",
    onFinish: async () => {
      setSubmitted(true);
      setPendingQuestion(null);
      setTransitioning(true);

      // D-06: Start concept polling and transition delay in parallel
      let foundConcepts: ConceptLink[] = [];

      const pollPromise = (async () => {
        try {
          const { getTodayQuestionConcepts } = await import("@/actions/questions");
          // D-04: Poll every 2s, max 5 attempts (D-05)
          for (let i = 0; i < 5; i++) {
            const newConcepts = await getTodayQuestionConcepts();
            if (newConcepts.length > 0) {
              foundConcepts = newConcepts;
              setConcepts(newConcepts);
              break;
            }
            if (i < 4) await new Promise((r) => setTimeout(r, 2000));
          }
        } catch {
          // Non-critical — navigate without animation
        }
      })();

      // D-01: Minimum 2s delay for transition message visibility
      const delayPromise = new Promise((r) => setTimeout(r, 2000));

      // Wait for both polling and delay
      await Promise.all([pollPromise, delayPromise]);

      // D-03: Navigate with animation params
      if (foundConcepts.length > 0) {
        const nodeIds = foundConcepts.map((c) => c.id).join(",");
        router.push(`/student/graph?animate=true&newNodes=${nodeIds}`);
      } else {
        // D-05: Silent fallback — navigate without animation
        router.push("/student/graph");
      }

      // Poll for diagnostic session in background (non-blocking)
      setPollingDiagnostic(true);
      (async () => {
        try {
          const { getActiveSession } = await import("@/actions/diagnostic");
          for (let i = 0; i < 3; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const session = await getActiveSession();
            if (session) {
              setDiagnosticSession({
                id: session.id,
                stage: session.stage,
                outcome: session.outcome,
                misconceptionName: session.misconceptionName,
              });
              break;
            }
          }
        } catch {
          // Non-critical — diagnostic is a bonus feature
        } finally {
          setPollingDiagnostic(false);
        }
      })();
    },
    onError: () => {
      // Toast is secondary — the inline error UI is the primary feedback
      toast.error("Couldn't get an answer right now. Please try again.");
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setLocalQuestion(trimmed);
    setPendingQuestion(trimmed);
    setQuestion("");

    await complete(trimmed, {
      body: { question: trimmed },
    });
  };

  const handleRetry = async () => {
    const trimmed = pendingQuestion ?? localQuestion;
    if (!trimmed || isLoading) return;
    await complete(trimmed, {
      body: { question: trimmed },
    });
  };

  // Determine if we're in the "already asked" state (either from server or after submission)
  const isAlreadyAsked = hasAskedToday || submitted;

  // Which question to display in the daily-limit state
  const displayQuestion = localQuestion ?? todayQuestion?.text ?? null;
  const displayAnswer = completion || todayQuestion?.aiResponse || null;

  // Show daily-limit state
  if (isAlreadyAsked) {
    return (
      <div className="space-y-4">
        {/* Daily limit card */}
        <div className="bg-muted rounded-xl p-6">
          <p className="text-[16px] font-semibold text-foreground">
            You&apos;ve asked your question for today
          </p>
          <p className="text-[14px] text-muted-foreground mt-1">
            Come back tomorrow to keep your streak going. Your question is being
            processed below.
          </p>
        </div>

        {/* Show today's question text */}
        {displayQuestion && (
          <div className="rounded-xl border border-border p-4">
            <p className="text-[16px] text-foreground">{displayQuestion}</p>
          </div>
        )}

        {/* Show the answer — either streamed or previously stored */}
        {displayAnswer && (
          <AnswerDisplay markdown={displayAnswer} isStreaming={false} />
        )}

        {/* D-02: Transition message during auto-navigate */}
        {transitioning && (
          <div className="bg-muted rounded-xl p-4" role="status" aria-live="polite">
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <p className="text-[14px] text-muted-foreground">
                Your graph is growing...
              </p>
            </div>
          </div>
        )}

        {/* D-04: Concept readiness polling indicator */}
        {transitioning && concepts.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-2" aria-live="polite">
            <Loader2 className="size-3.5 animate-spin text-white/40" />
            <p className="text-[13px] text-white/40">Preparing your graph...</p>
          </div>
        )}

        {/* Explore on Graph button (D-01: remains as fallback) */}
        {displayAnswer && !transitioning && (
          <Button
            variant="outline"
            className="w-full h-11 border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2"
            onClick={() => {
              const nodeParam = concepts.length > 0 ? `?node=${concepts[0].id}` : "";
              router.push(`/student/graph${nodeParam}`);
            }}
          >
            <Sparkles className="size-4" />
            Explore on your graph
          </Button>
        )}

        {/* Diagnostic CTA — shown when a misconception session exists */}
        {diagnosticSession && !transitioning && (
          <Button
            variant="outline"
            className="w-full h-11 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 gap-2"
            onClick={() => router.push(`/student/diagnose/${diagnosticSession.id}`)}
          >
            <MessageCircle className="size-4" />
            {diagnosticSession.stage === "resolve"
              ? "View your diagnostic results"
              : "Let\u2019s explore your thinking on this..."}
          </Button>
        )}

        {/* Polling indicator while checking for diagnostic session */}
        {pollingDiagnostic && !diagnosticSession && !transitioning && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="size-3.5 animate-spin text-white/40" />
            <p className="text-[13px] text-white/40">Analyzing your understanding...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Question input form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="question-input" className="sr-only">
            What are you curious about today?
          </label>
          <Textarea
            id="question-input"
            placeholder="What are you curious about today?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isLoading}
            className="min-h-[88px] bg-muted border-input text-[16px] resize-none"
            aria-label="What are you curious about today?"
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="h-11 px-6 bg-primary text-primary-foreground hover:bg-primary/90 text-[14px] font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Thinking...
              </>
            ) : (
              "Ask my question"
            )}
          </Button>
        </div>
      </form>

      {/* Streaming answer display */}
      {(completion || isLoading) && localQuestion && (
        <div className="space-y-3">
          {/* The submitted question text */}
          <div className="rounded-xl border border-border p-4">
            <p className="text-[16px] text-foreground">{localQuestion}</p>
          </div>

          {/* Streaming or completed answer */}
          {completion ? (
            <AnswerDisplay markdown={completion} isStreaming={isLoading} />
          ) : (
            // Skeleton loader while waiting for first token
            <div
              role="status"
              aria-live="polite"
              aria-label="Loading answer"
              className="bg-card rounded-xl border border-border p-6 mt-4 space-y-3"
            >
              <p className="sr-only">MindMap is thinking...</p>
              <div className="h-4 bg-muted rounded animate-pulse w-full" />
              <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
              <div className="h-4 bg-muted rounded animate-pulse w-4/6" />
            </div>
          )}

          {/* D-02: Transition message during auto-navigate */}
          {transitioning && (
            <div className="bg-muted rounded-xl p-4" role="status" aria-live="polite">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="size-4 text-muted-foreground" />
                <p className="text-[14px] text-muted-foreground">
                  Your graph is growing...
                </p>
              </div>
            </div>
          )}

          {/* D-04: Concept readiness polling indicator */}
          {transitioning && concepts.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-2" aria-live="polite">
              <Loader2 className="size-3.5 animate-spin text-white/40" />
              <p className="text-[13px] text-white/40">Preparing your graph...</p>
            </div>
          )}

          {/* Explore on Graph — shown after streaming completes (D-01: fallback) */}
          {submitted && !isLoading && !transitioning && (
            <Button
              variant="outline"
              className="w-full h-11 border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2"
              onClick={() => {
                const nodeParam = concepts.length > 0 ? `?node=${concepts[0].id}` : "";
                router.push(`/student/graph${nodeParam}`);
              }}
            >
              <Sparkles className="size-4" />
              Explore on your graph
            </Button>
          )}

          {/* Diagnostic CTA — shown after streaming when a session is found */}
          {submitted && !isLoading && diagnosticSession && !transitioning && (
            <Button
              variant="outline"
              className="w-full h-11 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 gap-2"
              onClick={() => router.push(`/student/diagnose/${diagnosticSession.id}`)}
            >
              <MessageCircle className="size-4" />
              Let&apos;s explore your thinking on this...
            </Button>
          )}

          {/* Polling indicator */}
          {pollingDiagnostic && !diagnosticSession && !transitioning && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="size-3.5 animate-spin text-white/40" />
              <p className="text-[13px] text-white/40">Analyzing your understanding...</p>
            </div>
          )}
        </div>
      )}

      {/* Error state with specific message and retry button */}
      {error && !isLoading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <p className="text-[14px] text-destructive">
            {getErrorMessage(error)}
          </p>
          {pendingQuestion && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="flex items-center gap-2 text-[13px]"
            >
              <RefreshCw className="size-3.5" />
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
