"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MasterWidget } from "@/lib/master-widgets";

type MasterWidgetGridProps = {
  widgets: MasterWidget[];
  className?: string;
};

function toneClassName(tone: MasterWidget["tone"]) {
  if (tone === "warning") return "border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))]";
  if (tone === "success") return "border-[hsl(var(--success-soft))] bg-[hsl(var(--success-soft)/0.45)]";
  if (tone === "info") return "border-primary/20 bg-primary/5";
  return "";
}

export function MasterWidgetGrid({ widgets, className }: MasterWidgetGridProps) {
  return (
    <section className={className ?? "mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"}>
      {widgets.map((widget) => (
        <Card key={widget.id} className={toneClassName(widget.tone)}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">{widget.title}</p>
              <p className="font-heading text-xl">{widget.value}</p>
              {widget.note ? <p className="text-xs text-muted-foreground">{widget.note}</p> : null}
            </div>
            <widget.icon className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
