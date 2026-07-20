/* Central API client + shared types.
 * Backend base is baked at build time via NEXT_PUBLIC_API_BASE.
 * Empty string => same-origin relative fetches (production behind Caddy). */

export const API = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = Record<string, any>;

export type Profile = {
  profile_id?: number | null;
  full_name?: string;
  home_city?: string;
  gender?: "female" | "male" | "unspecified" | null;
  last_qualification?: {
    level?: string;
    grades?: string;
    year_completed?: number | null;
    institution?: string | null;
  };
  english_test?: {
    status?: string;
    test_type?: string | null;
    overall_score?: number | null;
    test_date?: string | null;
  };
  target?: {
    country?: string;
    course?: string;
    intake?: string;
    preferred_universities?: string[];
  };
  budget?: {
    ceiling_per_year?: number | null;
    currency?: string;
    sponsor?: string;
    bank_statement_capacity_pkr?: number | null;
  };
  documents_provided?: { type: string; filename?: string | null; parsed_ok?: boolean }[];
  notes?: string | null;
  confirmed?: boolean;
  frozen_at?: string | null;
};

/** Compact student summary for the intake picker (from GET /api/profiles). */
export type ProfileSummary = {
  profile_id: number;
  active: boolean;
  confirmed: boolean;
  full_name: string | null;
  home_city: string | null;
  course: string | null;
  level: string | null;
  intake: string | null;
  frozen_at: string | null;
  created_at: string | null;
};

export type ProfilesResponse = { profiles: ProfileSummary[] };

export type Quote = {
  item: string;
  amount: number;
  currency: string;
  university: string | null;
  is_revised: number;
  revised_from: number | null;
  note: string | null;
  logged_at: string;
};

export type Call = {
  id: number;
  consultancy_name: string;
  phone: string | null;
  persona_id: string | null;
  conversation_id: string | null;
  started_at: string;
  outcome: string | null;
  outcome_detail: string | null;
  quotes: Quote[];
  red_flags: RedFlag[];
};

export type Currency = {
  symbol: string;
  quote_currency: string;
  secondary: string;
  rate: number;
  rate_note?: string;
  rate_source?: string;
  rate_live?: boolean;
  rate_fetched_at?: string | null;
};

export type Board = {
  currency: Currency;
  quote_items: string[];
  calls: Call[];
};

export type Callsheet = {
  personas: { id: string; name: string }[];
  call_list: { name: string; city: string | null; phone: string | null }[];
};

/** A fixed agency the caller page offers. Maps to a persona server-side; the
 *  number dialed is always VERIFIED_TARGET_NUMBER regardless of the agency. */
export type Agency = {
  id: string;
  display_name: string;
  tagline: string | null;
  country: string | null;
  initials: string | null;
  accent: string | null;
  persona_id: string | null;
  persona_name: string | null;
};

export type AgenciesResponse = { agencies: Agency[] };

export type RedFlag = {
  rule_id: string;
  severity: "high" | "medium" | "low";
  description: string;
  detail: string | null;
  flagged_at: string;
};

export type ReportEntry = {
  rank?: number;
  call_id: number;
  consultancy_name: string;
  persona_id: string | null;
  conversation_id: string | null;
  started_at: string;
  outcome: string | null;
  outcome_detail: string | null;
  red_flags: RedFlag[];
  items?: Quote[];
  consultancy_total?: number;
  consultancy_total_secondary?: number;
  deposits?: { university: string; amount: number }[];
  savings?: number;
};

export type Report = {
  vertical: string;
  currency: Currency;
  ranked: ReportEntry[];
  others: ReportEntry[];
  recommendation: string;
};

export const ITEM_LABELS: Record<string, string> = {
  service_fee: "Service fee",
  university_application_fee: "Application fee",
  deposit: "Deposit",
  visa_processing_fee: "Visa processing",
  ihs_surcharge: "IHS surcharge",
  document_attestation: "Attestation",
  ielts_booking: "IELTS booking",
  other: "Other",
};

/** Typed fetch that throws a readable message on non-2xx. */
export async function apiFetch<T = Json>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detail = (data as Json)?.detail;
    const msg = Array.isArray(detail?.errors)
      ? detail.errors.join("; ")
      : String(detail ?? r.statusText);
    throw new Error(msg);
  }
  return data as T;
}

/** Latest figure wins per line item — mirrors backend effective_rows(). */
export function effectiveRows(quotes: Quote[]): Quote[] {
  const collapsed = new Map<string, Quote>();
  for (const q of quotes) {
    let key = `${q.item}|${q.university ?? ""}`;
    if (q.item === "other" && !q.is_revised) {
      key += `|${q.note ?? ""}`;
    } else if (q.item === "other") {
      const match = [...collapsed.entries()].find(
        ([k, v]) => k.startsWith(key + "|") && v.amount === q.revised_from,
      );
      key = match ? match[0] : `${key}|${q.note ?? ""}`;
    }
    collapsed.set(key, q);
  }
  return [...collapsed.values()];
}

/** Consultancy charges exclude deposits (they pass through to universities). */
export function consultancyTotal(rows: Quote[]): number {
  return rows.filter((q) => q.item !== "deposit").reduce((s, q) => s + q.amount, 0);
}
