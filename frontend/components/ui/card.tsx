"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export function Card({
  className,
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface",
        "shadow-[0_1px_3px_hsl(var(--shadow-color)/0.4)]",
        hover &&
          "transition-all duration-300 hover:border-border-strong hover:shadow-[0_8px_30px_hsl(var(--shadow-color)/0.5)]",
        className,
      )}
      {...props}
    />
  );
}

/** Card that fades/rises in on mount. */
export function MotionCard({
  className,
  hover = false,
  delay = 0,
  ...props
}: HTMLMotionProps<"div"> & { hover?: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "rounded-xl border border-border bg-surface",
        "shadow-[0_1px_3px_hsl(var(--shadow-color)/0.4)]",
        hover &&
          "transition-colors duration-300 hover:border-border-strong",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

/** Small uppercase section label used inside cards. */
export function SectionLabel({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn(
        "text-xs font-semibold uppercase tracking-wider text-muted-2",
        className,
      )}
      {...props}
    />
  );
}
