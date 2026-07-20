"use client";

import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import type { VoiceState } from "./waveform";
import { cn } from "@/lib/utils";

export function AgentOrb({
  state,
  done = false,
  size = 96,
}: {
  state: VoiceState;
  done?: boolean;
  size?: number;
}) {
  const active = !done && state !== "idle";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* pulse rings */}
      {active &&
        [0, 0.6].map((delay) => (
          <motion.span
            key={delay}
            className={cn(
              "absolute rounded-full",
              state === "speaking" ? "bg-brand/30" : "bg-info/25",
            )}
            style={{ width: size, height: size }}
            initial={{ scale: 0.85, opacity: 0.6 }}
            animate={{ scale: 1.7, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay }}
          />
        ))}

      <motion.div
        className={cn(
          "relative flex items-center justify-center rounded-full text-white shadow-xl",
          done ? "bg-success shadow-success/30" : "brand-gradient shadow-brand/40",
        )}
        style={{ width: size * 0.72, height: size * 0.72 }}
        animate={active ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: state === "speaking" ? 0.7 : 1.4, repeat: active ? Infinity : 0 }}
      >
        <Bot style={{ width: size * 0.3, height: size * 0.3 }} />
      </motion.div>
    </div>
  );
}
