"use client"

import { useEffect, useState } from "react"

/**
 * Client-side check for whether the current viewer is the blog owner.
 * Used by SiteHeader (which appears on static pages where we can't read
 * cookies server-side without forcing dynamic rendering) and by the
 * inline "編集" button on published blog posts.
 *
 * Returns null while loading so callers can render nothing during the
 * brief check rather than flashing the (incorrect) "not owner" state.
 *
 * The /api/admin/whoami endpoint is `no-store` so this hook always reflects
 * the current cookie state — no stale state after login/logout.
 *
 * Security: this hook only controls UI visibility. Every owner-only API
 * route enforces its own server-side check (see lib/admin-guard.ts).
 */
export function useIsOwner(): boolean | null {
  const [isOwner, setIsOwner] = useState<boolean | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/admin/whoami", { signal: controller.signal, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { isOwner: false }))
      .then((data: { isOwner?: boolean }) => {
        setIsOwner(data?.isOwner === true)
      })
      .catch(() => setIsOwner(false))
    return () => controller.abort()
  }, [])

  return isOwner
}
