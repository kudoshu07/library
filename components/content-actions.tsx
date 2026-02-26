"use client"

import { useEffect, useMemo, useState } from "react"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import { ShareActions } from "@/components/share-actions"
import { fetchLikeCounts, incrementLikeCount, readLocalLikes, writeLocalLikes } from "@/lib/likes-client"

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
    setLikesById(readLocalLikes())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    writeLocalLikes(likesById)
  }, [likesById, ready])

  useEffect(() => {
    const controller = new AbortController()
    fetchLikeCounts([contentId], controller.signal)
      .then((counts) => {
        const count = counts[contentId]
        if (!Number.isFinite(count)) return
        setLikesById((prev) => {
          const current = prev[contentId] ?? { count: 0, liked: false }
          return { ...prev, [contentId]: { ...current, count } }
        })
      })
      .catch(() => {})
    return () => controller.abort()
  }, [contentId])

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
    void incrementLikeCount(contentId).then((serverCount) => {
      if (!Number.isFinite(serverCount)) return
      setLikesById((prev) => {
        const current = prev[contentId] ?? { count: 0, liked: false }
        return {
          ...prev,
          [contentId]: {
            count: Number(serverCount),
            liked: current.liked,
          },
        }
      })
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
