import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  alt?: string;
};

export function BrandMark({ className, alt = "Smart Cluster logo" }: BrandMarkProps) {
  return <Image src="/brand/brand-mark.png" alt={alt} width={64} height={64} className={cn("h-8 w-8 object-contain", className)} />;
}

