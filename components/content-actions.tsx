"use client"

import { useEffect, useMemo, useState } from "react"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { ShareActions } from "@/components/share-actions"

const LIKE_STORAGE_KEY = "ksl-content-likes-v1"

function safeReadLikes(): Record<string, { count: number; liked: boolean }> {
  try {
    const raw = window.localStorage.getItem(LIKE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, { count?: number; liked?: boolean }>
    const sanitized: Record<string, { count: number; liked: boolean }> = {}
    for (const [id, value] of Object.entries(parsed)) {
      const count = Number.isFinite(value.count) ? Math.max(0, Math.floor(value.count ?? 0)) : 0
      const liked = Boolean(value.liked) || count > 0
      sanitized[id] = { count, liked }
    }
    return sanitized
  } catch {
    return {}
  }
}

function writeLikes(value: Record<string, { count: number; liked: boolean }>) {
  try {
    window.localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export function ContentActions({
  contentId,
  title,
  canonicalUrl,
  className,
}: {
  contentId: string
  title: string
  canonicalUrl: string
  className?: string
}) {
  const [ready, setReady] = useState(false)
  const [likesById, setLikesById] = useState<Record<string, { count: number; liked: boolean }>>({})

  useEffect(() => {
    setLikesById(safeReadLikes())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    writeLikes(likesById)
  }, [likesById, ready])

  const entry = useMemo(() => likesById[contentId] ?? { count: 0, liked: false }, [likesById, contentId])

  const onLike = () => {
    setLikesById((prev) => {
      const current = prev[contentId] ?? { count: 0, liked: false }
      return {
        ...prev,
        [contentId]: {
          count: current.count + 1,
          liked: true,
        },
      }
    })
  }

  return (
    <div className={cn("flex items-center gap-6 text-slate-500", className)}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 text-xs transition-colors",
          entry.liked ? "text-rose-500" : "hover:text-rose-500"
        )}
        aria-label="Like"
        onClick={onLike}
      >
        <Heart className={cn("size-4", entry.liked && "fill-current")} />
        <span>{entry.count}</span>
      </button>
      <ShareActions title={title} url={canonicalUrl} />
    </div>
  )
}

