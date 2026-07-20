"use client";

import { useCallback, useEffect, useState } from "react";
<<<<<<< HEAD

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
=======
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Download,
  Printer,
  RefreshCw,
  PhoneCall,
  Building2,
  Trophy,
  TrendingDown,
  ShieldAlert,
  Radio,
  Sparkles,
} from "lucide-react";
import { API, apiFetch, type Report } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountUp, Skeleton } from "@/components/ui/count-up";
import { ComparisonChart, FeeCompositionChart } from "@/components/report/charts";
import { ConsultantCard } from "@/components/report/consultant-card";
import { AgenciesContacted } from "@/components/report/agencies-contacted";
import { titleize } from "@/lib/utils";

type Mode = "GBP" | "PKR";

export default function ReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [mode, setMode] = useState<Mode>("GBP");
>>>>>>> 7bd7dbf (improvements by Meer)
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
<<<<<<< HEAD
      const r = await fetch(`${API}/api/report`);
      setReport(await r.json());
      setError(null);
    } catch (e) {
      setError(`Backend unreachable at ${API} (${e})`);
=======
      setReport(await apiFetch<Report>("/api/report"));
      setError(null);
    } catch (e) {
      setError(String(e));
>>>>>>> 7bd7dbf (improvements by Meer)
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cur = report?.currency;
<<<<<<< HEAD
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
=======
  const ranked = report?.ranked ?? [];
  const winner = ranked[0];
  const totalSavings = ranked.reduce((s, e) => s + (e.savings ?? 0), 0);
  const totalFlags = ranked.reduce((s, e) => s + e.red_flags.length, 0) + (report?.others ?? []).reduce((s, e) => s + e.red_flags.length, 0);

  const toDisplay = (gbp: number) => (mode === "PKR" && cur ? gbp * cur.rate : gbp);
  const symbol = mode === "PKR" ? `${cur?.secondary ?? "PKR"} ` : cur?.symbol ?? "£";

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Step 3 · Deliverable"
        title="Ranked report"
        subtitle={report?.vertical ?? "Assembling the ranked comparison…"}
        actions={
          <div className="no-print flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              {(["GBP", "PKR"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`relative rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                    mode === m ? "text-brand-foreground" : "text-muted hover:text-foreground"
                  }`}
                >
                  {mode === m && (
                    <motion.span
                      layoutId="cur-toggle"
                      className="absolute inset-0 rounded-md brand-gradient"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative">{m}</span>
                </button>
              ))}
            </div>
            <a href={`${API}/api/report/pdf`} target="_blank" rel="noreferrer">
              <Button size="sm">
                <Download className="h-4 w-4" /> PDF
              </Button>
            </a>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button size="sm" variant="ghost" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {error && (
        <Card className="mb-6 border-danger/30 bg-danger-soft/40 p-4 text-sm text-danger">{error}</Card>
      )}

      {/* summary tiles */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Consultancies ranked"
          value={report ? <CountUp value={ranked.length} /> : <Skeleton className="h-7 w-10" />}
        />
        <StatCard
          icon={Trophy}
          tone="success"
          label={winner ? `Best value · ${winner.consultancy_name}` : "Best value"}
          value={
            winner ? (
              <CountUp value={toDisplay(winner.consultancy_total ?? 0)} prefix={symbol} />
            ) : (
              <span className="text-muted-2">—</span>
            )
          }
        />
        <StatCard
          icon={TrendingDown}
          tone="success"
          label="Total negotiated savings"
          value={
            report ? (
              <CountUp value={toDisplay(totalSavings)} prefix={(totalSavings > 0 ? "−" : "") + symbol} />
            ) : (
              <Skeleton className="h-7 w-24" />
            )
          }
        />
        <StatCard
          icon={ShieldAlert}
          tone={totalFlags ? "danger" : "muted"}
          label="Red flags detected"
          value={report ? <CountUp value={totalFlags} /> : <Skeleton className="h-7 w-8" />}
        />
      </div>

      {/* agencies contacted — side-by-side comparison */}
      {report && cur && <AgenciesContacted report={report} cur={cur} mode={mode} />}

      {/* recommendation */}
      {report && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="mb-6 overflow-hidden border-brand/30">
            <div className="flex items-start gap-3 bg-brand/5 p-5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/15">
                <Sparkles className="h-4 w-4 text-brand" />
              </span>
              <div>
                <SectionLabel className="mb-1 text-brand">Recommendation</SectionLabel>
                <p className="text-sm leading-relaxed">{report.recommendation}</p>
                {cur?.rate_note && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-2">
                    <Radio className="h-3 w-3" />1 {cur.quote_currency} = {cur.rate} {cur.secondary} ·{" "}
                    {cur.rate_live ? "live" : "cached/fallback"} ({cur.rate_source})
                  </p>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* charts */}
      {ranked.length > 0 && cur && (
        <div className="mb-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card className="p-5">
            <SectionLabel className="mb-4">Total consultancy charges ({mode})</SectionLabel>
            <ComparisonChart ranked={ranked} cur={cur} mode={mode} />
          </Card>
          {winner && (
            <Card className="p-5">
              <SectionLabel className="mb-2">Fee composition · {winner.consultancy_name}</SectionLabel>
              <FeeCompositionChart entry={winner} cur={cur} mode={mode} />
            </Card>
          )}
        </div>
      )}

      {/* ranked cards */}
      {ranked.length > 0 && cur && (
        <div className="mb-6 space-y-3">
          <SectionLabel>Ranked consultancies</SectionLabel>
          {ranked.map((e, i) => (
            <ConsultantCard key={e.call_id} entry={e} cur={cur} mode={mode} defaultOpen={i === 0} />
          ))}
        </div>
      )}

      {/* others */}
      {!!report?.others.length && (
        <div className="mb-6">
          <SectionLabel className="mb-3">Calls without a comparable quote</SectionLabel>
          <div className="space-y-2">
            {report.others.map((e) => (
              <Card key={e.call_id} className="flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="font-medium">{e.consultancy_name}</span>
                <span className="text-xs text-muted-2">#{e.call_id}</span>
                <Badge tone={e.outcome === "callback_commitment" ? "info" : "neutral"}>
                  {titleize(e.outcome ?? "in progress")}
                </Badge>
                {e.outcome_detail && <span className="text-muted">“{e.outcome_detail}”</span>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* empty state */}
      {report && !ranked.length && !report.others.length && (
        <Card className="p-10 text-center">
          <p className="mb-4 text-sm text-muted">No calls yet — run negotiations from the live board first.</p>
          <Link href="/board">
            <Button>
              <PhoneCall className="h-4 w-4" /> Go to the caller
            </Button>
          </Link>
        </Card>
      )}
    </PageContainer>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  tone?: "default" | "success" | "danger" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "muted"
          ? "text-muted"
          : "text-foreground";
  return (
    <Card hover className="p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-2">
        <Icon className="h-4 w-4" />
        <span className="truncate">{label}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${toneClass}`}>{value}</div>
    </Card>
>>>>>>> 7bd7dbf (improvements by Meer)
  );
}
