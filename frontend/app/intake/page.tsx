"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { API, apiFetch, type Profile, type ProfileSummary, type ProfilesResponse } from "@/lib/api";
import {
  STEPS,
  LEVELS,
  TEST_STATUS,
  TEST_TYPES,
  GENDERS,
  get,
  setPath,
  fieldErrors,
  overallProgress,
  titleizeMissing,
} from "@/lib/intake";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Stepper } from "@/components/intake/stepper";
import { DocUploader } from "@/components/intake/doc-uploader";
import { VoiceIndicator } from "@/components/intake/voice-indicator";
import { StudentPicker } from "@/components/intake/student-picker";
import { titleize } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

type View = "picker" | "editor";

export default function IntakePage() {
  const [server, setServer] = useState<Profile | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [draft, setDraft] = useState<Profile>({});
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmErrors, setConfirmErrors] = useState<string[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [view, setView] = useState<View>("editor");
  const [pickBusyId, setPickBusyId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const dirty = useRef(false);
  const initedView = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [profileData, listData] = await Promise.all([
        apiFetch<{ profile: Profile | null; confirmed?: boolean }>("/api/profile"),
        apiFetch<ProfilesResponse>("/api/profiles").catch(() => ({ profiles: [] as ProfileSummary[] })),
      ]);
      setServer(profileData.profile);
      setConfirmed(Boolean(profileData.confirmed));
      setProfiles(listData.profiles);
      // Absorb Estimator / document updates only while the user isn't editing.
      if (!dirty.current && profileData.profile) setDraft(profileData.profile);
      // On first load, land on the student picker when students already exist.
      if (!initedView.current) {
        initedView.current = true;
        setView(listData.profiles.length > 0 ? "picker" : "editor");
      }
    } catch {
      /* backend not up yet — keep polling */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  async function selectStudent(id: number) {
    setPickBusyId(id);
    dirty.current = false;
    try {
      await apiFetch(`/api/profiles/${id}/activate`, { method: "POST" });
      setActive(0);
      setAttempted(false);
      setConfirmErrors([]);
      await refresh();
      setView("editor");
    } finally {
      setPickBusyId(null);
    }
  }

  async function addNewStudent() {
    setAddingNew(true);
    dirty.current = false;
    try {
      await apiFetch("/api/profile/reset", { method: "POST" });
      setDraft({});
      setActive(0);
      setAttempted(false);
      setConfirmErrors([]);
      await refresh();
      setView("editor");
    } finally {
      setAddingNew(false);
    }
  }

  function backToStudents() {
    dirty.current = false;
    setView("picker");
    refresh();
  }

  function edit(path: string, value: any) {
    dirty.current = true;
    setDraft((d) => setPath(d, path, value));
  }

  function normalize(p: Profile): Profile {
    const next = structuredClone(p);
    if (next.budget && (next.budget.ceiling_per_year != null) && !next.budget.currency) {
      next.budget.currency = "GBP";
    }
    if ((next.target?.course || next.target?.country) && !next.target?.country) {
      next.target = { ...next.target, country: "United Kingdom" };
    }
    return next;
  }

  async function saveDraft(): Promise<boolean> {
    const body = normalize(draft);
    try {
      const data = await apiFetch<{ profile: Profile }>("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      dirty.current = false;
      setDraft(data.profile);
      setServer(data.profile);
      return true;
    } catch (e) {
      setConfirmErrors([String(e)]);
      return false;
    }
  }

  async function next() {
    setBusy("save");
    await saveDraft();
    setBusy(null);
    setActive((a) => Math.min(a + 1, STEPS.length - 1));
  }

  async function freeze() {
    setAttempted(true);
    setBusy("freeze");
    setConfirmErrors([]);
    const saved = await saveDraft();
    if (!saved) {
      setBusy(null);
      return;
    }
    try {
      await apiFetch("/api/profile/confirm", { method: "POST" });
      await refresh();
    } catch (e) {
      setConfirmErrors(String(e).split("; "));
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!confirm("Start a fresh draft? The current profile is kept in the database for the record.")) return;
    dirty.current = false;
    setBusy("reset");
    try {
      await apiFetch("/api/profile/reset", { method: "POST" });
      setDraft({});
      setActive(0);
      setAttempted(false);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const errs = fieldErrors(draft);
  const showErr = (path: string) => (attempted ? errs[path] : undefined);

  if (view === "picker") {
    return (
      <PageContainer>
        <StudentPicker
          profiles={profiles}
          onSelect={selectStudent}
          onAddNew={addNewStudent}
          busyId={pickBusyId}
          addingNew={addingNew}
        />
      </PageContainer>
    );
  }

  if (confirmed) {
    return (
      <LockedView
        profile={server}
        onReset={reset}
        busy={busy === "reset"}
        onBack={profiles.length > 0 ? backToStudents : undefined}
      />
    );
  }

  const step = STEPS[active];

  return (
    <PageContainer>
      {profiles.length > 0 && (
        <button
          onClick={backToStudents}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-2 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All students
        </button>
      )}
      <div className="mb-8">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-brand">Step 1 · Onboarding</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Build the student profile</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          The Estimator agent fills this in live from a voice interview and uploaded documents. Review,
          complete anything missing, then freeze it — the frozen profile is injected verbatim into every
          call and never invented from.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Stepper profile={draft} active={active} onJump={setActive} />
        </aside>

        <div className="min-w-0">
          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{step.title}</h2>
                <p className="text-sm text-muted">{step.blurb}</p>
              </div>
              <Badge tone="neutral">
                {active + 1} / {STEPS.length}
              </Badge>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
              >
                <StepBody
                  stepId={step.id}
                  draft={draft}
                  edit={edit}
                  showErr={showErr}
                  onParsed={refresh}
                  onFreeze={freeze}
                  freezing={busy === "freeze"}
                  confirmErrors={confirmErrors}
                />
              </motion.div>
            </AnimatePresence>

            {step.id !== "review" && (
              <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
                <Button
                  variant="ghost"
                  onClick={() => setActive((a) => Math.max(0, a - 1))}
                  disabled={active === 0}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={next} loading={busy === "save"}>
                  Save & continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-2">
              Autosaves to draft on each step · connected to {API.replace(/^https?:\/\//, "") || "same origin"}
            </p>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-muted-2 transition-colors hover:text-danger"
            >
              <RotateCcw className="h-3 w-3" />
              Reset draft
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

/* -------------------------------------------------------------------------- */

function StepBody({
  stepId,
  draft,
  edit,
  showErr,
  onParsed,
  onFreeze,
  freezing,
  confirmErrors,
}: {
  stepId: string;
  draft: Profile;
  edit: (path: string, value: any) => void;
  showErr: (path: string) => string | undefined;
  onParsed: () => void;
  onFreeze: () => void;
  freezing: boolean;
  confirmErrors: string[];
}) {
  const num = (v: string) => (v === "" ? null : Number(v));

  if (stepId === "student") {
    return (
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" required error={showErr("full_name")}>
            <Input
              value={get(draft, "full_name") ?? ""}
              onChange={(e) => edit("full_name", e.target.value || null)}
              placeholder="e.g. Ayesha Khan"
            />
          </Field>
          <Field label="Home city" required error={showErr("home_city")}>
            <Input
              value={get(draft, "home_city") ?? ""}
              onChange={(e) => edit("home_city", e.target.value || null)}
              placeholder="e.g. Lahore"
            />
          </Field>
        </div>
        <Field label="Gender" hint="Only used to pick the Estimator voice — never to infer anything else.">
          <Select
            value={get(draft, "gender") ?? ""}
            onChange={(e) => edit("gender", e.target.value || null)}
          >
            <option value="">Prefer not to say</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {titleize(g)}
              </option>
            ))}
          </Select>
        </Field>
        <VoiceIndicator gender={get(draft, "gender")} />
      </div>
    );
  }

  if (stepId === "academic") {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Qualification level" required error={showErr("last_qualification.level")}>
          <Select
            value={get(draft, "last_qualification.level") ?? ""}
            onChange={(e) => edit("last_qualification.level", e.target.value || null)}
          >
            <option value="">Select…</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {titleize(l)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Grades" required error={showErr("last_qualification.grades")} hint="Verbatim, e.g. 'A-levels: AAB' or '82% (1023/1200)'">
          <Input
            value={get(draft, "last_qualification.grades") ?? ""}
            onChange={(e) => edit("last_qualification.grades", e.target.value || null)}
            placeholder="A-levels: AAB"
          />
        </Field>
        <Field label="Year completed">
          <Input
            type="number"
            value={get(draft, "last_qualification.year_completed") ?? ""}
            onChange={(e) => edit("last_qualification.year_completed", num(e.target.value))}
            placeholder="2025"
          />
        </Field>
        <Field label="Institution">
          <Input
            value={get(draft, "last_qualification.institution") ?? ""}
            onChange={(e) => edit("last_qualification.institution", e.target.value || null)}
            placeholder="e.g. Beaconhouse College"
          />
        </Field>
      </div>
    );
  }

  if (stepId === "english") {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Status" required error={showErr("english_test.status")}>
          <Select
            value={get(draft, "english_test.status") ?? ""}
            onChange={(e) => edit("english_test.status", e.target.value || null)}
          >
            <option value="">Select…</option>
            {TEST_STATUS.map((s) => (
              <option key={s} value={s}>
                {titleize(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Test type">
          <Select
            value={get(draft, "english_test.test_type") ?? ""}
            onChange={(e) => edit("english_test.test_type", e.target.value || null)}
          >
            <option value="">Not chosen</option>
            {TEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {titleize(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Overall score" hint="Band 0–9">
          <Input
            type="number"
            step="0.5"
            min={0}
            max={9}
            value={get(draft, "english_test.overall_score") ?? ""}
            onChange={(e) => edit("english_test.overall_score", num(e.target.value))}
            placeholder="7.0"
          />
        </Field>
        <Field label="Test date">
          <Input
            type="date"
            value={get(draft, "english_test.test_date") ?? ""}
            onChange={(e) => edit("english_test.test_date", e.target.value || null)}
          />
        </Field>
      </div>
    );
  }

  if (stepId === "destination") {
    const unis: string[] = get(draft, "target.preferred_universities") ?? [];
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Destination country" required error={showErr("target.country")}>
          <Input
            value={get(draft, "target.country") ?? ""}
            onChange={(e) => edit("target.country", e.target.value || null)}
            placeholder="United Kingdom"
          />
        </Field>
        <Field label="Course" required error={showErr("target.course")}>
          <Input
            value={get(draft, "target.course") ?? ""}
            onChange={(e) => edit("target.course", e.target.value || null)}
            placeholder="LLB (Bachelor of Laws)"
          />
        </Field>
        <Field label="Preferred universities" className="sm:col-span-2" hint="Comma-separated">
          <Input
            value={unis.join(", ")}
            onChange={(e) =>
              edit(
                "target.preferred_universities",
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              )
            }
            placeholder="Queen Mary, University of Manchester"
          />
        </Field>
      </div>
    );
  }

  if (stepId === "budget") {
    return (
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tuition ceiling / year" required error={showErr("budget.ceiling_per_year")}>
          <Input
            type="number"
            value={get(draft, "budget.ceiling_per_year") ?? ""}
            onChange={(e) => edit("budget.ceiling_per_year", num(e.target.value))}
            placeholder="20000"
          />
        </Field>
        <Field label="Currency" required error={showErr("budget.currency")}>
          <Input
            value={get(draft, "budget.currency") ?? ""}
            onChange={(e) => edit("budget.currency", e.target.value || null)}
            placeholder="GBP"
          />
        </Field>
        <Field label="Sponsor" required error={showErr("budget.sponsor")} hint="Who funds the study">
          <Input
            value={get(draft, "budget.sponsor") ?? ""}
            onChange={(e) => edit("budget.sponsor", e.target.value || null)}
            placeholder="father (business owner)"
          />
        </Field>
        <Field label="Bank statement capacity (PKR)" hint="Held-funds the sponsor can show for 28 days">
          <Input
            type="number"
            value={get(draft, "budget.bank_statement_capacity_pkr") ?? ""}
            onChange={(e) => edit("budget.bank_statement_capacity_pkr", num(e.target.value))}
            placeholder="8000000"
          />
        </Field>
      </div>
    );
  }

  if (stepId === "timeline") {
    return (
      <div className="space-y-5">
        <Field label="Intended intake" required error={showErr("target.intake")}>
          <Input
            value={get(draft, "target.intake") ?? ""}
            onChange={(e) => edit("target.intake", e.target.value || null)}
            placeholder="September 2026"
          />
        </Field>
        <Field label="Notes" hint="Free-text nuances the caller may use verbatim (never invented)">
          <Textarea
            value={get(draft, "notes") ?? ""}
            onChange={(e) => edit("notes", e.target.value || null)}
            placeholder="e.g. Prefers London universities; father can travel for visa interview."
          />
        </Field>
      </div>
    );
  }

  if (stepId === "documents") {
    return (
      <DocUploader
        frozen={false}
        documents={get(draft, "documents_provided")}
        onParsed={onParsed}
      />
    );
  }

  // review
  return (
    <ReviewStep draft={draft} onFreeze={onFreeze} freezing={freezing} confirmErrors={confirmErrors} />
  );
}

/* -------------------------------------------------------------------------- */

function ReviewStep({
  draft,
  onFreeze,
  freezing,
  confirmErrors,
}: {
  draft: Profile;
  onFreeze: () => void;
  freezing: boolean;
  confirmErrors: string[];
}) {
  const missing = titleizeMissing(draft);
  const ready = missing.length === 0;
  const pct = Math.round(overallProgress(draft) * 100);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface-2 p-5">
        <SummaryGrid draft={draft} />
      </div>

      {!ready ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning-soft/50 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">Still missing before freeze</p>
            <p className="mt-0.5 text-muted">{missing.join(", ")}.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success-soft/50 p-4 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="text-foreground">All required fields present — {pct}% complete. Ready to freeze.</p>
        </div>
      )}

      {confirmErrors.length > 0 && (
        <div className="rounded-lg border border-danger/25 bg-danger-soft/60 p-4 text-sm text-danger">
          <p className="mb-1 font-medium">The backend rejected the profile:</p>
          <ul className="list-inside list-disc space-y-0.5">
            {confirmErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <ShieldCheck className="h-5 w-5 shrink-0 text-brand" />
        <p className="text-sm text-muted">
          Freezing locks the profile permanently. It cannot be edited afterwards — only reset to start a new
          one.
        </p>
      </div>

      <Button size="lg" variant="success" onClick={onFreeze} loading={freezing} disabled={!ready} className="w-full">
        <Lock className="h-4 w-4" />
        Confirm & freeze profile
      </Button>
    </div>
  );
}

function SummaryGrid({ draft }: { draft: Profile }) {
  const rows: [string, any][] = [
    ["Name", get(draft, "full_name")],
    ["Home city", get(draft, "home_city")],
    ["Gender", get(draft, "gender")],
    ["Qualification", [get(draft, "last_qualification.level"), get(draft, "last_qualification.grades")].filter(Boolean).join(" · ")],
    ["English test", [get(draft, "english_test.status"), get(draft, "english_test.overall_score")].filter((x) => x != null && x !== "").join(" · ")],
    ["Course", get(draft, "target.course")],
    ["Country", get(draft, "target.country")],
    ["Intake", get(draft, "target.intake")],
    ["Preferred", (get(draft, "target.preferred_universities") ?? []).join(", ")],
    ["Budget", get(draft, "budget.ceiling_per_year") != null ? `${get(draft, "budget.currency") ?? "GBP"} ${Number(get(draft, "budget.ceiling_per_year")).toLocaleString()}` : ""],
    ["Sponsor", get(draft, "budget.sponsor")],
  ];
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2">
          <dt className="shrink-0 text-xs uppercase tracking-wide text-muted-2">{label}</dt>
          <dd className="min-w-0 text-right text-sm font-medium">
            {value ? String(value) : <span className="text-muted-2">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------------------- */

function LockedView({
  profile,
  onReset,
  busy,
  onBack,
}: {
  profile: Profile | null;
  onReset: () => void;
  busy: boolean;
  onBack?: () => void;
}) {
  return (
    <PageContainer className="max-w-3xl">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-2 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All students
        </button>
      )}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15">
            <ShieldCheck className="h-7 w-7 text-success" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Profile frozen</h1>
          <p className="mt-1.5 max-w-lg text-sm text-muted">
            This profile is confirmed and locked. It will be injected verbatim into every outbound call — no
            further edits, nothing invented beyond what is shown here.
          </p>
          {profile?.frozen_at && (
            <Badge tone="success" className="mt-3">
              <Sparkles className="h-3 w-3" /> Frozen {profile.frozen_at}
            </Badge>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <SummaryGrid draft={profile ?? {}} />
          {profile?.notes && (
            <p className="mt-4 rounded-lg bg-surface-2 p-3 text-sm text-muted">“{profile.notes}”</p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/board">
            <Button size="lg" className="w-full sm:w-auto">
              <PhoneCall className="h-4 w-4" />
              Go to the AI caller
            </Button>
          </Link>
          <Button size="lg" variant="outline" onClick={onReset} loading={busy}>
            <RotateCcw className="h-4 w-4" />
            Start a new profile
          </Button>
        </div>
      </motion.div>
    </PageContainer>
  );
}
