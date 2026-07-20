"use client";

import { Trophy, ShieldAlert, TrendingDown, Minus } from "lucide-react";
import { type Report, type ReportEntry, type Currency } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, SectionLabel } from "@/components/ui/card";
import { titleize } from "@/lib/utils";

const OUTCOME_TONE: Record<string, "success" | "info" | "neutral"> = {
  quote: "success",
  callback_commitment: "info",
  documented_decline: "neutral",
};

/** At-a-glance side-by-side of EVERY agency contacted — quotes, deposit, total
 *  (GBP + PKR), red flags and outcome. Read-only over the existing /api/report
 *  data; ranking logic is untouched (ranked entries keep their rank/order). */
export function AgenciesContacted({
  report,
  cur,
  mode,
}: {
  report: Report;
  cur: Currency;
  mode: "GBP" | "PKR";
}) {
  const entries: ReportEntry[] = [...report.ranked, ...report.others];
  if (entries.length === 0) return null;

  const fmt = (gbp: number) =>
    mode === "PKR"
      ? `${cur.secondary} ${Math.round(gbp * cur.rate).toLocaleString()}`
      : `${cur.symbol}${Math.round(gbp).toLocaleString()}`;

  const lowestDeposit = (e: ReportEntry) =>
    (e.deposits ?? []).reduce<{ university: string; amount: number } | null>(
      (lo, d) => (lo === null || d.amount < lo.amount ? d : lo),
      null,
    );

  return (
    <div className="mb-6">
      <SectionLabel className="mb-3">Agencies contacted · side-by-side ({mode})</SectionLabel>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-left text-xs uppercase tracking-wide text-muted-2">
                <th className="py-3 pl-4 pr-3 font-medium">Agency</th>
                <th className="py-3 pr-3 font-medium">Outcome</th>
                <th className="py-3 pr-3 text-right font-medium">Consultancy charges</th>
                <th className="py-3 pr-3 text-right font-medium">Lowest deposit</th>
                <th className="py-3 pr-3 text-right font-medium">Negotiated</th>
                <th className="py-3 pr-4 text-right font-medium">Red flags</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isWinner = e.rank === 1;
                const dep = lowestDeposit(e);
                const hasQuote = e.outcome === "quote" && e.consultancy_total != null;
                return (
                  <tr
                    key={e.call_id}
                    className={`border-b border-border/50 last:border-0 ${isWinner ? "bg-success/5" : ""}`}
                  >
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex items-center gap-2">
                        {isWinner && <Trophy className="h-3.5 w-3.5 shrink-0 text-success" />}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{e.consultancy_name}</p>
                          <p className="text-xs text-muted-2">#{e.call_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <Badge tone={OUTCOME_TONE[e.outcome ?? ""] ?? "neutral"}>
                        {titleize(e.outcome ?? "in progress")}
                      </Badge>
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {hasQuote ? (
                        <span className={isWinner ? "font-semibold text-success" : "font-medium"}>
                          {fmt(e.consultancy_total!)}
                        </span>
                      ) : (
                        <Minus className="ml-auto h-3.5 w-3.5 text-muted-2" />
                      )}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {dep ? (
                        <span>
                          {fmt(dep.amount)}
                          <span className="block text-xs text-muted-2">{dep.university}</span>
                        </span>
                      ) : (
                        <Minus className="ml-auto h-3.5 w-3.5 text-muted-2" />
                      )}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {(e.savings ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 font-medium text-success">
                          <TrendingDown className="h-3.5 w-3.5" />−{fmt(e.savings!)}
                        </span>
                      ) : (
                        <Minus className="ml-auto h-3.5 w-3.5 text-muted-2" />
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {e.red_flags.length > 0 ? (
                        <Badge tone="danger">
                          <ShieldAlert className="h-3 w-3" /> {e.red_flags.length}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-2">none</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-2 text-xs text-muted-2">
        Consultancy charges exclude university deposits (they pass through to the university). Totals
        shown in {mode}. Full itemised breakdowns and the recommendation follow below.
      </p>
    </div>
  );
}
