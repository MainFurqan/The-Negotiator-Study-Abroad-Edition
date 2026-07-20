"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type VoiceState = "speaking" | "listening" | "idle";

const BARS = 28;

export function Waveform({
  state,
  className,
  color = "brand",
}: {
  state: VoiceState;
  className?: string;
  color?: "brand" | "success";
}) {
  return (
    <div className={cn("flex h-12 items-center justify-center gap-[3px]", className)}>
      {Array.from({ length: BARS }).map((_, i) => {
        // A smooth envelope so the middle bars are tallest.
        const envelope = Math.sin((i / (BARS - 1)) * Math.PI);
        const peak =
          state === "speaking"
            ? 0.35 + envelope * 0.65
            : state === "listening"
              ? 0.15 + envelope * 0.25
              : 0.08;
        const dur = state === "speaking" ? 0.5 + (i % 5) * 0.08 : 1.1 + (i % 4) * 0.1;
        return (
          <motion.span
            key={i}
            className={cn(
              "w-[3px] rounded-full",
              color === "brand" ? "bg-brand" : "bg-success",
              state === "idle" && "bg-muted-2",
            )}
            initial={{ height: "8%" }}
            animate={
              state === "idle"
                ? { height: "8%" }
                : { height: [`${peak * 25}%`, `${peak * 100}%`, `${peak * 40}%`] }
            }
            transition={{
              duration: dur,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
              delay: i * 0.02,
            }}
          />
        );
      })}
    </div>
  );
}
