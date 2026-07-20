"use client";

<<<<<<< HEAD
import { useCallback, useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Profile = Record<string, any>;

const DOC_TYPES = ["transcript", "ielts_trf", "bank_statement", "existing_quote", "other"];
const LEVELS = ["matric", "intermediate", "a_levels", "bachelors", "other"];
const TEST_STATUS = ["not_taken", "booked", "taken"];
const TEST_TYPES = ["ielts_academic", "ielts_ukvi", "pte_academic", "other"];

function get(obj: Profile | null, path: string): any {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj as any);
}

function setPath(obj: Profile, path: string, value: any): Profile {
  const next = structuredClone(obj);
  const keys = path.split(".");
  let cur: any = next;
  for (const k of keys.slice(0, -1)) cur = cur[k] ?? (cur[k] = {});
  cur[keys[keys.length - 1]] = value;
  return next;
}

type FieldSpec = {
  label: string;
  path: string;
  kind?: "text" | "number" | "select" | "textarea" | "list";
  options?: string[];
};

const SECTIONS: { title: string; fields: FieldSpec[] }[] = [
  {
    title: "Student",
    fields: [
      { label: "Full name", path: "full_name" },
      { label: "Home city", path: "home_city" },
    ],
  },
  {
    title: "Last qualification",
    fields: [
      { label: "Level", path: "last_qualification.level", kind: "select", options: LEVELS },
      { label: "Grades", path: "last_qualification.grades" },
      { label: "Year completed", path: "last_qualification.year_completed", kind: "number" },
      { label: "Institution", path: "last_qualification.institution" },
    ],
  },
  {
    title: "English test",
    fields: [
      { label: "Status", path: "english_test.status", kind: "select", options: TEST_STATUS },
      { label: "Test type", path: "english_test.test_type", kind: "select", options: TEST_TYPES },
      { label: "Overall score", path: "english_test.overall_score", kind: "number" },
      { label: "Test date", path: "english_test.test_date" },
    ],
  },
  {
    title: "Target",
    fields: [
      { label: "Country", path: "target.country" },
      { label: "Course", path: "target.course" },
      { label: "Intake", path: "target.intake" },
      { label: "Preferred universities", path: "target.preferred_universities", kind: "list" },
    ],
  },
  {
    title: "Budget",
    fields: [
      { label: "Ceiling / year", path: "budget.ceiling_per_year", kind: "number" },
      { label: "Currency", path: "budget.currency" },
      { label: "Sponsor", path: "budget.sponsor" },
      { label: "Bank statement capacity (PKR)", path: "budget.bank_statement_capacity_pkr", kind: "number" },
    ],
  },
  {
    title: "Notes",
    fields: [{ label: "Notes", path: "notes", kind: "textarea" }],
  },
];

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [draft, setDraft] = useState<Profile | null>(null); // non-null = editing
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = draft !== null;

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/profile`);
      const data = await r.json();
      setProfile(data.profile);
      setFrozen(Boolean(data.confirmed));
    } catch {
      /* backend not up yet — keep polling */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (!editing) refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [refresh, editing]);

  async function call(label: string, path: string, init?: RequestInit) {
    setBusy(label);
    setErrors([]);
    try {
      const r = await fetch(`${API}${path}`, init);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const detail = data?.detail;
        setErrors(Array.isArray(detail?.errors) ? detail.errors : [String(detail ?? r.statusText)]);
        return false;
      }
      await refresh();
      return true;
    } catch (e) {
      setErrors([`Backend unreachable at ${API} — is uvicorn running? (${e})`]);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit() {
    if (!draft) return;
    const ok = await call("save", "/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (ok) setDraft(null);
  }

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErrors(["Choose a file first."]);
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("doc_type", docType);
    const ok = await call("upload", "/api/intake/document", { method: "POST", body: form });
    if (ok && fileRef.current) fileRef.current.value = "";
  }

  const shown = editing ? draft : profile;
  const docs: Profile[] = get(shown, "documents_provided") ?? [];

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">The Negotiator</h1>
            <p className="text-sm text-zinc-500">
              Student profile — review, complete, then freeze.{" "}
              <a href="/board" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
                Live quote board →
              </a>
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              frozen
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          >
            {frozen ? `Frozen ${get(profile, "frozen_at") ?? ""}` : "Draft"}
          </span>
        </header>

        {frozen && (
          <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            This profile is confirmed and locked. It will be injected verbatim into every outbound
            call — no further edits.
          </div>
        )}

        {!profile && (
          <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
            No profile yet. Start an Estimator interview (voice/text) or upload a document below —
            fields fill in here live.
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            <p className="mb-1 font-medium">Not so fast:</p>
            <ul className="list-inside list-disc">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <section
              key={section.title}
              className={`rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 ${
                section.title === "Notes" ? "sm:col-span-2" : ""
              }`}
            >
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                {section.title}
              </h2>
              <dl className="space-y-2">
                {section.fields.map((f) => {
                  const value = get(shown, f.path);
                  return (
                    <div key={f.path} className="flex items-baseline justify-between gap-4">
                      <dt className="shrink-0 text-sm text-zinc-500">{f.label}</dt>
                      <dd className="min-w-0 grow text-right text-sm font-medium">
                        {editing ? (
                          <Editor field={f} value={value} onChange={(v) => setDraft(setPath(draft!, f.path, v))} />
                        ) : f.kind === "list" ? (
                          (value ?? []).join(", ") || <Missing />
                        ) : (
                          value ?? <Missing />
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}

          <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:col-span-2">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Documents
            </h2>
            {docs.length > 0 ? (
              <ul className="mb-3 space-y-1 text-sm">
                {docs.map((d, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{d.type}</span>
                    <span>{d.filename ?? "—"}</span>
                    <span className={d.parsed_ok ? "text-emerald-600" : "text-amber-600"}>
                      {d.parsed_ok ? "parsed" : "not parsed"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3 text-sm text-zinc-500">None uploaded yet.</p>
            )}
            {!frozen && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-zinc-800"
                />
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={upload}
                  disabled={busy !== null}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
                >
                  {busy === "upload" ? "Parsing…" : "Upload & parse"}
                </button>
              </div>
            )}
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center gap-3">
          {!frozen && !editing && (
            <>
              <button
                onClick={() => call("confirm", "/api/profile/confirm", { method: "POST" })}
                disabled={busy !== null || !profile}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy === "confirm" ? "Freezing…" : "Confirm & freeze profile"}
              </button>
              <button
                onClick={() => setDraft(structuredClone(profile ?? {}))}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Edit manually
              </button>
            </>
          )}
          {editing && (
            <>
              <button
                onClick={saveEdit}
                disabled={busy !== null}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-black"
              >
                {busy === "save" ? "Saving…" : "Save changes"}
              </button>
              <button
                onClick={() => {
                  setDraft(null);
                  setErrors([]);
                }}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                Cancel
              </button>
            </>
          )}
          <button
            onClick={() => {
              if (confirm("Start a fresh draft? The current profile stays in the DB for the record.")) {
                setDraft(null);
                call("reset", "/api/profile/reset", { method: "POST" });
              }
            }}
            className="ml-auto rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Reset draft
          </button>
        </footer>
      </main>
    </div>
  );
}

function Missing() {
  return <span className="font-normal text-zinc-300 dark:text-zinc-700">—</span>;
}

function Editor({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: any;
  onChange: (v: any) => void;
}) {
  const base =
    "w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm text-right dark:border-zinc-700";
  if (field.kind === "select")
    return (
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={base}>
        <option value="">—</option>
        {field.options!.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  if (field.kind === "textarea")
    return (
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        rows={3}
        className={`${base} text-left`}
      />
    );
  if (field.kind === "list")
    return (
      <input
        value={(value ?? []).join(", ")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        placeholder="comma-separated"
        className={base}
      />
    );
  return (
    <input
      type={field.kind === "number" ? "number" : "text"}
      value={value ?? ""}
      onChange={(e) =>
        onChange(
          field.kind === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value || null,
        )
      }
      className={base}
    />
  );
}
=======
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  PhoneCall,
  ShieldCheck,
  BarChart3,
  UserRound,
  Sparkles,
  Scale,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STEPS = [
  {
    icon: UserRound,
    title: "1 · Profile intake",
    body: "Voice interview or document upload builds one verified student profile. Nothing is invented — grades, funds and scores come only from what the student provides.",
  },
  {
    icon: PhoneCall,
    title: "2 · AI negotiation calls",
    body: "The agent calls consultancies, itemises every fee live, and negotiates down using real cross-quote leverage pulled from the database — never fabricated offers.",
  },
  {
    icon: BarChart3,
    title: "3 · Ranked report",
    body: "A deterministic GBP + PKR comparison ranks every consultancy, annotates red flags against published benchmarks, and recommends the best-value option.",
  },
];

const FEATURES = [
  { icon: ShieldCheck, title: "Honesty-constrained", body: "Leverage comes only from logged quotes. Every call ends in a structured outcome." },
  { icon: Scale, title: "Benchmark red flags", body: "Padded deposits and below-floor totals flagged against verified official figures." },
  { icon: Sparkles, title: "Config-driven", body: "The whole vertical is one JSON file — swap UK Law for any market without code." },
  { icon: FileCheck2, title: "Auditable", body: "Every figure carries its call id, timestamp and recording link. No LLM guesses." },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
        <div className="absolute right-[8%] top-[20%] h-[300px] w-[300px] rounded-full bg-brand-2/20 blur-[110px]" />
      </div>

      <section className="mx-auto max-w-6xl px-5 pt-20 pb-16 text-center sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-1.5 text-xs font-medium text-muted"
        >
          <span className="flex h-1.5 w-1.5 rounded-full bg-success" />
          ElevenLabs Agents · FastAPI · Live voice negotiation
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mx-auto max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-6xl"
        >
          <span className="text-gradient">Study-abroad fees,</span>
          <br />
          negotiated down by an AI agent.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted"
        >
          The Negotiator calls UK consultancies on behalf of Pakistani students, itemises every fee,
          and drives prices down with real cross-quote leverage — then hands you a ranked
          GBP&nbsp;+&nbsp;PKR report.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/intake">
            <Button size="lg" className="group">
              Start student intake
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* How it works */}
      <motion.section
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto max-w-6xl px-5 pb-8"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.title} variants={item}>
                <Card hover className="h-full p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-2">
                    <Icon className="h-5 w-5 text-brand" />
                  </div>
                  <h3 className="mb-2 font-semibold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{s.body}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Feature strip */}
      <motion.section
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto max-w-6xl px-5 pb-24 pt-8"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.title} variants={item}>
                <Card className="h-full p-5">
                  <Icon className="mb-3 h-5 w-5 text-brand-2" />
                  <h4 className="mb-1.5 text-sm font-semibold">{f.title}</h4>
                  <p className="text-xs leading-relaxed text-muted">{f.body}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}
>>>>>>> 7bd7dbf (improvements by Meer)
