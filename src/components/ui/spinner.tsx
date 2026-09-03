import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon data-slot="spinner" role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

function CenteredSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Spinner className="size-6" />
    </div>
  )
}

export { Spinner, CenteredSpinner }
