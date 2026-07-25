import logoAsset from "@/assets/fitness-dream-logo.png.asset.json";

export function BrandLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Fitness Dream logo"
      className={`${className} object-contain`}
      decoding="async"
    />
  );
}
