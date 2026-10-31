export function BrandLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <img
      src="/fitness-dream-logo.png"
      alt="Fitness Dream logo"
      className={`${className} object-contain`}
      decoding="async"
    />
  );
}
