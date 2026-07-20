"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  PhoneCall,
  ShieldCheck,
  BarChart3,
  UserRound,
  Sparkles,
  Scale,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STEPS = [
  {
    icon: UserRound,
    title: "1 · Profile intake",
    body: "Voice interview or document upload builds one verified student profile. Nothing is invented — grades, funds and scores come only from what the student provides.",
  },
  {
    icon: PhoneCall,
    title: "2 · AI negotiation calls",
    body: "The agent calls consultancies, itemises every fee live, and negotiates down using real cross-quote leverage pulled from the database — never fabricated offers.",
  },
  {
    icon: BarChart3,
    title: "3 · Ranked report",
    body: "A deterministic GBP + PKR comparison ranks every consultancy, annotates red flags against published benchmarks, and recommends the best-value option.",
  },
];

const FEATURES = [
  { icon: ShieldCheck, title: "Honesty-constrained", body: "Leverage comes only from logged quotes. Every call ends in a structured outcome." },
  { icon: Scale, title: "Benchmark red flags", body: "Padded deposits and below-floor totals flagged against verified official figures." },
  { icon: Sparkles, title: "Config-driven", body: "The whole vertical is one JSON file — swap UK Law for any market without code." },
  { icon: FileCheck2, title: "Auditable", body: "Every figure carries its call id, timestamp and recording link. No LLM guesses." },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
        <div className="absolute right-[8%] top-[20%] h-[300px] w-[300px] rounded-full bg-brand-2/20 blur-[110px]" />
      </div>

      <section className="mx-auto max-w-6xl px-5 pt-20 pb-16 text-center sm:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-1.5 text-xs font-medium text-muted"
        >
          <span className="flex h-1.5 w-1.5 rounded-full bg-success" />
          ElevenLabs Agents · FastAPI · Live voice negotiation
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mx-auto max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-6xl"
        >
          <span className="text-gradient">Study-abroad fees,</span>
          <br />
          negotiated down by an AI agent.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted"
        >
          The Negotiator calls UK consultancies on behalf of Pakistani students, itemises every fee,
          and drives prices down with real cross-quote leverage — then hands you a ranked
          GBP&nbsp;+&nbsp;PKR report.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <Link href="/intake">
            <Button size="lg" className="group">
              Start student intake
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* How it works */}
      <motion.section
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto max-w-6xl px-5 pb-8"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <motion.div key={s.title} variants={item}>
                <Card hover className="h-full p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface-2">
                    <Icon className="h-5 w-5 text-brand" />
                  </div>
                  <h3 className="mb-2 font-semibold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted">{s.body}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Feature strip */}
      <motion.section
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mx-auto max-w-6xl px-5 pb-24 pt-8"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div key={f.title} variants={item}>
                <Card className="h-full p-5">
                  <Icon className="mb-3 h-5 w-5 text-brand-2" />
                  <h4 className="mb-1.5 text-sm font-semibold">{f.title}</h4>
                  <p className="text-xs leading-relaxed text-muted">{f.body}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}
