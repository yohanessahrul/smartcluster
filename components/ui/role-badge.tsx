import { Skull } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AppRole = "admin" | "superadmin" | "warga" | "finance";

type RoleBadgeProps = {
  role: AppRole;
  className?: string;
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  if (role === "superadmin") {
    return (
      <Badge className={cn("border-transparent bg-black text-white", className)}>
        <Skull className="mr-1 h-3.5 w-3.5" />
        <span>superadmin</span>
      </Badge>
    );
  }

  if (role === "admin") {
    return <Badge className={className}>admin</Badge>;
  }

  if (role === "finance") {
    return (
      <Badge variant="secondary" className={className}>
        finance
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={className}>
      warga
    </Badge>
  );
}

