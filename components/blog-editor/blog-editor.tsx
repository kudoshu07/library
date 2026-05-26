"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Eye,
  Minimize2,
  PanelLeftClose,
  Save,
  Send,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import type { Block, PartialBlock } from "@blocknote/core"
import { BlogMetaForm, type BlogMeta, useKnownTags } from "@/components/blog-editor/blog-meta-form"
import type { BlocknoteCanvasHandle } from "@/components/blog-editor/blocknote-canvas"
import { ConfirmDialog } from "@/components/blog-editor/confirm-dialog"
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard"

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

  // Warn before navigating away with unsaved changes — both hard nav
  // (refresh, back button, tab close) and internal Next.js Link clicks.
  // See hooks/use-unsaved-changes-guard.ts.
  useUnsavedChangesGuard(dirty)

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

  // Confirmation dialog state. We never trigger publish/delete directly
  // from a button click — those buttons open these dialogs instead, and
  // the dialog's confirm action invokes the network call. That way an
  // accidental tap on the (large, prominent) 公開 button doesn't cost a
  // GitHub commit + Vercel deploy.
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const runPublish = useCallback(async () => {
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
      // Draft has been deleted server-side; clear dirty so the unsaved
      // guard doesn't block the redirect.
      setDirty(false)
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

  const runDelete = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/blog/drafts/${initial.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data?.error ?? `delete failed (${res.status})`)
      }
      window.localStorage.removeItem(lsKey(initial.id))
      setDirty(false)
      router.push("/admin/blog/drafts")
    } catch (e: unknown) {
      window.alert(e instanceof Error ? e.message : "delete failed")
    }
  }, [initial.id, router])

  const previewHref = `/admin/blog/preview/${initial.id}`

  const initialBlocksMemo = useMemo(
    () => hydratedInitialBlocks ?? undefined,
    [hydratedInitialBlocks],
  )

  // Focus mode collapses the left meta form AND hides both this editor's
  // header bar and the site-wide header so only the title + body remain on
  // screen. Implemented as a fullscreen fixed overlay so we don't have to
  // coordinate with the LayoutShell (which lives a couple of components up).
  const [focusMode, setFocusMode] = useState(false)
  const enterFocus = useCallback(() => setFocusMode(true), [])
  const exitFocus = useCallback(() => setFocusMode(false), [])

  const titleInput = (
    <input
      type="text"
      value={meta.title}
      onChange={(e) => onMetaChange({ ...meta, title: e.target.value })}
      placeholder="タイトル"
      className="block w-full bg-transparent text-3xl font-bold leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none md:text-4xl"
      aria-label="記事タイトル"
    />
  )

  const bodyCanvas = (
    <BlocknoteCanvas
      initialBlocks={initialBlocksMemo}
      initialHtml={initial.bodyHtml}
      draftId={initial.id}
      onChange={onCanvasChange}
      handleRef={canvasHandle}
    />
  )

  // Confirmation dialogs — rendered once regardless of focus mode so the
  // overlay (which uses an AlertDialogPortal) stays mounted even when the
  // editor's chrome changes around it.
  const confirmDialogs = (
    <>
      <ConfirmDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        title="本当に公開しますか？"
        description={
          <>
            <p className="mb-2">
              この内容を GitHub にコミットし、本番サイトに反映します。
              Vercel ビルド完了後（1〜2分）に公開されます。
            </p>
            <ul className="ml-4 list-disc space-y-1 text-xs">
              <li>タイトル: <strong>{meta.title.trim() || "(未入力)"}</strong></li>
              <li>
                公開日:{" "}
                <strong>
                  {meta.publishDate
                    ? new Date(meta.publishDate).toLocaleString("ja-JP")
                    : "(未入力)"}
                </strong>
              </li>
              <li>slug: <strong className="font-mono">{meta.slug.trim() || "(未入力)"}</strong></li>
              {initial.sourcePath && (
                <li className="text-amber-700">
                  既存記事 <code className="font-mono">{initial.sourcePath}</code>{" "}
                  を上書きします
                </li>
              )}
            </ul>
          </>
        }
        confirmLabel={publishing ? "公開中..." : "公開する"}
        onConfirm={runPublish}
        disabled={publishing}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="この下書きを削除しますか？"
        description={
          <>
            <p className="mb-2">
              下書き「<strong>{meta.title.trim() || "(無題)"}</strong>」を削除します。
              元に戻せません。
            </p>
            {initial.sourcePath && (
              <p className="text-xs text-amber-700">
                ※ 削除されるのはこの下書きだけで、公開済み記事{" "}
                <code className="font-mono">{initial.sourcePath}</code>{" "}
                には影響しません。
              </p>
            )}
          </>
        }
        confirmLabel="削除する"
        variant="destructive"
        onConfirm={runDelete}
      />
    </>
  )

  // CRITICAL: focus mode toggle must NOT change the JSX tree shape around
  // the BlocknoteCanvas. If the canvas's parent path changes, React
  // unmounts → remounts, which re-runs useCreateBlockNote with the *stale
  // server `initialBlocks`* and the user's in-flight edits are wiped.
  //
  // So instead of two different `return`s, we always render the same tree
  // and just swap classes + header contents based on `focusMode`. The
  // <section> holding {titleInput}{bodyCanvas} sits at the same depth in
  // both modes, so React keeps the editor instance alive across toggles.
  return (
    <>
      <div
        className={
          focusMode
            ? "fixed inset-0 z-[100] overflow-y-auto bg-background"
            : "mx-auto max-w-6xl px-4 py-6 lg:px-6"
        }
      >
        <header
          className={
            focusMode
              ? "sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur"
              : "mb-4 flex flex-wrap items-center justify-between gap-3"
          }
        >
          {focusMode ? (
            <>
              <button
                type="button"
                onClick={exitFocus}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                title="通常表示に戻る"
              >
                <Minimize2 className="size-3.5" />
                通常表示
              </button>
              <div className="flex items-center gap-2">
                <SaveStatusPill status={saveStatus} error={saveError} dirty={dirty} />
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={saveStatus === "saving"}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
                >
                  <Save className="size-4" />
                  保存
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Link
                  href="/admin/blog/drafts"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm hover:bg-secondary"
                >
                  <Eye className="size-4" />
                  プレビュー
                </button>
                <button
                  type="button"
                  onClick={() => setPublishDialogOpen(true)}
                  disabled={publishing}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#264F8B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1f4376] disabled:opacity-50"
                >
                  <Send className="size-4" />
                  {publishing ? "公開中..." : "公開"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  title="下書きを削除"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </>
          )}
        </header>

        {publishError && !focusMode && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {translatePublishError(publishError)}
          </div>
        )}

        <div
          className={
            focusMode
              ? "mx-auto max-w-3xl px-6 pb-24 pt-10"
              : "grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]"
          }
        >
          {/*
            Aside is kept in the tree even in focus mode (just `hidden`)
            so the sibling <section> below stays at the same position and
            BlocknoteCanvas isn't remounted by React's reconciler.
          */}
          <aside
            className={focusMode ? "hidden" : "lg:sticky lg:top-4 lg:self-start"}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">記事の設定</span>
              <button
                type="button"
                onClick={enterFocus}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                title="メタフォームを閉じて集中モードへ"
              >
                <PanelLeftClose className="size-3.5" />
                閉じる
              </button>
            </div>
            <BlogMetaForm
              value={meta}
              onChange={onMetaChange}
              knownTags={knownTags}
              draftId={initial.id}
            />
          </aside>
          <section className="flex min-w-0 flex-col gap-4">
            <div className={focusMode ? "mb-6" : undefined}>{titleInput}</div>
            {bodyCanvas}
          </section>
        </div>
      </div>
      {confirmDialogs}
    </>
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
