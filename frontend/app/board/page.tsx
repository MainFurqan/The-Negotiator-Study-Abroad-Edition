"use client";

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Quote = {
  item: string;
  amount: number;
  currency: string;
  university: string | null;
  is_revised: number;
  revised_from: number | null;
  note: string | null;
  logged_at: string;
};

type Call = {
  id: number;
  consultancy_name: string;
  phone: string | null;
  persona_id: string | null;
  conversation_id: string | null;
  started_at: string;
  outcome: string | null;
  outcome_detail: string | null;
  quotes: Quote[];
};

type Board = {
  currency: { symbol: string; quote_currency: string; secondary: string; rate: number };
  quote_items: string[];
  calls: Call[];
};

type Callsheet = {
  personas: { id: string; name: string }[];
  call_list: { name: string; city: string | null; phone: string | null }[];
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

const OUTCOME_STYLES: Record<string, string> = {
  quote: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  callback_commitment: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  documented_decline: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

/** Latest figure wins per line item — revisions supersede the original row.
 * Mirrors backend effective_rows(): 'other' items are distinguished by note
 * (a courier charge must not swallow a file-opening charge); a revision to an
 * 'other' item replaces the row whose amount it revises_from. */
function effectiveRows(quotes: Quote[]): Quote[] {
  const collapsed = new Map<string, Quote>();
  for (const q of quotes) {
    let key = `${q.item}|${q.university ?? ""}`;
    if (q.item === "other" && !q.is_revised) {
      key += `|${q.note ?? ""}`;
    } else if (q.item === "other") {
      const match = [...collapsed.entries()].find(
        ([k, v]) => k.startsWith(key + "|") && v.amount === q.revised_from
      );
      key = match ? match[0] : `${key}|${q.note ?? ""}`;
    }
    collapsed.set(key, q);
  }
  return [...collapsed.values()];
}

export default function BoardPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [sheet, setSheet] = useState<Callsheet | null>(null);
  const [target, setTarget] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/calls`);
      setBoard(await r.json());
    } catch {
      /* backend not up yet — keep polling */
    }
  }, []);

  useEffect(() => {
    refresh();
    fetch(`${API}/api/callsheet`)
      .then((r) => r.json())
      .then(setSheet)
      .catch(() => {});
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  async function startCall() {
    if (!target || !sheet) return;
    const [kind, key] = target.split(":", 2);
    const body: Record<string, any> = { dry_run: dryRun };
    if (kind === "persona") {
      const p = sheet.personas.find((p) => p.id === key)!;
      body.persona_id = p.id;
      body.consultancy_name = p.name.split("—").pop()!.trim();
    } else {
      const e = sheet.call_list[Number(key)];
      body.consultancy_name = e.name;
      body.phone = e.phone;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) setError(String(data?.detail ?? r.statusText));
      else await refresh();
    } catch (e) {
      setError(`Backend unreachable at ${API} (${e})`);
    } finally {
      setBusy(false);
    }
  }

  const cur = board?.currency;
  const money = (n: number) => `${cur?.symbol ?? "£"}${n.toLocaleString()}`;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Live quote board</h1>
            <p className="text-sm text-zinc-500">
              Rows appear as the Caller logs figures mid-call.{" "}
              <a href="/" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
                ← Student profile
              </a>{" "}
              <a href="/report" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
                Ranked report →
              </a>
            </p>
          </div>
        </header>

        <section className="mb-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Start a call
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="min-w-64 rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
            >
              <option value="">— pick a counterparty —</option>
              <optgroup label="Personas (simulated)">
                {sheet?.personas.map((p) => (
                  <option key={p.id} value={`persona:${p.id}`}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Call list (real, dials YOUR verified number)">
                {sheet?.call_list.map((e, i) => (
                  <option key={i} value={`entry:${i}`}>
                    {e.name} {e.city ? `(${e.city})` : ""}
                  </option>
                ))}
              </optgroup>
            </select>
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              dry run (text-mode test, no dial)
            </label>
            <button
              onClick={startCall}
              disabled={busy || !target}
              className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
            >
              {busy ? "Starting…" : dryRun ? "Open dry-run call" : "Dial"}
            </button>
          </div>
          {error && (
            <p className="mt-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}
        </section>

        {!board?.calls.length && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            No calls yet. Freeze a profile, then start a call above.
          </div>
        )}

        <div className="space-y-6">
          {board?.calls.map((call) => {
            const rows = effectiveRows(call.quotes);
            const consultancyTotal = rows
              .filter((q) => q.item !== "deposit")
              .reduce((s, q) => s + q.amount, 0);
            return (
              <section
                key={call.id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{call.consultancy_name}</h2>
                  {call.persona_id && (
                    <span className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                      persona: {call.persona_id}
                    </span>
                  )}
                  <span className="text-xs text-zinc-400">call #{call.id}</span>
                  <span className="ml-auto">
                    {call.outcome ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${OUTCOME_STYLES[call.outcome] ?? ""}`}
                      >
                        {call.outcome.replace("_", " ")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        LIVE
                      </span>
                    )}
                  </span>
                </div>

                {call.outcome_detail && (
                  <p className="mb-3 text-sm text-zinc-500">“{call.outcome_detail}”</p>
                )}

                {rows.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                        <th className="py-1.5 pr-2 font-medium">Item</th>
                        <th className="py-1.5 pr-2 font-medium">University / note</th>
                        <th className="py-1.5 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((q, i) => (
                        <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                          <td className="py-1.5 pr-2">{ITEM_LABELS[q.item] ?? q.item}</td>
                          <td className="py-1.5 pr-2 text-zinc-500">
                            {[q.university, q.note].filter(Boolean).join(" — ") || "—"}
                          </td>
                          <td className="py-1.5 text-right font-medium tabular-nums">
                            {!!q.is_revised && q.revised_from != null && (
                              <span className="mr-2 text-zinc-400 line-through">
                                {money(q.revised_from)}
                              </span>
                            )}
                            <span className={q.is_revised ? "text-emerald-600 dark:text-emerald-400" : ""}>
                              {money(q.amount)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="pt-2 font-medium" colSpan={2}>
                          Consultancy charges (excl. deposits)
                        </td>
                        <td className="pt-2 text-right font-semibold tabular-nums">
                          {money(consultancyTotal)}
                          {cur && (
                            <span className="ml-2 font-normal text-zinc-400">
                              ≈ {cur.secondary} {(consultancyTotal * cur.rate).toLocaleString()}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-zinc-400">No figures logged yet…</p>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
