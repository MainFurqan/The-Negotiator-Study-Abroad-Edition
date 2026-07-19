"use client";

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Item = {
  item: string;
  amount: number;
  currency: string;
  university: string | null;
  is_revised: number;
  revised_from: number | null;
  note: string | null;
  logged_at: string;
};

type RedFlag = {
  rule_id: string;
  severity: string;
  description: string;
  detail: string | null;
  flagged_at: string;
};

type Entry = {
  rank?: number;
  call_id: number;
  consultancy_name: string;
  persona_id: string | null;
  conversation_id: string | null;
  started_at: string;
  outcome: string | null;
  outcome_detail: string | null;
  red_flags: RedFlag[];
  items?: Item[];
  consultancy_total?: number;
  consultancy_total_secondary?: number;
  deposits?: { university: string; amount: number }[];
  savings?: number;
};

type Report = {
  vertical: string;
  currency: { symbol: string; quote_currency: string; secondary: string; rate: number; rate_note?: string };
  ranked: Entry[];
  others: Entry[];
  recommendation: string;
};

const ITEM_LABELS: Record<string, string> = {
  service_fee: "Service fee",
  university_application_fee: "Application fee",
  deposit: "Deposit",
  visa_processing_fee: "Visa processing",
  ihs_surcharge: "IHS surcharge",
  document_attestation: "Attestation",
  ielts_booking: "IELTS booking",
  other: "Other",
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/report`);
      setReport(await r.json());
      setError(null);
    } catch (e) {
      setError(`Backend unreachable at ${API} (${e})`);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cur = report?.currency;
  const money = (n: number) => `${cur?.symbol ?? "£"}${n.toLocaleString()}`;
  const pkr = (n: number) => `${cur?.secondary ?? "PKR"} ${Math.round(n * (cur?.rate ?? 0)).toLocaleString()}`;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ranked report</h1>
            <p className="text-sm text-zinc-500">
              {report?.vertical ?? "…"}{" "}
              <a href="/board" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
                ← Live board
              </a>
            </p>
          </div>
          <button
            onClick={refresh}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Refresh
          </button>
        </header>

        {error && (
          <p className="mb-6 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        {report && (
          <section className="mb-8 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Recommendation
            </h2>
            <p className="text-sm leading-relaxed">{report.recommendation}</p>
            {cur?.rate_note && (
              <p className="mt-2 text-xs text-zinc-500">
                FX: 1 {cur.quote_currency} = {cur.rate} {cur.secondary}. {cur.rate_note}
              </p>
            )}
          </section>
        )}

        <div className="space-y-6">
          {report?.ranked.map((e) => (
            <section
              key={e.call_id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xl">{MEDALS[(e.rank ?? 1) - 1] ?? `#${e.rank}`}</span>
                <h2 className="font-semibold">{e.consultancy_name}</h2>
                {e.persona_id && (
                  <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                    persona: {e.persona_id}
                  </span>
                )}
                <span className="text-xs text-zinc-400">
                  call #{e.call_id} · {e.started_at}
                  {e.conversation_id ? ` · rec ${e.conversation_id}` : ""}
                </span>
                {(e.savings ?? 0) > 0 && (
                  <span className="ml-auto rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    negotiated −{money(e.savings!)}
                  </span>
                )}
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                    <th className="py-1.5 pr-2 font-medium">Item</th>
                    <th className="py-1.5 pr-2 font-medium">University / note</th>
                    <th className="py-1.5 pr-2 text-right font-medium">{cur?.quote_currency}</th>
                    <th className="py-1.5 text-right font-medium">{cur?.secondary}</th>
                  </tr>
                </thead>
                <tbody>
                  {e.items?.map((q, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                      <td className="py-1.5 pr-2">{ITEM_LABELS[q.item] ?? q.item}</td>
                      <td className="py-1.5 pr-2 text-zinc-500">
                        {[q.university, q.note].filter(Boolean).join(" — ") || "—"}
                        <span className="ml-1 text-xs text-zinc-400">({q.logged_at})</span>
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {!!q.is_revised && q.revised_from != null && (
                          <span className="mr-2 text-zinc-400 line-through">{money(q.revised_from)}</span>
                        )}
                        <span className={q.is_revised ? "font-medium text-emerald-600 dark:text-emerald-400" : ""}>
                          {money(q.amount)}
                        </span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-zinc-500">{pkr(q.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-2 font-medium" colSpan={2}>
                      Consultancy charges (excl. deposits)
                    </td>
                    <td className="pt-2 text-right font-semibold tabular-nums">
                      {money(e.consultancy_total ?? 0)}
                    </td>
                    <td className="pt-2 text-right font-semibold tabular-nums">
                      {(cur?.secondary ?? "PKR") + " " + (e.consultancy_total_secondary ?? 0).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>

              {e.red_flags.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {e.red_flags.map((f, i) => (
                    <p key={i} className="flex items-start gap-2 text-sm">
                      <span
                        className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[f.severity] ?? ""}`}
                      >
                        {f.severity}
                      </span>
                      <span className="text-zinc-600 dark:text-zinc-400">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{f.description}.</span>{" "}
                        {f.detail}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        {!!report?.others.length && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              No comparable quote
            </h2>
            <div className="space-y-3">
              {report.others.map((e) => (
                <div
                  key={e.call_id}
                  className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <span className="font-medium">{e.consultancy_name}</span>
                  <span className="ml-2 text-xs text-zinc-400">call #{e.call_id}</span>
                  <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-800">
                    {(e.outcome ?? "in progress").replace("_", " ")}
                  </span>
                  {e.outcome_detail && <p className="mt-1 text-zinc-500">“{e.outcome_detail}”</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {report && !report.ranked.length && !report.others.length && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            No calls yet — run them from the live board first.
          </div>
        )}
      </main>
    </div>
  );
}
