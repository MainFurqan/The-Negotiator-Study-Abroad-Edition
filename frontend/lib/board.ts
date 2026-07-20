import { type Call, type Quote, ITEM_LABELS, effectiveRows, consultancyTotal } from "@/lib/api";
import { money } from "@/lib/utils";

export type StageId = "connecting" | "disclosure" | "itemising" | "negotiating" | "closing" | "done";

export const STAGES: { id: StageId; label: string }[] = [
  { id: "connecting", label: "Connecting" },
  { id: "disclosure", label: "Intro & disclosure" },
  { id: "itemising", label: "Itemising fees" },
  { id: "negotiating", label: "Negotiating" },
  { id: "closing", label: "Closing" },
  { id: "done", label: "Outcome logged" },
];

/** Seconds since the call started (SQLite 'YYYY-MM-DD HH:MM:SS' is UTC). */
export function elapsedSeconds(startedAt: string, now: number): number {
  const iso = startedAt.includes("T") ? startedAt : startedAt.replace(" ", "T") + "Z";
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 1000));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Which negotiation stage a call is in, derived from its quotes + outcome. */
export function deriveStage(call: Call, elapsed: number): { id: StageId; index: number } {
  if (call.outcome) return { id: "done", index: 5 };
  const revised = call.quotes.some((q) => q.is_revised);
  if (revised) return { id: "negotiating", index: 3 };
  if (call.quotes.length > 0) return { id: "itemising", index: 2 };
  if (elapsed < 8) return { id: "connecting", index: 0 };
  return { id: "disclosure", index: 1 };
}

/** 0..1 confidence heuristic for the meter — more items, revisions and a clean
 *  outcome raise it; a decline lowers it. Purely presentational. */
export function confidence(call: Call): number {
  let c = 0.35;
  c += Math.min(0.3, effectiveRows(call.quotes).length * 0.07);
  if (call.quotes.some((q) => q.is_revised)) c += 0.2;
  if (call.outcome === "quote") c += 0.2;
  if (call.outcome === "callback_commitment") c += 0.05;
  if (call.outcome === "documented_decline") c -= 0.15;
  if (call.red_flags.length) c -= 0.05 * call.red_flags.length;
  return Math.max(0.05, Math.min(1, c));
}

/** GBP moved by negotiation on this call. */
export function callSavings(quotes: Quote[]): number {
  return quotes
    .filter((q) => q.is_revised && q.revised_from != null && q.revised_from > q.amount)
    .reduce((s, q) => s + (q.revised_from! - q.amount), 0);
}

export type Line = { key: string; speaker: "agent" | "consultant" | "system"; text: string };

/** A deterministic, stage-keyed transcript reconstructed from the logged quotes.
 *  Not the literal ElevenLabs audio transcript — a readable reconstruction that
 *  grows as figures are logged, so the demo reads as a live negotiation. */
export function buildTranscript(call: Call, symbol: string): Line[] {
  const lines: Line[] = [];
  const name = call.consultancy_name;
  lines.push({ key: "sys-0", speaker: "system", text: `Call connected to ${name}.` });
  lines.push({
    key: "agent-0",
    speaker: "agent",
    text: `Hello, I'm calling on behalf of a student applying for the September 2026 intake. Could you itemise your fees for me — service fee, application, deposit and visa separately?`,
  });

  call.quotes.forEach((q, i) => {
    const label = ITEM_LABELS[q.item] ?? q.item;
    const where = q.university ? ` for ${q.university}` : "";
    if (q.is_revised && q.revised_from != null) {
      lines.push({
        key: `agent-rev-${i}`,
        speaker: "agent",
        text: `Another consultancy quoted ${money(q.revised_from - (q.revised_from - q.amount), symbol)} — can you match or beat that?`,
      });
      lines.push({
        key: `cons-rev-${i}`,
        speaker: "consultant",
        text: `Alright — I can bring the ${label.toLowerCase()}${where} down to ${money(q.amount, symbol)}.`,
      });
    } else {
      lines.push({
        key: `cons-${i}`,
        speaker: "consultant",
        text: `The ${label.toLowerCase()}${where} is ${money(q.amount, symbol)}${q.note ? ` (${q.note})` : ""}.`,
      });
    }
  });

  call.red_flags.forEach((f, i) => {
    lines.push({
      key: `flag-${i}`,
      speaker: "agent",
      text:
        f.rule_id === "deposit_padding"
          ? `That deposit looks higher than the university's published figure — can you explain the difference?`
          : f.rule_id === "guaranteed_visa"
            ? `Visa decisions are made by UKVI — is that guarantee something you'd put in writing?`
            : `That's well below the market — are there any fees that come up later in the process?`,
    });
  });

  if (call.outcome === "quote") {
    const total = consultancyTotal(effectiveRows(call.quotes));
    lines.push({
      key: "close-quote",
      speaker: "agent",
      text: `Thank you — so that's ${money(total, symbol)} in consultancy charges. I'll pass this to the student to review.`,
    });
  } else if (call.outcome === "callback_commitment") {
    lines.push({ key: "close-cb", speaker: "consultant", text: call.outcome_detail || "I'll call you back with the details." });
  } else if (call.outcome === "documented_decline") {
    lines.push({ key: "close-dec", speaker: "consultant", text: call.outcome_detail || "I can't share prices over the phone." });
  }

  return lines;
}

export const OUTCOME_TONE: Record<string, "success" | "info" | "neutral"> = {
  quote: "success",
  callback_commitment: "info",
  documented_decline: "neutral",
};
