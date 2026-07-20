/* Shared gating logic for the floating step-flow bar.
 *
 * The flow is a strict funnel: Intake → Caller → Report. A step unlocks only when
 * the real backend state proves the previous stage produced what the next one
 * needs — you cannot skip ahead. This is derived from backend state, never from
 * client-only guesses:
 *   - Caller (/board)  unlocks when a profile is FROZEN  (GET /api/profile.confirmed)
 *   - Report (/report) unlocks when a call has ENDED     (an outcome in /api/calls)
 */

export type FlowStepId = "intake" | "board" | "report";

export type FlowStep = { id: FlowStepId; label: string; href: string };

export const FLOW_STEPS: FlowStep[] = [
  { id: "intake", label: "Intake", href: "/intake" },
  { id: "board", label: "Caller", href: "/board" },
  { id: "report", label: "Report", href: "/report" },
];

/** Real backend signals the gating is derived from. */
export type FlowStatus = {
  /** A student profile has been confirmed/frozen. */
  profileConfirmed: boolean;
  /** At least one call has ended (has a structured outcome). */
  hasEndedCall: boolean;
};

export const EMPTY_STATUS: FlowStatus = { profileConfirmed: false, hasEndedCall: false };

/** Can the user reach this step at all? */
export function isUnlocked(id: FlowStepId, s: FlowStatus): boolean {
  if (id === "intake") return true;
  if (id === "board") return s.profileConfirmed;
  return s.hasEndedCall; // report
}

/** Has the work of this step been completed (used to mark it "done")? */
export function isComplete(id: FlowStepId, s: FlowStatus): boolean {
  if (id === "intake") return s.profileConfirmed;
  if (id === "board") return s.hasEndedCall;
  return false; // report is terminal — only ever "current"
}

/** Why a locked step is locked — shown in the tooltip/toast when clicked. */
export function lockReason(id: FlowStepId): string {
  if (id === "board") return "Freeze a student profile first to unlock the caller.";
  if (id === "report") return "Complete at least one call to unlock the report.";
  return "";
}

export type StepState = "complete" | "current" | "available" | "locked";

export function stepState(id: FlowStepId, pathname: string, s: FlowStatus): StepState {
  const active = pathname === FLOW_STEPS.find((x) => x.id === id)!.href;
  if (!isUnlocked(id, s)) return "locked";
  if (active) return "current";
  if (isComplete(id, s)) return "complete";
  return "available";
}

/** True on the three flow pages where the bar should render (never on "/"). */
export function isFlowPath(pathname: string): boolean {
  return FLOW_STEPS.some((s) => pathname === s.href || pathname.startsWith(s.href + "/"));
}
