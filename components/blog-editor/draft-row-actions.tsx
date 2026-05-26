"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Trash2 } from "lucide-react"

/**
 * The "delete draft" button on each row of the drafts list. Lives in its own
 * client component so the list page stays a Server Component (and stays
 * cheap to render — no JS needed for the rest of the row).
 */
export function DraftRowActions({ id }: { id: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const onDelete = async () => {
    if (pending) return
    if (!window.confirm("この下書きを削除します。よろしいですか？")) return
    setPending(true)
    try {
      const res = await fetch(`/api/admin/blog/drafts/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data?.error ?? `delete failed (${res.status})`)
      }
      try {
        window.localStorage.removeItem(`ksl-blog-draft-${id}`)
      } catch {
        /* ignore */
      }
      router.refresh()
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "delete failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
      title="下書きを削除"
    >
      <Trash2 className="size-3.5" />
    </button>
  )
}
