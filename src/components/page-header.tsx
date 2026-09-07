import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  actions,
  leading,
  className,
}: {
  title: ReactNode;
  /** Rendered on the right of the title row (e.g. a badge). */
  actions?: ReactNode;
  /** Rendered above the title (e.g. a back button). */
  leading?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("pt-3 pb-2", className)}>
      {leading && <div className="mb-1">{leading}</div>}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold leading-tight">{title}</h1>
        {actions}
      </div>
    </div>
  );
}
