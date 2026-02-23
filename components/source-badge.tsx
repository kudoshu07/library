import { cn } from "@/lib/utils"
import { type ContentSource, sourceLabels, sourceColors } from "@/lib/data"

export function SourceBadge({
  source,
  className,
}: {
  source: ContentSource
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        sourceColors[source],
        className
      )}
    >
      {sourceLabels[source]}
    </span>
  )
}
