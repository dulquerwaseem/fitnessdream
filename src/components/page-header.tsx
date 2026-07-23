import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
