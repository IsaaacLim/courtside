import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Circular icon button on a raised neutral surface with a soft shadow — the
 * back/menu/filter "chip" style from the UI reference (round white button,
 * single centered icon). Reused wherever a header needs a standalone icon
 * action instead of a text button.
 */
export function RoundIconButton({
  className,
  variant = "ghost",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant={variant}
      className={cn(
        "size-10 rounded-full bg-raised text-foreground shadow-xs hover:bg-raised/80",
        className,
      )}
      {...props}
    />
  );
}
