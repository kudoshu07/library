"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ja } from "date-fns/locale"

function compute(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ja })
  } catch {
    return ""
  }
}

export function RelativeTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => compute(iso))
  useEffect(() => {
    const t = setInterval(() => setText(compute(iso)), 60_000)
    return () => clearInterval(t)
  }, [iso])
  return (
    <time
      dateTime={iso}
      title={new Date(iso).toLocaleString("ja-JP")}
      suppressHydrationWarning
      className="text-xs text-muted-foreground"
    >
      {text}
    </time>
  )
}
