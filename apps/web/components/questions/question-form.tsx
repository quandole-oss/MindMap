"use client";

import { useState } from "react";
import { useCompletion } from "@ai-sdk/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AnswerDisplay } from "./answer-display";

interface TodayQuestion {
  text: string;
  aiResponse: string | null;
}

interface QuestionFormProps {
  hasAskedToday: boolean;
  todayQuestion?: TodayQuestion | null;
  gradeLevel: number;
}

export function QuestionForm({
  hasAskedToday,
  todayQuestion,
  gradeLevel,
}: QuestionFormProps) {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [localQuestion, setLocalQuestion] = useState<string | null>(null);

  const { completion, complete, isLoading, error } = useCompletion({
    api: "/api/ask",
    streamProtocol: "text",
    onFinish: () => {
      toast("New concepts added to your graph");
      setSubmitted(true);
    },
    onError: () => {
      toast.error(
        "We couldn't get an answer right now. Your question was saved — we'll try again shortly.",
      );
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setLocalQuestion(trimmed);
    setQuestion("");

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
        </div>
      )}

      {/* Network/unknown error state */}
      {error && !isLoading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-[14px] text-destructive">
            We couldn&apos;t get an answer right now. Your question was saved
            &mdash; we&apos;ll try again shortly.
          </p>
        </div>
      )}
    </div>
  );
}
