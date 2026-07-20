"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type ReportEntry, type Currency, ITEM_LABELS, effectiveRows } from "@/lib/api";

const PALETTE = ["#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#a855f7"];
const WIN = "#10b981";

function convert(gbp: number, cur: Currency, mode: "GBP" | "PKR") {
  return mode === "PKR" ? gbp * cur.rate : gbp;
}
function label(cur: Currency, mode: "GBP" | "PKR") {
  return mode === "PKR" ? cur.secondary : cur.symbol;
}

/** Horizontal bars comparing total consultancy charges; the winner is green. */
export function ComparisonChart({
  ranked,
  cur,
  mode,
}: {
  ranked: ReportEntry[];
  cur: Currency;
  mode: "GBP" | "PKR";
}) {
  const data = ranked.map((e) => ({
    name: e.consultancy_name.length > 16 ? e.consultancy_name.slice(0, 15) + "…" : e.consultancy_name,
    value: Math.round(convert(e.consultancy_total ?? 0, cur, mode)),
    rank: e.rank,
  }));
  const height = Math.max(120, data.length * 52 + 20);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fill: "hsl(240 5% 65%)", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(240 6% 50% / 0.08)" }}
          contentStyle={{
            background: "hsl(240 8% 9%)",
            border: "1px solid hsl(240 6% 20%)",
            borderRadius: 10,
            color: "#fff",
            fontSize: 12,
          }}
          formatter={(v) => [`${label(cur, mode)} ${Number(v).toLocaleString()}`, "Charges"]}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.rank === 1 ? WIN : PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut of the recommended consultancy's fee composition. */
export function FeeCompositionChart({
  entry,
  cur,
  mode,
}: {
  entry: ReportEntry;
  cur: Currency;
  mode: "GBP" | "PKR";
}) {
  const rows = effectiveRows(entry.items ?? []).filter((q) => q.item !== "deposit");
  const data = rows.map((q) => ({
    name: ITEM_LABELS[q.item] ?? q.item,
    value: Math.round(convert(q.amount, cur, mode)),
  }));
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={48}
          outerRadius={80}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(240 8% 9%)",
            border: "1px solid hsl(240 6% 20%)",
            borderRadius: 10,
            color: "#fff",
            fontSize: 12,
          }}
          formatter={(v, n) => [`${label(cur, mode)} ${Number(v).toLocaleString()}`, n]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
