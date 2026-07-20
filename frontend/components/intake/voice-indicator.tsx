"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AudioLines, Volume2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Session = {
  resolved_gender: string;
  voice: { label: string | null; description: string | null; configured: boolean };
};

export function VoiceIndicator({ gender }: { gender?: string | null }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = gender ? `?gender=${encodeURIComponent(gender)}` : "";
    apiFetch<Session>(`/api/estimator/session${q}`)
      .then((s) => !cancelled && setSession(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gender]);

  if (!session) return null;
  const { voice, resolved_gender } = session;

  return (
    <motion.div
      key={resolved_gender}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-lg border border-brand/20 bg-brand/5 p-3"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
        <AudioLines className="h-4 w-4 text-brand" />
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          Estimator voice: <span className="text-brand">{voice.label ?? resolved_gender}</span>
          <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-xs text-muted-2">
            <Volume2 className="h-3 w-3" />
            {resolved_gender}
          </span>
        </p>
        <p className="text-xs text-muted">
          {voice.description}
          {!voice.configured && " · set the voice id in .env to hear it live"}
        </p>
      </div>
    </motion.div>
  );
}
