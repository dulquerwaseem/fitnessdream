import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-md bg-primary/10", className)}
      {...props}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-primary) 12%, transparent), transparent)",
          animation: "shimmer-sweep 1.6s ease-in-out infinite",
        }}
      />
    </div>
  );
}

export { Skeleton };
