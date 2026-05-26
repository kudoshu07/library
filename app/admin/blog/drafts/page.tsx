import Link from "next/link"
import { Eye, NotebookPen, Plus, Trash2 } from "lucide-react"
import { getOwnerSession } from "@/lib/admin-guard"
import { listDraftsForOwner } from "@/lib/blog-drafts"
import { DraftRowActions } from "@/components/blog-editor/draft-row-actions"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "下書き一覧 | KSL Admin",
  robots: { index: false, follow: false },
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function DraftsListPage() {
  const session = await getOwnerSession()
  if (!session) return null

  const drafts = await listDraftsForOwner(session.subscriberId)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            📝 下書き一覧
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            保存中の下書き（公開すると自動削除）。タップして編集できます。
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#264F8B] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1f4376]"
        >
          <Plus className="size-4" /> 新規ブログ
        </Link>
      </header>

      {drafts.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card p-8 text-center">
          <NotebookPen className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">下書きはまだありません。</p>
          <Link
            href="/admin/blog/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#264F8B] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1f4376]"
          >
            <Plus className="size-4" /> 新しい記事を書く
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {drafts.map((draft) => {
            const editHref = `/admin/blog/drafts/${draft.id}`
            const previewHref = `/admin/blog/preview/${draft.id}`
            return (
              <li key={draft.id} className="flex items-center gap-3 px-4 py-3">
                <Link
                  href={editHref}
                  className="min-w-0 flex-1"
                >
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {draft.title.trim() || "（無題）"}
                    </p>
                    {draft.source_path && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                        📝 既存記事編集中
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    <span className="font-mono">{draft.slug || "(no slug)"}</span>
                    {" · "}
                    更新 {formatRelative(draft.updated_at)}
                    {draft.tags.length > 0 && (
                      <>
                        {" · "}
                        <span>{draft.tags.map((t) => `#${t}`).join(" ")}</span>
                      </>
                    )}
                  </p>
                </Link>
                <Link
                  href={previewHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  title="プレビュー"
                >
                  <Eye className="size-3.5" />
                </Link>
                <DraftRowActions id={draft.id} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
