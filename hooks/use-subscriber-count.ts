"use client"

import { useEffect, useState } from "react"

export function useSubscriberCount(enabled = true): number | null {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    fetch("/api/subscribers/count", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: number } | null) => {
        if (data && typeof data.count === "number") setCount(data.count)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [enabled])

  return count
}
