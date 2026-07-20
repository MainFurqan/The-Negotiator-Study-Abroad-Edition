"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Lock, UserRound, PhoneCall, BarChart3 } from "lucide-react";
import { apiFetch, type Call } from "@/lib/api";
import {
  FLOW_STEPS,
  EMPTY_STATUS,
  type FlowStatus,
  type FlowStepId,
  isFlowPath,
  lockReason,
  stepState,
} from "@/lib/flow";
import { cn } from "@/lib/utils";

const ICONS: Record<FlowStepId, React.ComponentType<{ className?: string }>> = {
  intake: UserRound,
  board: PhoneCall,
  report: BarChart3,
};

export function FlowBar() {
  const pathname = usePathname();
  const [status, setStatus] = useState<FlowStatus>(EMPTY_STATUS);
  const [blocked, setBlocked] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [profile, board] = await Promise.all([
        apiFetch<{ confirmed?: boolean }>("/api/profile"),
        apiFetch<{ calls?: Call[] }>("/api/calls").catch(() => ({ calls: [] as Call[] })),
      ]);
      setStatus({
        profileConfirmed: Boolean(profile.confirmed),
        hasEndedCall: (board.calls ?? []).some((c) => Boolean(c.outcome)),
      });
    } catch {
      /* backend not up — keep the (locked) defaults */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh, pathname]);

  useEffect(() => {
    if (!blocked) return;
    const t = setTimeout(() => setBlocked(null), 2800);
    return () => clearTimeout(t);
  }, [blocked]);

  // Render below the navbar on the three flow pages only — never on "/".
  if (!isFlowPath(pathname)) return null;

  return (
    <div className="no-print sticky top-16 z-40 flex justify-center px-4 pt-4">
      <div className="relative">
        <nav
          aria-label="Progress"
          className="flex items-center gap-1 rounded-full border border-border bg-surface/80 px-2 py-1.5 shadow-lg shadow-black/10 backdrop-blur-md"
        >
          {FLOW_STEPS.map((step, i) => {
            const state = stepState(step.id, pathname, status);
            const Icon = ICONS[step.id];
            const locked = state === "locked";
            const content = (
              <span
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  state === "current" && "text-brand-foreground",
                  state === "complete" && "text-success",
                  state === "available" && "text-muted hover:text-foreground",
                  locked && "cursor-not-allowed text-muted-2",
                )}
              >
                {state === "current" && (
                  <motion.span
                    layoutId="flow-active"
                    className="absolute inset-0 rounded-full brand-gradient"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative flex h-4 w-4 items-center justify-center">
                  {state === "complete" ? (
                    <Check className="h-4 w-4" />
                  ) : locked ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <span className="relative hidden sm:inline">{step.label}</span>
                <span className="relative sm:hidden">{step.label}</span>
              </span>
            );

            return (
              <div key={step.id} className="flex items-center">
                {locked ? (
                  <button
                    type="button"
                    onClick={() => setBlocked(lockReason(step.id))}
                    aria-disabled
                    aria-label={`${step.label} — locked. ${lockReason(step.id)}`}
                  >
                    {content}
                  </button>
                ) : (
                  <Link href={step.href}>{content}</Link>
                )}
                {i < FLOW_STEPS.length - 1 && (
                  <ChevronRight className="mx-0.5 h-4 w-4 shrink-0 text-muted-2" />
                )}
              </div>
            );
          })}
        </nav>

        <AnimatePresence>
          {blocked && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute left-1/2 top-full mt-2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg border border-warning/30 bg-surface px-3 py-1.5 text-xs font-medium text-warning shadow-lg"
            >
              <Lock className="h-3 w-3" />
              {blocked}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
