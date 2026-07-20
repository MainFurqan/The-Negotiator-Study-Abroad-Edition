"use client";

import Link from "next/link";
import { Gavel, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function TopNav() {
  const { theme, toggle } = useTheme();

  return (
    <header className="no-print sticky top-0 z-50 border-b border-border glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient shadow-lg shadow-brand/30">
            <Gavel className="h-4 w-4 text-white" />
          </span>
          <span className="hidden sm:inline">The Negotiator</span>
        </Link>

        {/* Flow navigation lives in the gated <FlowBar />; the navbar no longer
            lets the user jump between flow pages arbitrarily. */}

        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
