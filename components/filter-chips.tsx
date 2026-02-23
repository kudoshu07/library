"use client"

import { cn } from "@/lib/utils"
import type { ContentSource } from "@/lib/data"

const filters: { value: ContentSource | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "blog", label: "Blog" },
  { value: "note", label: "note(個人)" },
  { value: "ig_business", label: "kudoshu_vcook" },
  { value: "ig_photo", label: "0n0shu(写真)" },
]

export function FilterChips({
  active,
  onChange,
}: {
  active: ContentSource | "all"
  onChange: (value: ContentSource | "all") => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Content source filter">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
            active === f.value
              ? "bg-foreground text-background shadow-sm"
              : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
          )}
          aria-pressed={active === f.value}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
