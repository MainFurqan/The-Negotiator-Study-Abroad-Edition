"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PhoneOutgoing,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  Loader2,
  FlaskConical,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
  Building2,
} from "lucide-react";
import { apiFetch, type Agency, type AgenciesResponse, type Call } from "@/lib/api";
import { sleep } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Client-side call lifecycle. dialing→ringing→forwarded→connected is a
 *  presentational connect animation; "declined" covers no-answer / hang-up /
 *  failed dial. Real quote/red-flag data is driven by the board's polling. */
type Phase = "idle" | "dialing" | "ringing" | "forwarded" | "connected" | "declined";

const CONNECT_STEPS: { id: Phase; label: string; icon: any }[] = [
  { id: "dialing", label: "Dialing", icon: PhoneOutgoing },
  { id: "ringing", label: "Ringing", icon: PhoneCall },
  { id: "forwarded", label: "Call forwarded", icon: PhoneForwarded },
  { id: "connected", label: "Connected", icon: PhoneCall },
];
const CONNECTING: Phase[] = ["dialing", "ringing", "forwarded"];

export function AgencyCaller({
  openCall,
  onStarted,
}: {
  openCall: Call | null;
  onStarted: () => void;
}) {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agencyId, setAgencyId] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const animating = useRef(false);

  useEffect(() => {
    apiFetch<AgenciesResponse>("/api/agencies")
      .then((d) => {
        setAgencies(d.agencies);
        if (d.agencies[0]) setAgencyId((prev) => prev || d.agencies[0].id);
      })
      .catch(() => {});
  }, []);

  // Reconcile the phase with real backend state: adopt an already-open call as
  // "connected" (e.g. after a page refresh), and reset when a call ends.
  useEffect(() => {
    if (animating.current) return;
    if (openCall && (phase === "idle" || phase === "declined")) setPhase("connected");
    if (!openCall && (phase === "connected" || phase === "declined")) setPhase("idle");
  }, [openCall, phase]);

  const selected =
    agencies.find((a) => a.id === (openCall ? undefined : agencyId)) ??
    agencies.find((a) => a.id === agencyId) ??
    null;
  // While a call is open we show its identity even though the picker is hidden.
  const activeAgency =
    openCall && agencies.length
      ? agencies.find((a) => a.display_name === openCall.consultancy_name) ?? selected
      : selected;

  const createCall = useCallback(
    async (body: Record<string, any>) => {
      try {
        return await apiFetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        const msg = String(e);
        // Missing dialing env → fall back to a simulated dry-run so the demo
        // never hard-crashes (Change 5 requirement).
        if (!body.dry_run && /cannot dial/i.test(msg)) {
          setFallback("Dialing isn’t configured — running a simulated (dry-run) call instead.");
          return await apiFetch("/api/calls", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, dry_run: true }),
          });
        }
        throw e;
      }
    },
    [],
  );

  async function startCall() {
    if (!agencyId) return;
    setError(null);
    setFallback(null);
    setBusy(true);
    animating.current = true;
    setPhase("dialing");
    try {
      await createCall({ agency_id: agencyId, dry_run: dryRun });
      onStarted();
      await sleep(900);
      setPhase("ringing");
      await sleep(1600);
      setPhase("forwarded");
      await sleep(1100);
      setPhase("connected");
    } catch (e) {
      setPhase("declined");
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      animating.current = false;
      setBusy(false);
    }
  }

  async function hangUp(reason: string, declined = false) {
    setBusy(true);
    try {
      if (openCall) {
        await apiFetch(`/api/calls/${openCall.id}/cancel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        onStarted();
      }
    } catch {
      /* ignore — the poll will reconcile */
    } finally {
      animating.current = false;
      setBusy(false);
      setPhase(declined ? "declined" : "idle");
      if (!declined) setFallback(null);
    }
  }

  // ---- launcher (idle) -----------------------------------------------------
  if (phase === "idle") {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <PhoneOutgoing className="h-4 w-4 text-brand" />
          <h2 className="font-semibold">Call a consultancy</h2>
          <span className="ml-2 text-xs text-muted-2">Pick an agency — the AI agent makes the call</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            className="sm:max-w-sm"
          >
            {agencies.length === 0 && <option value="">Loading agencies…</option>}
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.display_name}
              </option>
            ))}
          </Select>

          <label className="flex items-center gap-2 text-sm text-muted">
            <button
              type="button"
              role="switch"
              aria-checked={dryRun}
              onClick={() => setDryRun((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${dryRun ? "bg-brand" : "bg-surface-3"}`}
            >
              <motion.span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
                animate={{ left: dryRun ? 18 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <FlaskConical className="h-3.5 w-3.5" />
            Dry run
          </label>

          <Button
            onClick={startCall}
            loading={busy}
            disabled={!agencyId}
            variant={dryRun ? "brand" : "success"}
            className="sm:ml-auto"
          >
            <PhoneCall className="h-4 w-4" />
            {dryRun ? "Start simulated call" : "Call now"}
          </Button>
        </div>

        {selected && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-3">
            <AgencyAvatar agency={selected} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{selected.display_name}</p>
              {selected.tagline && <p className="truncate text-xs text-muted-2">{selected.tagline}</p>}
            </div>
          </div>
        )}

        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          For safety every real call always rings your own verified number — never a real consultancy.
          Dry run exercises the agent in text mode without spending voice minutes.
        </p>

        <AnimatePresence>
          {error && (
            <ErrorNote key="err">{error}</ErrorNote>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ---- live lifecycle (dialing … connected / declined) ---------------------
  const stepIndex = CONNECT_STEPS.findIndex((s) => s.id === phase);
  const declined = phase === "declined";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/60 px-5 py-4">
        {activeAgency ? (
          <AgencyAvatar agency={activeAgency} ringing={CONNECTING.includes(phase)} />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3">
            <Building2 className="h-5 w-5 text-muted" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {activeAgency?.display_name ?? openCall?.consultancy_name ?? "Consultancy"}
          </p>
          <p className="truncate text-xs text-muted-2">
            {activeAgency?.tagline ?? "UK study-abroad consultancy"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dryRun && <Badge tone="brand"><FlaskConical className="h-3 w-3" /> Simulated</Badge>}
          {declined ? (
            <Badge tone="neutral"><PhoneOff className="h-3 w-3" /> Not connected</Badge>
          ) : phase === "connected" ? (
            <Badge tone="success"><PhoneCall className="h-3 w-3" /> Connected</Badge>
          ) : (
            <Badge tone="warning"><Loader2 className="h-3 w-3 animate-spin" /> {labelFor(phase)}</Badge>
          )}
        </div>
      </div>

      <div className="p-5">
        {declined ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-3">
              <PhoneOff className="h-6 w-6 text-muted" />
            </span>
            <div>
              <p className="font-medium">Call not connected</p>
              <p className="mt-1 text-sm text-muted">
                {error ?? "The call wasn’t answered. You can try another agency."}
              </p>
            </div>
            <Button onClick={() => { setPhase("idle"); setError(null); }} variant="outline">
              <RotateCcw className="h-4 w-4" /> Try another agency
            </Button>
          </div>
        ) : (
          <>
            {/* connect progress rail */}
            <div className="flex items-center justify-between gap-1">
              {CONNECT_STEPS.map((s, i) => {
                const done = i < stepIndex;
                const active = i === stepIndex;
                const Icon = s.icon;
                return (
                  <div key={s.id} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex w-full items-center">
                      <span className={`h-0.5 flex-1 rounded-full ${i === 0 ? "opacity-0" : done || active ? "bg-brand" : "bg-surface-3"}`} />
                      <motion.span
                        className={`mx-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                          done || active ? "border-brand/40 bg-brand/15 text-brand" : "border-border bg-surface-2 text-muted-2"
                        }`}
                        animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                        transition={{ duration: 1.1, repeat: active ? Infinity : 0 }}
                      >
                        <Icon className="h-4 w-4" />
                      </motion.span>
                      <span className={`h-0.5 flex-1 rounded-full ${i === CONNECT_STEPS.length - 1 ? "opacity-0" : done ? "bg-brand" : "bg-surface-3"}`} />
                    </div>
                    <span className={`text-center text-[11px] leading-tight ${done || active ? "text-foreground" : "text-muted-2"}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {fallback && (
              <p className="mt-4 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-soft/40 p-2.5 text-xs text-warning">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {fallback}
              </p>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {phase === "connected"
                  ? "Connected — the agent is negotiating. Fees and red flags appear live below."
                  : "Placing the call to your verified number…"}
              </p>
              <Button
                onClick={() => hangUp(phase === "connected" ? "ended from dashboard" : "no answer", phase !== "connected")}
                variant="outline"
                size="sm"
                loading={busy}
              >
                <PhoneOff className="h-4 w-4" />
                {phase === "connected" ? "Hang up" : "Cancel"}
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

function labelFor(phase: Phase): string {
  return CONNECT_STEPS.find((s) => s.id === phase)?.label ?? "Connecting";
}

function AgencyAvatar({ agency, ringing = false }: { agency: Agency; ringing?: boolean }) {
  const accent = agency.accent ?? "#6366f1";
  return (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
      {ringing && (
        <span
          className="absolute inline-flex h-full w-full animate-ping rounded-xl opacity-40"
          style={{ backgroundColor: accent }}
        />
      )}
      <span
        className="relative flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}bb)` }}
      >
        {agency.initials ?? agency.display_name.slice(0, 2).toUpperCase()}
      </span>
    </span>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mt-3 flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft/60 p-2.5 text-sm text-danger"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {children}
    </motion.p>
  );
}
