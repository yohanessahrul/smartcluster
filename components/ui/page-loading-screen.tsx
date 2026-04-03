import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

type BrandLoadingContentProps = {
  logoClassName?: string;
  textClassName?: string;
  className?: string;
  label?: string;
};

export function BrandLoadingContent({
  logoClassName,
  textClassName,
  className,
  label = "Loading...",
}: BrandLoadingContentProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <BrandMark className={cn("h-16 w-16", logoClassName)} />
      <p className={cn("text-sm text-muted-foreground", textClassName)}>{label}</p>
    </div>
  );
}

export function PageLoadingScreen() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <BrandLoadingContent />
    </div>
  );
}
