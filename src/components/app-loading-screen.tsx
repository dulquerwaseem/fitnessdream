import { BrandLogo } from "@/components/brand-logo";

export function AppLoadingScreen({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      className={`relative flex min-h-screen items-center justify-center bg-background ${
        leaving ? "animate-fade-out" : "animate-fade-in"
      }`}
    >
      <div className="flex items-center gap-3">
        <BrandLogo className="h-10 w-10 animate-breathe" />
        <span className="font-display text-lg font-bold">Fitness Dream</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-border/50">
        <div className="h-full w-1/3 bg-primary animate-loading-bar" />
      </div>
    </div>
  );
}
