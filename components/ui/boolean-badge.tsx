"use client";

import { Badge } from "@/components/ui/badge";

type BooleanBadgeProps = {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
};

export function BooleanBadge({ value, trueLabel = "Ya", falseLabel = "Tidak" }: BooleanBadgeProps) {
  if (value) return <Badge variant="success">{trueLabel}</Badge>;
  return <Badge variant="outline">{falseLabel}</Badge>;
}
