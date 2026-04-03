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
    <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
      <div className="space-y-3">
        <Button type="button" className="w-full">
          <Sparkles className="mr-2 h-4 w-4" />
          Generate IPL
        </Button>

        <div className="relative flex justify-center py-1" aria-hidden>
          <div className="timeline-dash-flow h-10 w-[2px]" />
        </div>

        <button
          type="button"
          className="inline-flex w-full items-center justify-center rounded-lg border border-dashed border-border bg-transparent px-3 py-2 text-sm font-medium text-foreground/90 transition hover:bg-muted/40"
        >
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
          Membuat {count} tagihan
        </button>
      </div>
    </div>
  );
}
