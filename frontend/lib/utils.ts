import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as money with a currency symbol, no decimals. */
export function money(amount: number, symbol = "£") {
  return `${symbol}${Math.round(amount).toLocaleString("en-GB")}`;
}

/** Format a secondary-currency amount (e.g. "PKR 1,234,000"). */
export function secondary(amount: number, code = "PKR") {
  return `${code} ${Math.round(amount).toLocaleString("en-GB")}`;
}

/** Human-readable relative/absolute time from an ISO or SQLite datetime string. */
export function formatTime(value?: string | null) {
  if (!value) return "";
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Turn snake_case / enum-ish strings into Title Case for display. */
export function titleize(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
