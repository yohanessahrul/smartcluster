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
  return "border border-border";
}

export function MasterWidgetGrid({ widgets, className }: MasterWidgetGridProps) {
  return (
    <section className={className ?? "mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4"}>
      {widgets.map((widget) => (
        <Card key={widget.id} className={toneClassName(widget.tone)}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">{widget.title}</p>
              <p className="font-heading text-lg sm:text-xl">{widget.value}</p>
              {widget.note ? <p className="text-xs text-muted-foreground">{widget.note}</p> : null}
            </div>
            <widget.icon className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
