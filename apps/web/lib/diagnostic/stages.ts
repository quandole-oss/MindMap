export type DiagnosticStage = "probe" | "classify" | "confront" | "resolve";
export type DiagnosticOutcome = "resolved" | "unresolved" | "incomplete" | null;

/** Check if a stage is terminal (no more interactions allowed) */
export function isTerminalStage(stage: DiagnosticStage): boolean {
  return stage === "resolve";
}

/** Valid transitions for each stage in the diagnostic state machine */
const VALID_TRANSITIONS: Record<DiagnosticStage, DiagnosticStage[]> = {
  probe: ["classify", "confront"], // classify is transient
  classify: ["confront"],
  confront: ["resolve"],
  resolve: [], // terminal -- no transitions out
};

/** Check if a stage transition is valid */
export function isValidTransition(
  from: DiagnosticStage,
  to: DiagnosticStage
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Determine the next expected stage given current state.
 *
 * The classify stage is transient -- the route handler sets it briefly
 * while generating the confrontation response, then advances to confront
 * in the onFinish callback.  From the caller's perspective, probe with a
 * student response goes straight to confront.
 */
export function getNextStage(
  current: DiagnosticStage,
  hasStudentResponse: boolean
): DiagnosticStage | null {
  if (current === "resolve") return null; // terminal
  if (current === "probe" && !hasStudentResponse) return "probe"; // still waiting
  if (current === "probe" && hasStudentResponse) return "confront"; // skip classify (transient)
  if (current === "classify") return "confront";
  if (current === "confront" && hasStudentResponse) return "resolve";
  return null;
}

/** Validate that an outcome is appropriate for a stage */
export function isValidOutcome(
  stage: DiagnosticStage,
  outcome: DiagnosticOutcome
): boolean {
  if (stage !== "resolve") return outcome === null;
  return outcome === "resolved" || outcome === "unresolved";
}
