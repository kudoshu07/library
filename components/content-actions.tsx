"use client"

import { useEffect, useMemo, useState } from "react"
import { Heart, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { ShareActions } from "@/components/share-actions"
import { fetchLikeCounts, incrementLikeCount, readLocalLikes, writeLocalLikes } from "@/lib/likes-client"

export function ContentActions({
  contentId,
  title,
  canonicalUrl,
  commentPostId,
  className,
}: {
  contentId: string
  title: string
  canonicalUrl: string
  commentPostId?: string
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

  const [commentCount, setCommentCount] = useState<number | null>(null)
  useEffect(() => {
    if (!commentPostId) return
    const controller = new AbortController()
    fetch(
      `/api/comments?post_id=${encodeURIComponent(commentPostId)}&count_only=1`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.count === "number") setCommentCount(data.count)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [commentPostId])

  const onComment = () => {
    const target = document.getElementById("comments")
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" })
    } else {
      window.location.hash = "#comments"
    }
  }

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
      {commentPostId ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs transition-colors hover:text-sky-600"
          aria-label="コメントへ移動"
          onClick={onComment}
        >
          <MessageCircle className="size-4" />
          <span>{commentCount ?? 0}</span>
        </button>
      ) : null}
      <ShareActions title={title} url={canonicalUrl} />
    </div>
  )
}
