"use client"

export const LIKE_STORAGE_KEY = "ksl-content-likes-v1"

export type LocalLikeEntry = {
  count: number
  liked: boolean
}

export type LocalLikeMap = Record<string, LocalLikeEntry>

export function readLocalLikes(): LocalLikeMap {
  try {
    const raw = window.localStorage.getItem(LIKE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, { count?: number; liked?: boolean }>
    const sanitized: LocalLikeMap = {}
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

export function writeLocalLikes(value: LocalLikeMap) {
  try {
    window.localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export async function fetchLikeCounts(ids: string[], signal?: AbortSignal): Promise<Record<string, number>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) return {}

  const params = new URLSearchParams()
  for (const id of uniqueIds) params.append("id", id)

  const res = await fetch(`/api/likes?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    signal,
  })

  if (!res.ok) throw new Error(`Failed to fetch likes: ${res.status}`)
  const data = (await res.json()) as { counts?: Record<string, number> }
  return data.counts ?? {}
}

export async function incrementLikeCount(id: string): Promise<number | null> {
  const res = await fetch("/api/likes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
    cache: "no-store",
  })

  if (!res.ok) return null
  const data = (await res.json()) as { count?: number }
  return Number.isFinite(data.count) ? Number(data.count) : null
}

