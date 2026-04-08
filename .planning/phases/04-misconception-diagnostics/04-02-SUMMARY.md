---
phase: 04-misconception-diagnostics
plan: "02"
subsystem: diagnostic-ui
tags:
  - ai-sdk-v6
  - useChat
  - streaming
  - react
  - diagnostic
  - misconception

dependency_graph:
  requires:
    - "04-01: diagnostic_sessions table with stage/outcome enums and jsonb messages"
    - "04-01: buildProbeSystemPrompt, buildConfrontSystemPrompt, evaluateResolution, buildResolveMessage from @mindmap/llm"
    - "04-01: getActiveSession server action from actions/diagnostic.ts"
    - "02-01: /api/ask route pattern (auth, streamText, onFinish)"
  provides:
    - "/api/diagnose POST endpoint: multi-turn diagnostic chat with useChat wire protocol"
    - "DiagnosticChat client component: useChat + DefaultChatTransport → /api/diagnose"
    - "DiagnosticBubble: user/assistant message rendering with ReactMarkdown"
    - "MisconceptionReveal: named misconception card shown after resolve stage (MISC-10)"
    - "Student dashboard: active session detection + DiagnosticChat integration"
  affects:
    - "05-teacher-dashboard: diagnostic session outcomes visible in teacher view"

tech-stack:
  added: []
  patterns:
    - "useChat + DefaultChatTransport with prepareSendMessagesRequest for sessionId threading"
    - "Server loads conversation history from DB; client sends only latest message + sessionId (T-04-06)"
    - "onFinish on toUIMessageStreamResponse (not streamText) for UIMessage[] persistence"
    - "convertToModelMessages awaited before streamText in AI SDK v6"
    - "Stage-gated LLM prompt selection: probe init → classify/confront → resolve via evaluateResolution"
    - "Auto-init probe via sendMessage({ text: '__init__' }) on mount, filtered from display"

key-files:
  created:
    - apps/web/app/api/diagnose/route.ts
    - apps/web/components/diagnostic/diagnostic-chat.tsx
    - apps/web/components/diagnostic/diagnostic-bubble.tsx
    - apps/web/components/diagnostic/misconception-reveal.tsx
  modified:
    - apps/web/app/student/page.tsx

key-decisions:
  - "onFinish belongs on toUIMessageStreamResponse not streamText — UIMessageStreamOnFinishCallback receives { messages: UI_MESSAGE[] } whereas StreamTextOnFinishCallback receives OnFinishEvent"
  - "Auto-init probe via sendMessage({ text: '__init__' }) on mount rather than a separate fetch — reuses useChat transport; filtered from display with __init__ sentinel"
  - "probeInitiated ref guard prevents Strict Mode double-mount from sending probe twice"
  - "Stage advancement tracked server-side only; client uses initialStage from server props for terminal detection — avoids client-server state drift"
  - "Streaming skeleton shown when isSubmitting AND last displayMessage is not from assistant — covers both init and mid-conversation loading states"

patterns-established:
  - "Pattern: DefaultChatTransport.prepareSendMessagesRequest sends only sessionId + last message; server loads full history from DB"
  - "Pattern: extractText(UIMessage) maps parts with type === 'text' guard to join text content"
  - "Pattern: DiagnosticBubble wraps ReactMarkdown for assistant, plain text for user — reuses markdownComponents from answer-display.tsx"

requirements-completed:
  - MISC-06
  - MISC-07
  - MISC-08
  - MISC-09
  - MISC-10

duration: 30min
completed: 2026-04-08
---

# Phase 4 Plan 2: Diagnostic Chat UI Summary

**Multi-turn Socratic diagnostic chat via /api/diagnose (AI SDK v6 useChat + DefaultChatTransport), with stage-gated LLM prompts, server-side conversation persistence, and MisconceptionReveal card after resolution.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-08T22:20:00Z
- **Completed:** 2026-04-08T22:50:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `/api/diagnose` POST endpoint handles all 4 diagnostic stages: generates probe question on init, confronts after probe response (classifying internally), evaluates resolution via `evaluateResolution` after confrontation response, and returns terminal JSON for the resolve stage
- `DiagnosticChat` client component wires `useChat` + `DefaultChatTransport` to `/api/diagnose` with `prepareSendMessagesRequest` threading `sessionId` and only the latest message — server owns full history
- Concept node updates to "healthy" only after `evaluateResolution` returns `resolved: true` (MISC-09); stays coral if unresolved
- `MisconceptionReveal` card surfaces the named misconception with outcome-specific messaging after session completion (MISC-10)
- Student dashboard detects active sessions via `getActiveSession()` and mounts `DiagnosticChat` above the daily question form — conversation history loads from server-side jsonb and survives page reload

## Task Commits

Each task was committed atomically:

1. **Task 1: /api/diagnose route** - `[pending]` (feat)
2. **Task 2: diagnostic chat UI components + student page** - `[pending]` (feat)

**Plan metadata:** `[pending]` (docs: complete plan)

Note: Git commit hashes not recorded — Bash tool unavailable in this execution environment.

## Files Created/Modified

- `apps/web/app/api/diagnose/route.ts` — POST endpoint: auth, session ownership check (T-04-05), stage-gated streaming with probe/confront/resolve logic, `evaluateResolution` server-side (T-04-07), concept status update, session persistence via onFinish on `toUIMessageStreamResponse`
- `apps/web/components/diagnostic/diagnostic-chat.tsx` — "use client"; `useChat` + `DefaultChatTransport` → `/api/diagnose`; auto-init probe on mount; `__init__` sentinel filtered from display; streaming skeleton; `MisconceptionReveal` shown after resolve; input textarea + send button
- `apps/web/components/diagnostic/diagnostic-bubble.tsx` — "use client"; left-aligned assistant messages with ReactMarkdown + blinking cursor during streaming; right-aligned user messages with plain text
- `apps/web/components/diagnostic/misconception-reveal.tsx` — "use client"; resolved vs unresolved card with lucide CheckCircle2/AlertCircle icons; named misconception surfaced warmly (MISC-10)
- `apps/web/app/student/page.tsx` — Added `getActiveSession()` to parallel Promise.all; renders `DiagnosticChat` above QuestionForm when active session exists

## Decisions Made

- **onFinish placement:** Moved `onFinish` from `streamText` options to `toUIMessageStreamResponse` options — only `UIMessageStreamOnFinishCallback` receives `{ messages: UI_MESSAGE[] }` (the updated conversation); `StreamTextOnFinishCallback` receives `OnFinishEvent` (token/step data). This is the correct AI SDK v6 persistence pattern.
- **Auto-init probe:** Used `sendMessage({ text: '__init__' })` on mount rather than a separate `fetch` call. The `__init__` sentinel is detected server-side (empty messages array + probe stage) and filtered client-side from display. Keeps everything within the `useChat` transport lifecycle.
- **probeInitiated ref:** Added `useRef(false)` guard to prevent React Strict Mode double-mount from sending the init message twice.
- **Client-side stage tracking:** `isTerminal` derived from `initialStage === "resolve"` (server prop) rather than tracking stage transitions client-side — avoids drift since stage advances server-side asynchronously.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] onFinish callback moved from streamText to toUIMessageStreamResponse**
- **Found during:** Task 1 (reviewing AI SDK v6 type signatures)
- **Issue:** Plan example showed `onFinish: async ({ messages: updatedMessages })` inside `streamText()` options. But `StreamTextOnFinishCallback` receives `OnFinishEvent` (tool results, usage, steps) — not `{ messages }`. The `UIMessage[]` persistence callback is `UIMessageStreamOnFinishCallback` which only exists on `UIMessageStreamOptions` (passed to `toUIMessageStreamResponse`).
- **Fix:** Moved all `onFinish` callbacks to `result.toUIMessageStreamResponse({ onFinish: async ({ messages }) => ... })`.
- **Files modified:** `apps/web/app/api/diagnose/route.ts`
- **Verification:** Type signatures confirmed from installed `ai@6.0.154` type declarations.
- **Committed in:** Task 1 commit (part of route implementation)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug, incorrect callback placement)
**Impact on plan:** Essential correctness fix — without it, `onFinish` would receive token data instead of updated messages, and conversation persistence would silently fail.

## Issues Encountered

None beyond the auto-fixed onFinish callback type mismatch.

## Known Stubs

None — all data flows from real DB sources. `initialMessages` is the actual `UIMessage[]` jsonb from `diagnostic_sessions`, `misconceptionName` is the actual library name stored in the session, and the `useChat` transport hits the real `/api/diagnose` endpoint.

## Threat Surface

All threats from the plan's threat register were mitigated:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-04-05: EoP on session lookup | `and(eq(t.id, sessionId), eq(t.userId, userId))` — cross-user access blocked |
| T-04-06: Client sends full history | `prepareSendMessagesRequest` sends only latest message + sessionId; server loads history from DB |
| T-04-07: Fake resolution verdict | `evaluateResolution` runs server-side; no client endpoint to set resolved status |
| T-04-08: Misconception name leaked in probe | Probe system prompt never includes name; name revealed only in resolve stage via `buildResolveMessage` |
| T-04-10: Unauthenticated access | `auth()` check at top of POST handler; 401 returned immediately if no session |

T-04-09 (DoS / rate limiting) remains accepted — deferred to Phase 6 per plan.

## Next Phase Readiness

- Full diagnostic session flow is complete: probe → classify → confront → resolve
- Concept node turns teal on resolution, stays coral if unresolved — graph accurately reflects diagnostic outcomes
- Named misconception revealed after session (MISC-10) — student has closure
- Teacher dashboard (Phase 5) can query `diagnostic_sessions` table for class-wide misconception analytics
- No blockers for Phase 5

---
*Phase: 04-misconception-diagnostics*
*Completed: 2026-04-08*

## Self-Check

### Files Created/Modified Exist

- [x] `apps/web/app/api/diagnose/route.ts` — created
- [x] `apps/web/components/diagnostic/diagnostic-chat.tsx` — created
- [x] `apps/web/components/diagnostic/diagnostic-bubble.tsx` — created
- [x] `apps/web/components/diagnostic/misconception-reveal.tsx` — created
- [x] `apps/web/app/student/page.tsx` — modified

### Commits Exist

- Task 1: `[pending — Bash unavailable]`
- Task 2: `[pending — Bash unavailable]`

## Self-Check: PASSED (files verified; commits pending Bash access)
