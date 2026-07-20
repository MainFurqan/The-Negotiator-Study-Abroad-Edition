"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, PhoneOff, BarChart3, RefreshCw, Radio } from "lucide-react";
import { apiFetch, type Board, type Call } from "@/lib/api";
import { titleize } from "@/lib/utils";
import { callSavings } from "@/lib/board";
import { money } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/shell/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AgencyCaller } from "@/components/board/agency-caller";
import { LiveCall } from "@/components/board/live-call";
import { QuoteList } from "@/components/board/quote-list";

export default function BoardPage() {
  const [board, setBoard] = useState<Board | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<Board>("/api/calls");
      // Be resilient to older backends that don't return these arrays.
      data.calls = data.calls.map((c) => ({
        ...c,
        quotes: c.quotes ?? [],
        red_flags: c.red_flags ?? [],
      }));
      setBoard(data);
    } catch {
      /* backend not up yet — keep polling */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  const calls = board?.calls ?? [];
  const openCall = calls.find((c) => !c.outcome) ?? null;
  const hero = openCall ?? calls[0] ?? null;
  const history = calls.filter((c) => c.id !== hero?.id);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Step 2 · Live negotiation"
        title="AI caller"
        subtitle="Watch the agent itemise fees and negotiate in real time. Rows and red flags appear as the call progresses."
        actions={
          <div className="flex items-center gap-2">
            {board?.currency && (
              <Badge tone={board.currency.rate_live ? "success" : "warning"}>
                <Radio className="h-3 w-3" />
                1 {board.currency.quote_currency} = {board.currency.rate} {board.currency.secondary}
              </Badge>
            )}
            <Link href="/report">
              <Button variant="outline" size="sm">
                <BarChart3 className="h-4 w-4" />
                Report
              </Button>
            </Link>
          </div>
        }
      />

      <div className="space-y-6">
        <AgencyCaller openCall={openCall} onStarted={refresh} />

        {!calls.length && (
          <Card className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-3">
              <PhoneOff className="h-5 w-5 text-muted-2" />
            </div>
            <p className="text-sm text-muted">No calls yet. Freeze a profile, then start a call above.</p>
          </Card>
        )}

        <AnimatePresence mode="popLayout">
          {hero && <LiveCall key={hero.id} call={hero} currency={board?.currency} />}
        </AnimatePresence>

        {history.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-2">Call history</h2>
              <span className="text-xs text-muted-2">({history.length})</span>
              <button onClick={refresh} className="ml-auto text-muted-2 transition-colors hover:text-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {history.map((call) => (
                <HistoryItem key={call.id} call={call} currency={board?.currency} />
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function HistoryItem({ call, currency }: { call: Call; currency?: Board["currency"] }) {
  const [open, setOpen] = useState(false);
  const savings = callSavings(call.quotes);
  const sym = currency?.symbol ?? "£";
  const tone: "success" | "info" | "neutral" =
    call.outcome === "quote" ? "success" : call.outcome === "callback_commitment" ? "info" : "neutral";

  return (
    <Card hover className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="font-medium">{call.consultancy_name}</span>
        {call.persona_id && <Badge tone="violet">{call.persona_id.replace(/_/g, " ")}</Badge>}
        <span className="text-xs text-muted-2">#{call.id}</span>
        {savings > 0 && (
          <Badge tone="success" className="ml-1">
            −{money(savings, sym)}
          </Badge>
        )}
        {call.red_flags.length > 0 && <Badge tone="danger">{call.red_flags.length} flag{call.red_flags.length > 1 ? "s" : ""}</Badge>}
        <span className="ml-auto flex items-center gap-2">
          <Badge tone={tone}>{titleize(call.outcome ?? "open")}</Badge>
          <ChevronDown className={`h-4 w-4 text-muted-2 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border"
          >
            <div className="space-y-3 p-4">
              {call.outcome_detail && (
                <p className="rounded-lg bg-surface-2 p-2.5 text-sm text-muted">“{call.outcome_detail}”</p>
              )}
              <QuoteList quotes={call.quotes} currency={currency} />
              {call.red_flags.map((f, i) => (
                <p key={i} className="text-xs text-muted">
                  <span className="font-medium text-danger">{f.severity}</span> · {f.description}. {f.detail}
                </p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
