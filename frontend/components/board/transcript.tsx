"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Building2, Radio } from "lucide-react";
import type { Line } from "@/lib/board";
import { cn } from "@/lib/utils";

export function Transcript({ lines, live }: { lines: Line[]; live: boolean }) {
  // Reveal lines one at a time for a streaming feel.
  const [revealed, setRevealed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (revealed >= lines.length) return;
    const t = setTimeout(() => setRevealed((r) => Math.min(r + 1, lines.length)), 550);
    return () => clearTimeout(t);
  }, [revealed, lines.length]);

  // If new lines arrive (poll), keep them revealed too.
  useEffect(() => {
    if (lines.length < revealed) setRevealed(lines.length);
  }, [lines.length, revealed]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [revealed]);

  const shown = lines.slice(0, revealed);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-2">
        <Radio className="h-3.5 w-3.5" />
        Live transcript
        <span className="font-normal normal-case text-muted-2">· reconstructed from logged figures</span>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {shown.map((line) => (
            <motion.div
              key={line.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-2.5 text-sm", line.speaker === "agent" && "flex-row-reverse")}
            >
              {line.speaker !== "system" && (
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    line.speaker === "agent" ? "bg-brand/15 text-brand" : "bg-surface-3 text-muted",
                  )}
                >
                  {line.speaker === "agent" ? <Bot className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                </span>
              )}
              {line.speaker === "system" ? (
                <p className="mx-auto rounded-full bg-surface-3 px-3 py-1 text-xs text-muted-2">{line.text}</p>
              ) : (
                <p
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2 leading-relaxed",
                    line.speaker === "agent"
                      ? "rounded-tr-sm bg-brand/10 text-foreground"
                      : "rounded-tl-sm bg-surface-3 text-foreground",
                  )}
                >
                  {line.text}
                </p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {live && revealed < lines.length && (
          <div className="flex gap-1 pl-9">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-muted-2"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
