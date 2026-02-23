"use client"

import type { ComponentType } from "react"
import { FilePenLine, Instagram, Podcast } from "lucide-react"
import { type ContentSource, sourceLabels } from "@/lib/data"
import { cn } from "@/lib/utils"

type SourceVisual = {
  icon: ComponentType<{ className?: string }>
  chipClass: string
  avatarClass: string
  short: string
}

function NoteBrandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 493 493"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="m139.57,142.06c41.19,0,97.6-2.09,138.1-1.04,54.34,1.39,74.76,25.06,75.45,83.53.69,33.06,0,127.73,0,127.73h-58.79c0-82.83.35-96.5,0-122.6-.69-22.97-7.25-33.92-24.9-36.01-18.69-2.09-71.07-.35-71.07-.35v158.96h-58.79v-210.22Z"
        fill="currentColor"
      />
    </svg>
  )
}

export const sourceVisuals: Record<ContentSource, SourceVisual> = {
  blog: {
    icon: FilePenLine,
    chipClass: "bg-slate-900 text-white",
    avatarClass: "bg-slate-900 text-white",
    short: "B",
  },
  note: {
    icon: NoteBrandIcon,
    chipClass: "bg-emerald-600 text-white",
    avatarClass: "bg-emerald-600 text-white",
    short: "N",
  },
  ig_business: {
    icon: Instagram,
    chipClass: "bg-amber-100 text-amber-800",
    avatarClass: "bg-amber-100 text-amber-800",
    short: "IB",
  },
  ig_photo: {
    icon: Instagram,
    chipClass: "bg-indigo-100 text-indigo-800",
    avatarClass: "bg-indigo-100 text-indigo-800",
    short: "IP",
  },
  pod_yonakoi: {
    icon: Podcast,
    chipClass: "bg-emerald-50 text-emerald-900 border border-emerald-100",
    avatarClass: "bg-emerald-50 text-emerald-900 border border-emerald-100",
    short: "P",
  },
  pod_vegan: {
    icon: Podcast,
    chipClass: "bg-emerald-50 text-emerald-900 border border-emerald-100",
    avatarClass: "bg-emerald-50 text-emerald-900 border border-emerald-100",
    short: "P",
  },
}

export const sourceFilterOptions: Array<{ value: ContentSource | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "blog", label: sourceLabels.blog },
  { value: "note", label: sourceLabels.note },
  { value: "ig_business", label: sourceLabels.ig_business },
  { value: "ig_photo", label: sourceLabels.ig_photo },
  { value: "pod_yonakoi", label: sourceLabels.pod_yonakoi },
  { value: "pod_vegan", label: sourceLabels.pod_vegan },
]

export function SourceAvatar({ source }: { source: ContentSource }) {
  const visual = sourceVisuals[source]
  const Icon = visual.icon

  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        visual.avatarClass
      )}
      aria-hidden="true"
    >
      <Icon className="size-4" />
      <span className="sr-only">{visual.short}</span>
    </span>
  )
}

export function SourceChip({
  source,
  withIcon = false,
  iconPosition = "left",
  iconClassName,
}: {
  source: ContentSource
  withIcon?: boolean
  iconPosition?: "left" | "right"
  iconClassName?: string
}) {
  const visual = sourceVisuals[source]
  const Icon = visual.icon

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        withIcon ? "gap-1.5" : "",
        visual.chipClass
      )}
    >
      {withIcon && iconPosition === "left" && <Icon className={cn("size-3.5 shrink-0", iconClassName)} />}
      <span>{sourceLabels[source]}</span>
      {withIcon && iconPosition === "right" && <Icon className={cn("size-3.5 shrink-0", iconClassName)} />}
    </span>
  )
}

export function SourceInlineLabel({
  source,
  className,
  iconClassName,
}: {
  source: ContentSource
  className?: string
  iconClassName?: string
}) {
  const visual = sourceVisuals[source]
  const Icon = visual.icon

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Icon className={cn("size-4 shrink-0", iconClassName)} />
      <span>{sourceLabels[source]}</span>
    </span>
  )
}
