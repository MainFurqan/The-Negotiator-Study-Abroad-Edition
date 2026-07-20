import { z } from "zod";
import type { Profile } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const LEVELS = ["matric", "intermediate", "a_levels", "bachelors", "other"];
export const TEST_STATUS = ["not_taken", "booked", "taken"];
export const TEST_TYPES = ["ielts_academic", "ielts_ukvi", "pte_academic", "other"];
export const GENDERS = ["female", "male", "unspecified"];
export const DOC_TYPES = [
  { value: "transcript", label: "Academic transcript" },
  { value: "ielts_trf", label: "IELTS report (TRF)" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "existing_quote", label: "Existing quote" },
  { value: "other", label: "Other document" },
];

export function get(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath<T extends object>(obj: T, path: string, value: any): T {
  const next = structuredClone(obj);
  const keys = path.split(".");
  let cur: any = next;
  for (const k of keys.slice(0, -1)) cur = cur[k] ?? (cur[k] = {});
  cur[keys[keys.length - 1]] = value;
  return next;
}

/** True when a value counts as "provided". */
function has(v: any): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Client mirror of the backend required fields, for friendly inline validation. */
export const profileSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  home_city: z.string().min(1, "Home city is required"),
  last_qualification: z.object({
    level: z.string().min(1, "Select a qualification level"),
    grades: z.string().min(1, "Grades are required"),
  }),
  english_test: z.object({
    status: z.string().min(1, "Select a test status"),
  }),
  target: z.object({
    country: z.string().min(1, "Destination country is required"),
    course: z.string().min(1, "Course is required"),
    intake: z.string().min(1, "Intake is required"),
  }),
  budget: z.object({
    ceiling_per_year: z.number().positive("Tuition ceiling must be greater than 0"),
    currency: z.string().min(1, "Currency is required"),
    sponsor: z.string().min(1, "Sponsor is required"),
  }),
});

export type StepId =
  | "student"
  | "academic"
  | "english"
  | "destination"
  | "budget"
  | "timeline"
  | "documents"
  | "review";

export type Step = {
  id: StepId;
  title: string;
  blurb: string;
  /** Paths that must be filled for this step to count as complete. */
  required: string[];
};

export const STEPS: Step[] = [
  { id: "student", title: "Student", blurb: "Who is this application for?", required: ["full_name", "home_city"] },
  {
    id: "academic",
    title: "Academic",
    blurb: "Last qualification and grades.",
    required: ["last_qualification.level", "last_qualification.grades"],
  },
  { id: "english", title: "English test", blurb: "IELTS / PTE status.", required: ["english_test.status"] },
  {
    id: "destination",
    title: "Destination",
    blurb: "Country, course and preferred universities.",
    required: ["target.country", "target.course"],
  },
  {
    id: "budget",
    title: "Budget",
    blurb: "What the family can fund.",
    required: ["budget.ceiling_per_year", "budget.currency", "budget.sponsor"],
  },
  { id: "timeline", title: "Timeline", blurb: "Intended intake.", required: ["target.intake"] },
  { id: "documents", title: "Documents", blurb: "Upload transcripts, IELTS, bank statements.", required: [] },
  { id: "review", title: "Review", blurb: "Confirm and freeze the profile.", required: [] },
];

/** How many required paths on a step are filled (for the stepper + progress ring). */
export function stepStatus(profile: Profile | null, step: Step): "empty" | "partial" | "complete" {
  if (step.required.length === 0) return "complete";
  const filled = step.required.filter((p) => has(get(profile, p))).length;
  if (filled === 0) return "empty";
  return filled === step.required.length ? "complete" : "partial";
}

/** Overall completion 0..1 across every required path in the flow. */
export function overallProgress(profile: Profile | null): number {
  const all = STEPS.flatMap((s) => s.required);
  if (all.length === 0) return 1;
  const filled = all.filter((p) => has(get(profile, p))).length;
  return filled / all.length;
}

const REQUIRED_LABELS: Record<string, string> = {
  full_name: "Full name",
  home_city: "Home city",
  "last_qualification.level": "Qualification level",
  "last_qualification.grades": "Grades",
  "english_test.status": "English test status",
  "target.country": "Destination country",
  "target.course": "Course",
  "target.intake": "Intake",
  "budget.ceiling_per_year": "Tuition ceiling",
  "budget.currency": "Currency",
  "budget.sponsor": "Sponsor",
};

/** Human labels of every required field still missing (for the review screen). */
export function titleizeMissing(profile: Profile | null): string[] {
  return Object.entries(REQUIRED_LABELS)
    .filter(([path]) => !has(get(profile, path)))
    .map(([, label]) => label);
}

/** Map of path -> error message from the Zod mirror (used for inline hints). */
export function fieldErrors(profile: Profile | null): Record<string, string> {
  const res = profileSchema.safeParse(profile ?? {});
  if (res.success) return {};
  const out: Record<string, string> = {};
  for (const issue of res.error.issues) {
    const path = issue.path.join(".");
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}
