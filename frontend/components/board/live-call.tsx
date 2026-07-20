"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  PhoneCall,
  Signal,
  ShieldAlert,
  TrendingDown,
  Gauge,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { type Call, type Currency, ITEM_LABELS, effectiveRows } from "@/lib/api";
import {
  STAGES,
  deriveStage,
  confidence,
  callSavings,
  buildTranscript,
  elapsedSeconds,
  formatDuration,
} from "@/lib/board";
import { money, titleize, formatTime } from "@/lib/utils";
import { Badge, LiveBadge } from "@/components/ui/badge";
import { AgentOrb } from "./agent-orb";
import { Waveform, type VoiceState } from "./waveform";
import { Transcript } from "./transcript";
import { QuoteList } from "./quote-list";

export function LiveCall({ call, currency }: { call: Call; currency?: Currency }) {
  const live = !call.outcome;
  const [now, setNow] = useState(() => Date.now());
  const [voice, setVoice] = useState<VoiceState>("listening");

  // tick the clock + alternate speaking/listening while live
  useEffect(() => {
    if (!live) return;
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const talk = setInterval(
      () => setVoice((v) => (v === "speaking" ? "listening" : "speaking")),
      2600,
    );
    return () => {
      clearInterval(clock);
      clearInterval(talk);
    };
  }, [live]);

  const elapsed = elapsedSeconds(call.started_at, now);
  const stage = deriveStage(call, elapsed);
  const conf = confidence(call);
  const savings = callSavings(call.quotes);
  const rows = effectiveRows(call.quotes);
  const latest = call.quotes[call.quotes.length - 1];
  const sym = currency?.symbol ?? "£";
  const transcript = buildTranscript(call, sym);
  const voiceState: VoiceState = live ? voice : "idle";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-border bg-surface"
    >
      {/* top status bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3">
            <PhoneCall className="h-4 w-4 text-brand" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">{call.consultancy_name}</p>
            <p className="text-xs text-muted-2">Call #{call.id}</p>
          </div>
        </div>
        {call.persona_id && <Badge tone="violet">{call.persona_id.replace(/_/g, " ")}</Badge>}
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Signal className={live ? "h-3.5 w-3.5 text-success" : "h-3.5 w-3.5 text-muted-2"} />
            {live ? "Connected" : "Ended"}
          </span>
          <span className="tabular-nums text-sm font-medium">
            {live ? formatDuration(elapsed) : formatTime(call.started_at)}
          </span>
          {live ? (
            <LiveBadge />
          ) : (
            <Badge tone={call.outcome === "quote" ? "success" : call.outcome === "callback_commitment" ? "info" : "neutral"}>
              {titleize(call.outcome!)}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-[1.1fr_1fr]">
        {/* left: voice + stats */}
        <div className="space-y-5">
          <div className="flex flex-col items-center rounded-xl border border-border bg-surface-2/50 py-6">
            <AgentOrb state={voiceState} done={!live} />
            <p className="mt-4 text-sm font-medium">
              {!live
                ? "Call complete"
                : voice === "speaking"
                  ? "Agent speaking…"
                  : "Listening…"}
            </p>
            <Waveform state={voiceState} className="mt-2 w-full max-w-xs" color={live ? "brand" : "success"} />
          </div>

          {/* stage timeline */}
          <StageTimeline activeIndex={stage.index} outcome={call.outcome} />

          {/* stat tiles */}
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              icon={Wallet}
              label={latest ? `Current: ${ITEM_LABELS[latest.item] ?? latest.item}` : "Current fee"}
              value={latest ? money(latest.amount, sym) : "—"}
            />
            <StatTile
              icon={TrendingDown}
              label="Negotiated savings"
              value={savings > 0 ? `−${money(savings, sym)}` : money(0, sym)}
              tone={savings > 0 ? "success" : "muted"}
            />
            <StatTile
              icon={ShieldAlert}
              label="Red flags"
              value={String(call.red_flags.length)}
              tone={call.red_flags.length ? "danger" : "muted"}
            />
            <ConfidenceTile value={conf} />
          </div>

          {call.red_flags.length > 0 && (
            <div className="space-y-2">
              {call.red_flags.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft/50 p-2.5 text-xs"
                >
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                  <span>
                    <span className="font-medium text-foreground">{f.description}.</span>{" "}
                    <span className="text-muted">{f.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {rows.length > 0 && (
            <div className="rounded-xl border border-border bg-surface-2/40 p-4">
              <QuoteList quotes={call.quotes} currency={currency} />
            </div>
          )}

          {call.outcome_detail && (
            <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">“{call.outcome_detail}”</p>
          )}
        </div>

        {/* right: transcript */}
        <div className="min-h-[420px] rounded-xl border border-border bg-surface-2/40 p-4">
          <Transcript lines={transcript} live={live} />
        </div>
      </div>

      {!live && call.outcome === "quote" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center gap-2 border-t border-border bg-success/10 py-2.5 text-sm font-medium text-success"
        >
          <CheckCircle2 className="h-4 w-4" />
          Structured quote captured
        </motion.div>
      )}
    </motion.div>
  );
}

function StageTimeline({ activeIndex, outcome }: { activeIndex: number; outcome: string | null }) {
  return (
    <div className="flex items-center justify-between gap-1">
      {STAGES.map((s, i) => {
        const done = i < activeIndex || (outcome && i <= activeIndex);
        const active = i === activeIndex && !outcome;
        return (
          <div key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <span
                className={`h-1 flex-1 rounded-full ${i === 0 ? "opacity-0" : done || active ? "bg-brand" : "bg-surface-3"}`}
              />
              <motion.span
                className={`mx-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  done ? "bg-brand" : active ? "bg-brand" : "bg-surface-3"
                }`}
                animate={active ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                transition={{ duration: 1.2, repeat: active ? Infinity : 0 }}
              />
              <span
                className={`h-1 flex-1 rounded-full ${i === STAGES.length - 1 ? "opacity-0" : done ? "bg-brand" : "bg-surface-3"}`}
              />
            </div>
            <span
              className={`text-center text-[10px] leading-tight ${active || done ? "text-foreground" : "text-muted-2"}`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
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
    <div className="rounded-xl border border-border bg-surface-2/50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-2">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <p className={`text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function ConfidenceTile({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-2">
        <Gauge className="h-3.5 w-3.5" />
        Confidence
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <motion.div
            className="h-full brand-gradient"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <span className="text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}
