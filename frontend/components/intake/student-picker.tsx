"use client";

import { motion } from "framer-motion";
import { UserPlus, Lock, PencilLine, MapPin, GraduationCap, CheckCircle2, Users } from "lucide-react";
import { type ProfileSummary } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { titleize } from "@/lib/utils";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export function StudentPicker({
  profiles,
  onSelect,
  onAddNew,
  busyId,
  addingNew,
}: {
  profiles: ProfileSummary[];
  onSelect: (id: number) => void;
  onAddNew: () => void;
  busyId: number | null;
  addingNew: boolean;
}) {
  return (
    <div>
      <div className="mb-8">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-brand">Step 1 · Students</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Choose a student</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Pick an existing student to continue, or add a new one. The selected student flows through
          the whole app — the AI caller and the report always work on the student you choose here.
        </p>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {/* Add new student — always first */}
        <motion.div variants={item}>
          <button
            onClick={onAddNew}
            disabled={addingNew}
            className="group flex h-full min-h-[168px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface/40 p-6 text-center transition-colors hover:border-brand/50 hover:bg-surface disabled:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-2 text-brand transition-transform group-hover:scale-105">
              <UserPlus className="h-5 w-5" />
            </span>
            <span className="font-semibold">Add new student</span>
            <span className="text-xs text-muted-2">Start the guided intake wizard</span>
          </button>
        </motion.div>

        {profiles.map((p) => (
          <motion.div key={p.profile_id} variants={item}>
            <StudentCard
              profile={p}
              onSelect={() => onSelect(p.profile_id)}
              busy={busyId === p.profile_id}
            />
          </motion.div>
        ))}
      </motion.div>

      {profiles.length === 0 && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-2">
          <Users className="h-4 w-4" />
          No students yet — add your first one to begin.
        </div>
      )}
    </div>
  );
}

function StudentCard({
  profile: p,
  onSelect,
  busy,
}: {
  profile: ProfileSummary;
  onSelect: () => void;
  busy: boolean;
}) {
  const subtitle = [p.level ? titleize(p.level) : null, p.course].filter(Boolean).join(" · ");
  return (
    <Card hover className="flex h-full min-h-[168px] flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 text-sm font-bold">
          {(p.full_name ?? "?").slice(0, 2).toUpperCase()}
        </span>
        <div className="flex flex-col items-end gap-1.5">
          {p.active && <Badge tone="brand">Active</Badge>}
          {p.confirmed ? (
            <Badge tone="success"><Lock className="h-3 w-3" /> Frozen</Badge>
          ) : (
            <Badge tone="warning"><PencilLine className="h-3 w-3" /> Draft</Badge>
          )}
        </div>
      </div>

      <p className="truncate font-semibold">{p.full_name ?? "Unnamed draft"}</p>
      <div className="mt-1 space-y-0.5 text-xs text-muted-2">
        {p.home_city && (
          <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {p.home_city}</p>
        )}
        {subtitle && (
          <p className="flex items-center gap-1.5"><GraduationCap className="h-3 w-3" /> {subtitle}</p>
        )}
        {p.intake && <p className="pl-[18px]">{p.intake}</p>}
      </div>

      <Button
        onClick={onSelect}
        loading={busy}
        variant={p.confirmed ? "outline" : "brand"}
        size="sm"
        className="mt-4 w-full"
      >
        {p.confirmed ? (
          <>
            <CheckCircle2 className="h-4 w-4" /> Select student
          </>
        ) : (
          <>
            <PencilLine className="h-4 w-4" /> Continue editing
          </>
        )}
      </Button>
    </Card>
  );
}
