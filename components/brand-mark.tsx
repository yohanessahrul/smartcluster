import Image from "next/image";

import { cn } from "@/lib/utils";

const BRAND_MARK_SRC = "/brand/brand-mark-ui.png";

type BrandMarkProps = {
  className?: string;
  alt?: string;
};

export function BrandMark({ className, alt = "Hunita logo" }: BrandMarkProps) {
  return <Image src={BRAND_MARK_SRC} alt={alt} width={64} height={64} className={cn("h-8 w-8 object-contain", className)} />;
}
