"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setReport(await apiFetch<Report>("/api/report"));
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cur = report?.currency;
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
  );
}
