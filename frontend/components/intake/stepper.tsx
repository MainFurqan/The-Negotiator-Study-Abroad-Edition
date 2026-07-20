"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { Profile } from "@/lib/api";
import { STEPS, stepStatus, overallProgress, type Step } from "@/lib/intake";
import { cn } from "@/lib/utils";

export function Stepper({
  profile,
  active,
  onJump,
}: {
  profile: Profile | null;
  active: number;
  onJump: (index: number) => void;
}) {
  const progress = overallProgress(profile);
  const pct = Math.round(progress * 100);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Profile completion</span>
          <span className="tabular-nums text-brand">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
          <motion.div
            className="h-full brand-gradient"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-2">
          ~{Math.max(1, Math.round((1 - progress) * 6))} min to complete
        </p>
      </div>

      <ol className="relative space-y-1">
        {STEPS.map((step: Step, i) => {
          const status = stepStatus(profile, step);
          const isActive = i === active;
          return (
            <li key={step.id}>
              <button
                onClick={() => onJump(i)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                  isActive ? "bg-surface-3" : "hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                    status === "complete"
                      ? "border-success/40 bg-success/15 text-success"
                      : status === "partial"
                        ? "border-warning/40 bg-warning/10 text-warning"
                        : isActive
                          ? "border-brand/50 bg-brand/10 text-brand"
                          : "border-border bg-surface-3 text-muted-2",
                  )}
                >
                  {status === "complete" ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      isActive ? "text-foreground" : "text-muted group-hover:text-foreground",
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="block truncate text-xs text-muted-2">{step.blurb}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
