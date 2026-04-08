"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";

interface Question {
  id: string;
  text: string;
  aiResponse: string | null;
  createdAt: Date;
}

interface QuestionHistoryProps {
  questions: Question[];
}

function formatDateHeader(date: Date): string {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayUTC = new Date(todayUTC.getTime() - 86_400_000);

  const questionDayUTC = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

  if (questionDayUTC.getTime() === todayUTC.getTime()) return "Today";
  if (questionDayUTC.getTime() === yesterdayUTC.getTime()) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterdayUTC = new Date(todayUTC.getTime() - 86_400_000);
  const questionDayUTC = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

  const isToday = questionDayUTC.getTime() === todayUTC.getTime();
  const isYesterday = questionDayUTC.getTime() === yesterdayUTC.getTime();

  if (isToday || isYesterday) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
  }

  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function QuestionEntry({ question }: { question: Question }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="p-6">
      <p className="text-[20px] font-semibold text-[#18181b] leading-snug">{question.text}</p>
      <p className="mt-1 text-[14px] text-[#71717a]">
        {formatTimestamp(new Date(question.createdAt))}
      </p>
      {question.aiResponse && (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="text-[14px] font-medium text-[#18181b] underline underline-offset-2 hover:text-[#52525b] transition-colors"
          >
            {expanded ? "Hide answer" : "See answer"}
          </button>
          {expanded && (
            <div className="mt-4 text-[16px] text-[#18181b] leading-relaxed whitespace-pre-wrap">
              {question.aiResponse}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function QuestionHistory({ questions }: QuestionHistoryProps) {
  if (questions.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[20px] font-semibold text-[#18181b]">No questions yet</p>
        <p className="mt-2 text-[16px] text-[#71717a]">
          Submit your first curiosity question from your dashboard to get started.
        </p>
      </div>
    );
  }

  // Group questions by UTC date header
  const groups: { header: string; questions: Question[] }[] = [];
  const seen = new Map<string, { header: string; questions: Question[] }>();

  for (const q of questions) {
    const date = new Date(q.createdAt);
    const header = formatDateHeader(date);
    if (!seen.has(header)) {
      const group = { header, questions: [] as Question[] };
      seen.set(header, group);
      groups.push(group);
    }
    seen.get(header)!.questions.push(q);
  }

  return (
    <div>
      {/* Phase 3+ may need virtualization for large lists — currently capped at 30 entries */}
      {groups.map((group) => (
        <div key={group.header}>
          <h2 className="sticky top-0 z-10 bg-[#f4f4f5] px-0 py-2 text-[14px] font-normal text-[#71717a] mb-4">
            {group.header}
          </h2>
          <div className="flex flex-col gap-4 mb-8">
            {group.questions.map((q) => (
              <QuestionEntry key={q.id} question={q} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
