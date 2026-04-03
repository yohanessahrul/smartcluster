import { BrandMark } from "@/components/brand-mark";

export function PageLoadingScreen() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-3">
        <BrandMark className="h-16 w-16" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
