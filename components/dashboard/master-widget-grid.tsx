"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MasterWidget } from "@/lib/master-widgets";

type MasterWidgetGridProps = {
  widgets: MasterWidget[];
  className?: string;
};

function toneClassName(tone: MasterWidget["tone"]) {
  if (tone === "warning") return "border border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))]";
  if (tone === "success") return "border border-[hsl(var(--success-ink)/0.28)] bg-[hsl(var(--success-soft)/0.45)]";
  if (tone === "danger") return "border border-destructive/30 bg-destructive/10";
  if (tone === "info") return "border border-primary/20 bg-primary/5";
  return "border border-border bg-card";
}

function iconToneClassName(tone: MasterWidget["tone"]) {
  if (tone === "warning") return "border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-ink))]";
  if (tone === "success") return "border-[hsl(var(--success-ink)/0.22)] bg-[hsl(var(--success-soft))] text-[hsl(var(--success-ink))]";
  if (tone === "danger") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (tone === "info") return "border-primary/20 bg-primary/10 text-primary";
  return "border-border bg-background text-muted-foreground";
}

function renderNoteLine(line: string) {
  const [keyPart, ...valueParts] = line.split(":");
  if (!valueParts.length) {
    return <p className="text-xs text-muted-foreground">{line}</p>;
  }
  const key = keyPart.trim();
  const value = valueParts.join(":").trim();
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{key}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function MasterWidgetGrid({ widgets, className }: MasterWidgetGridProps) {
  return (
    <section className={className ?? "mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4"}>
      {widgets.map((widget) => {
        return (
          <Card key={widget.id} className={toneClassName(widget.tone)}>
            <CardContent className="p-4">
              <div className="mb-0 flex items-start justify-between gap-2">
                <div className="space-y-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{widget.title}</p>
                  <p className="mt-[3px] font-heading text-2xl font-bold leading-none tracking-tight sm:text-[1.7rem]">{widget.value}</p>
                </div>
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${iconToneClassName(widget.tone)}`}
                >
                  <widget.icon className="h-4 w-4" />
                </span>
              </div>
              <div>
                {widget.noteLines?.length ? (
                  <div className="mt-1 space-y-1">
                    {widget.noteLines.map((line) => (
                      <div key={line}>{renderNoteLine(line)}</div>
                    ))}
                  </div>
                ) : null}
                {widget.note ? <p className="mt-1 text-xs text-muted-foreground">{widget.note}</p> : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
