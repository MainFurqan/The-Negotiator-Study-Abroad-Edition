"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ShieldAlert, TrendingDown, Trophy, ExternalLink } from "lucide-react";
import { type ReportEntry, type Currency, ITEM_LABELS, effectiveRows } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MEDALS = ["🥇", "🥈", "🥉"];
const SEV_TONE = { high: "danger", medium: "warning", low: "neutral" } as const;

export function ConsultantCard({
  entry,
  cur,
  mode,
  defaultOpen = false,
}: {
  entry: ReportEntry;
  cur: Currency;
  mode: "GBP" | "PKR";
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const rank = entry.rank ?? 0;
  const isWinner = rank === 1;

  const fmt = (gbp: number) =>
    mode === "PKR"
      ? `${cur.secondary} ${Math.round(gbp * cur.rate).toLocaleString()}`
      : `${cur.symbol}${Math.round(gbp).toLocaleString()}`;

  const rows = effectiveRows(entry.items ?? []);

  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow",
        isWinner && "border-success/40 shadow-[0_0_0_1px_hsl(var(--success)/0.3)]",
      )}
    >
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-lg">
          {MEDALS[rank - 1] ?? `#${rank}`}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{entry.consultancy_name}</span>
            {isWinner && (
              <Badge tone="success">
                <Trophy className="h-3 w-3" /> Best value
              </Badge>
            )}
            {entry.persona_id && <Badge tone="violet">{entry.persona_id.replace(/_/g, " ")}</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-2">
            Call #{entry.call_id}
            {entry.conversation_id ? ` · recording ${entry.conversation_id.slice(0, 10)}…` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(entry.savings ?? 0) > 0 && (
            <Badge tone="success">
              <TrendingDown className="h-3 w-3" /> {fmt(entry.savings!)}
            </Badge>
          )}
          {entry.red_flags.length > 0 && (
            <Badge tone="danger">
              <ShieldAlert className="h-3 w-3" /> {entry.red_flags.length}
            </Badge>
          )}
          <div className="text-right">
            <p className="font-semibold tabular-nums">{fmt(entry.consultancy_total ?? 0)}</p>
            <p className="text-xs text-muted-2">charges</p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-2 transition-transform", open && "rotate-180")} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border"
          >
            <div className="space-y-4 p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-2">
                    <th className="py-2 pr-2 font-medium">Item</th>
                    <th className="py-2 pr-2 font-medium">University / note</th>
                    <th className="py-2 text-right font-medium">{mode}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((q, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-2">{ITEM_LABELS[q.item] ?? q.item}</td>
                      <td className="py-2 pr-2 text-muted">
                        {[q.university, q.note].filter(Boolean).join(" — ") || "—"}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {!!q.is_revised && q.revised_from != null && (
                          <span className="mr-2 text-muted-2 line-through">{fmt(q.revised_from)}</span>
                        )}
                        <span className={q.is_revised ? "font-semibold text-success" : ""}>{fmt(q.amount)}</span>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-2 font-medium" colSpan={2}>
                      Consultancy charges (excl. deposits)
                    </td>
                    <td className="pt-2 text-right font-semibold tabular-nums">
                      {fmt(entry.consultancy_total ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {entry.red_flags.length > 0 && (
                <div className="space-y-2">
                  {entry.red_flags.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger-soft/40 p-2.5 text-sm"
                    >
                      <Badge tone={SEV_TONE[f.severity]}>{f.severity}</Badge>
                      <span className="text-muted">
                        <span className="font-medium text-foreground">{f.description}.</span> {f.detail}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {entry.conversation_id && (
                <a
                  href={`https://elevenlabs.io/app/conversational-ai/history/${entry.conversation_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Open call recording
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
