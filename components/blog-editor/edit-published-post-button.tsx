"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil } from "lucide-react"
import { useIsOwner } from "@/hooks/use-is-owner"

/**
 * Inline "編集" affordance shown on published blog post pages.
 * Visible only to the owner (checked client-side because the post page is
 * statically generated — see hooks/use-is-owner.ts for the trade-off).
 *
 * On click: POSTs to /api/admin/blog/import-from-mdx with the post's repo
 * path, which either reuses an existing draft for that source or creates a
 * fresh one. Then navigates the user to the editor.
 */
export function EditPublishedPostButton({ repoPath }: { repoPath: string }) {
  const isOwner = useIsOwner()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isOwner !== true) return null

  const onClick = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/blog/import-from-mdx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: repoPath }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        draftId?: string
        error?: string
      }
      if (!res.ok || !data.draftId) {
        throw new Error(data.error ?? `import failed (${res.status})`)
      }
      router.push(`/admin/blog/drafts/${data.draftId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "import failed")
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        title="この記事を編集する"
      >
        <Pencil className="size-3.5" />
        {busy ? "読み込み中…" : "編集"}
      </button>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  )
}
