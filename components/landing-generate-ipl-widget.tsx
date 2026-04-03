"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function LandingGenerateIplWidget() {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCount((prev) => (prev >= 200 ? 1 : prev + 1));
    }, 120);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="h-full rounded-lg border border-border bg-muted/30 p-4 sm:p-5">
      <div className="flex h-full flex-col gap-3">
        <Button type="button" className="w-full">
          <Sparkles className="mr-2 h-4 w-4" />
          Generate IPL
        </Button>

        <div className="relative flex justify-center py-0.5" aria-hidden>
          <div className="timeline-dash-flow h-7 w-[2px]" />
        </div>

        <button
          type="button"
          className="inline-flex min-h-[140px] w-full flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-[hsl(var(--foreground)/0.35)] bg-[hsl(var(--accent)/0.18)] px-3 py-4 text-foreground/90 transition hover:bg-[hsl(var(--accent)/0.24)]"
        >
          <span className="text-base font-medium">Membuat</span>
          <span className="mt-2 inline-flex items-center gap-2 text-5xl font-black leading-none text-primary">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            {count}
          </span>
          <span className="mt-2 text-lg font-semibold">tagihan</span>
        </button>
      </div>
    </div>
  );
}
