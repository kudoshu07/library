"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { ArrowLeft, Eye, Save, Send, Trash2 } from "lucide-react"
import Link from "next/link"
import type { Block, PartialBlock } from "@blocknote/core"
import { BlogMetaForm, type BlogMeta, useKnownTags } from "@/components/blog-editor/blog-meta-form"
import type { BlocknoteCanvasHandle } from "@/components/blog-editor/blocknote-canvas"

// BlockNote uses ProseMirror under the hood and doesn't render on the server.
// Skip SSR entirely so we don't ship a hydration mismatch placeholder; the
// loading state is brief enough that no spinner shim is worth maintaining.
const BlocknoteCanvas = dynamic(
  () =>
    import("@/components/blog-editor/blocknote-canvas").then(
      (m) => m.BlocknoteCanvas,
    ),
  { ssr: false, loading: () => <EditorSkeleton /> },
)

export type BlogEditorInitial = {
  id: string
  meta: BlogMeta
  bodyBlocks: PartialBlock[] | null
  bodyHtml: string
  sourcePath: string | null
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

// localStorage key for the in-progress body. Survives accidental tab close
// even before the user has hit the explicit "下書きを保存" button. The whole
// blob is wiped on a successful save or publish, so storage stays small.
const LS_KEY_PREFIX = "ksl-blog-draft-"
const lsKey = (id: string) => `${LS_KEY_PREFIX}${id}`

export function BlogEditor({ initial }: { initial: BlogEditorInitial }) {
  const router = useRouter()
  const knownTags = useKnownTags()
  const [meta, setMeta] = useState<BlogMeta>(initial.meta)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const slugRef = useRef(meta.slug)
  useEffect(() => {
    slugRef.current = meta.slug
  })

  // Latest serialized HTML/blocks from BlockNote — pulled out via this handle
  // on demand (save/publish) instead of held in React state so a fast typer
  // doesn't re-render the whole shell every keystroke.
  const canvasHandle = useRef<BlocknoteCanvasHandle | null>(null)

  // Local-storage backup. We snapshot block JSON only — HTML is cheap to
  // re-derive from blocks at save time.
  const [hydratedInitialBlocks, setHydratedInitialBlocks] = useState<PartialBlock[] | null>(
    initial.bodyBlocks ?? null,
  )
  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(lsKey(initial.id))
      if (!cached) return
      const parsed = JSON.parse(cached) as { blocks?: PartialBlock[] }
      if (Array.isArray(parsed?.blocks) && parsed.blocks.length > 0) {
        // Prefer the local snapshot when the user hasn't saved it yet; the
        // canonical record on the server is whatever was loaded into
        // `initial`. We accept the local copy as it's strictly newer.
        setHydratedInitialBlocks(parsed.blocks)
      }
    } catch {
      // ignore broken cache
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced background snapshot to localStorage (no network).
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!canvasHandle.current) return
      try {
        const blocks = canvasHandle.current.getBlocks()
        window.localStorage.setItem(
          lsKey(initial.id),
          JSON.stringify({ blocks, savedAt: Date.now() }),
        )
      } catch {
        // localStorage may be full or disabled; soldier on.
      }
    }, 5000)
    return () => window.clearInterval(interval)
  }, [initial.id])

  // Warn before navigating away with unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  const markDirty = useCallback(() => {
    setDirty(true)
    setSaveStatus("idle")
  }, [])

  const onMetaChange = useCallback(
    (next: BlogMeta) => {
      setMeta(next)
      markDirty()
    },
    [markDirty],
  )

  const onCanvasChange = useCallback(
    (_blocks: Block[]) => {
      markDirty()
    },
    [markDirty],
  )

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (!canvasHandle.current) return false
    setSaveStatus("saving")
    setSaveError(null)
    try {
      const blocks = canvasHandle.current.getBlocks()
      const html = await canvasHandle.current.getHtml()
      const res = await fetch(`/api/admin/blog/drafts/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meta.title,
          slug: meta.slug,
          publishDate: meta.publishDate || null,
          summary: meta.summary,
          tags: meta.tags,
          thumbnailUrl: meta.thumbnailUrl || null,
          bodyHtml: html,
          bodyBlocks: blocks,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data?.error ?? `save failed (${res.status})`)
      }
      window.localStorage.removeItem(lsKey(initial.id))
      setSaveStatus("saved")
      setDirty(false)
      return true
    } catch (e: unknown) {
      setSaveStatus("error")
      setSaveError(e instanceof Error ? e.message : "save failed")
      return false
    }
  }, [initial.id, meta])

  const publish = useCallback(async () => {
    // Save first so the publish API has the absolute latest content. This
    // also gives us a final client-side validation pass before the GitHub
    // round-trip.
    const ok = await saveDraft()
    if (!ok) return
    if (!meta.title.trim()) {
      setPublishError("タイトルを入力してください。")
      return
    }
    if (!meta.publishDate) {
      setPublishError("公開日を入力してください。")
      return
    }
    if (!meta.slug.trim()) {
      setPublishError("slugを入力してください。")
      return
    }

    setPublishing(true)
    setPublishError(null)
    try {
      const res = await fetch(`/api/admin/blog/drafts/${initial.id}/publish`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as {
        url?: string
        commitUrl?: string
        error?: string
      }
      if (!res.ok) {
        throw new Error(data?.error ?? `publish failed (${res.status})`)
      }
      // Draft has been deleted server-side. Send the user to a confirmation
      // page that points at the new public URL.
      const publishedUrl = encodeURIComponent(data.url ?? "/")
      const commitUrl = encodeURIComponent(data.commitUrl ?? "")
      router.push(
        `/admin/blog/published?url=${publishedUrl}&commit=${commitUrl}`,
      )
    } catch (e: unknown) {
      setPublishError(e instanceof Error ? e.message : "publish failed")
    } finally {
      setPublishing(false)
    }
  }, [initial.id, meta, router, saveDraft])

  const onDelete = useCallback(async () => {
    if (!window.confirm("この下書きを削除します。よろしいですか？")) return
    try {
      const res = await fetch(`/api/admin/blog/drafts/${initial.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data?.error ?? `delete failed (${res.status})`)
      }
      window.localStorage.removeItem(lsKey(initial.id))
      router.push("/admin/blog/drafts")
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "delete failed")
    }
  }, [initial.id, router])

  const previewHref = `/admin/blog/preview/${initial.id}`

  const getSlugForUpload = useCallback(() => slugRef.current, [])

  const initialBlocksMemo = useMemo(
    () => hydratedInitialBlocks ?? undefined,
    [hydratedInitialBlocks],
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/admin/blog/drafts"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            一覧へ
          </Link>
          {initial.sourcePath && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
              📝 既存記事を編集中
              <code className="ml-1 font-mono">{initial.sourcePath}</code>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatusPill status={saveStatus} error={saveError} dirty={dirty} />
          <button
            type="button"
            onClick={saveDraft}
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
          >
            <Save className="size-4" />
            下書きを保存
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await saveDraft()
              if (ok) window.open(previewHref, "_blank", "noopener,noreferrer")
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-secondary"
          >
            <Eye className="size-4" />
            プレビュー
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={publishing}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#264F8B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1f4376] disabled:opacity-50"
          >
            <Send className="size-4" />
            {publishing ? "公開中..." : "公開"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            title="下書きを削除"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </header>

      {publishError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {translatePublishError(publishError)}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <BlogMetaForm value={meta} onChange={onMetaChange} knownTags={knownTags} />
        </aside>
        <section className="min-w-0">
          <BlocknoteCanvas
            initialBlocks={initialBlocksMemo}
            initialHtml={initial.bodyHtml}
            getSlug={getSlugForUpload}
            onChange={onCanvasChange}
            handleRef={canvasHandle}
          />
        </section>
      </div>
    </div>
  )
}

function SaveStatusPill({
  status,
  error,
  dirty,
}: {
  status: SaveStatus
  error: string | null
  dirty: boolean
}) {
  if (status === "saving")
    return <span className="text-xs text-muted-foreground">保存中…</span>
  if (status === "saved")
    return <span className="text-xs text-green-600">保存しました</span>
  if (status === "error")
    return (
      <span className="text-xs text-red-600" title={error ?? undefined}>
        保存失敗: {error ?? "unknown"}
      </span>
    )
  if (dirty) return <span className="text-xs text-amber-600">未保存の変更</span>
  return <span className="text-xs text-muted-foreground">変更なし</span>
}

function translatePublishError(raw: string): string {
  if (raw.startsWith("slug_conflict")) {
    return `同じ日付・slugの記事が既に存在します（${raw}）。slugか公開日を変更してください。`
  }
  if (raw === "invalid_slug") return "slugは半角英数字とハイフンのみです。"
  if (raw === "github_not_configured")
    return "GITHUB_TOKEN / GITHUB_REPO が未設定です。docs/blog-authoring.md を参照。"
  if (raw === "commit_failed")
    return "GitHub へのコミットに失敗しました。PATが期限切れ or 権限不足の可能性。"
  return raw
}

function EditorSkeleton() {
  return (
    <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
      エディタを読み込み中…
    </div>
  )
}
