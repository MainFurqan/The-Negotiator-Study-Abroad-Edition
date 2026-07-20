"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TrendingDown } from "lucide-react";
import { type Quote, type Currency, ITEM_LABELS, effectiveRows, consultancyTotal } from "@/lib/api";
import { money, secondary } from "@/lib/utils";

export function QuoteList({
  quotes,
  currency,
  compact = false,
}: {
  quotes: Quote[];
  currency?: Currency;
  compact?: boolean;
}) {
  const rows = effectiveRows(quotes);
  const total = consultancyTotal(rows);
  const sym = currency?.symbol ?? "£";

  if (rows.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-2">No figures logged yet…</p>;
  }

  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-2">
            <th className="py-2 pr-2 font-medium">Item</th>
            {!compact && <th className="py-2 pr-2 font-medium">University / note</th>}
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {rows.map((q, i) => (
              <motion.tr
                key={`${q.item}-${q.university ?? ""}-${q.note ?? ""}-${i}`}
                initial={{ opacity: 0, backgroundColor: "hsl(var(--brand) / 0.12)" }}
                animate={{ opacity: 1, backgroundColor: "hsl(var(--brand) / 0)" }}
                transition={{ duration: 1.2 }}
                className="border-b border-border/60 last:border-0"
              >
                <td className="py-2 pr-2 font-medium">{ITEM_LABELS[q.item] ?? q.item}</td>
                {!compact && (
                  <td className="py-2 pr-2 text-muted">
                    {[q.university, q.note].filter(Boolean).join(" — ") || "—"}
                  </td>
                )}
                <td className="py-2 text-right tabular-nums">
                  {!!q.is_revised && q.revised_from != null && (
                    <span className="mr-2 text-muted-2 line-through">{money(q.revised_from, sym)}</span>
                  )}
                  <span
                    className={
                      q.is_revised ? "inline-flex items-center gap-1 font-semibold text-success" : "font-medium"
                    }
                  >
                    {!!q.is_revised && <TrendingDown className="h-3.5 w-3.5" />}
                    {money(q.amount, sym)}
                  </span>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
          <tr>
            <td className="pt-3 font-medium" colSpan={compact ? 1 : 2}>
              Consultancy charges
              <span className="ml-1 text-xs font-normal text-muted-2">excl. deposits</span>
            </td>
            <td className="pt-3 text-right font-semibold tabular-nums">
              {money(total, sym)}
              {currency && (
                <span className="ml-2 text-xs font-normal text-muted-2">
                  ≈ {secondary(total * currency.rate, currency.secondary)}
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
