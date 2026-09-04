import { Children, Fragment, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

// Matches ListRow's own horizontal padding, so the divider lines up with
// where its icon starts and its trailing content ends, instead of running
// edge-to-edge.
const ROW_INSET = "mx-4";

/**
 * Rounded card that groups rows with a hairline divider between them, instead
 * of each row being its own bordered pill — the "Transactions" list style.
 * Elevated with a shadow rather than a colored border/ring.
 */
export function ListCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const rows = Children.toArray(children);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-list-border bg-card shadow-lg",
        className,
      )}
    >
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 && <div className={cn(ROW_INSET, "h-px bg-list-divider")} aria-hidden />}
          {row}
        </Fragment>
      ))}
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-primary/15 text-primary",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
];

function colorForKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/**
 * Circular initial avatar, colored deterministically from `colorKey` — a
 * stand-in for a category icon (which rows here don't have one of).
 */
export function ListRowAvatar({
  name,
  colorKey = name,
}: {
  name: string;
  colorKey?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        colorForKey(colorKey),
      )}
    >
      {initial}
    </div>
  );
}

/**
 * Circular checkbox for rows in a selectable list — sits in the same leading
 * slot as ListRowAvatar, so a "select" list matches the look of the other
 * ListCard lists instead of a plain square checkbox. `muted` fades an
 * already-checked box (e.g. a "paid" row that's no longer actionable) so it
 * reads as settled rather than as a live selection.
 */
export function ListRowCheckbox({
  checked,
  muted = false,
  className,
}: {
  checked: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center">
      <Checkbox
        checked={checked}
        tabIndex={-1}
        aria-hidden
        className={cn(
          "pointer-events-none size-6 rounded-full border-2",
          muted &&
            "data-checked:border-transparent data-checked:bg-primary/30 data-checked:text-primary-foreground/80",
          className,
        )}
      />
    </div>
  );
}

/**
 * One row's content: icon/avatar, title + subtitle, trailing amount/badge.
 * Purely presentational — meant to sit inside a ListCard, wrapped by
 * whatever makes it interactive (ExpandTrigger, a plain button, a link, ...).
 */
export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  chevron = false,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /** Append a trailing chevron, for rows that open something on tap. */
  chevron?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full items-center gap-3 px-4 py-3", className)}>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-snug">{title}</div>
        {subtitle != null && (
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {(trailing != null || chevron) && (
        <div className="flex shrink-0 items-center gap-1.5">
          {trailing}
          {chevron && <ChevronRight className="size-4 text-muted-foreground" />}
        </div>
      )}
    </div>
  );
}
