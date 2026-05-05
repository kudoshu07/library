"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Trash2 } from "lucide-react"
import type { AdminCommentRow, BannedSubscriber } from "@/lib/moderation"

export function AdminCommentsClient({
  initialComments,
  initialBanned,
}: {
  initialComments: AdminCommentRow[]
  initialBanned: BannedSubscriber[]
}) {
  const router = useRouter()
  const [comments, setComments] = useState(initialComments)
  const [banned, setBanned] = useState(initialBanned)
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null)
  const [busyEmail, setBusyEmail] = useState<string | null>(null)
  const [banInput, setBanInput] = useState("")
  const [banSubmitting, setBanSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => router.refresh()

  const handleDeleteComment = async (id: string) => {
    if (!confirm("このコメントを削除します。よろしいですか？")) return
    setBusyCommentId(id)
    setError(null)
    try {
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" })
      if (!res.ok) {
        setError("削除に失敗しました。")
        return
      }
      setComments((prev) => prev.filter((c) => c.id !== id && c.parentId !== id))
    } finally {
      setBusyCommentId(null)
    }
  }

  const handleBan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!banInput.trim()) return
    setBanSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: banInput.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (!res.ok || !data.ok) {
        if (data.error === "not_found") {
          setError("そのメールアドレスの購読者が見つかりません。")
        } else if (data.error === "invalid_email") {
          setError("メールアドレスの形式が正しくありません。")
        } else {
          setError("BAN に失敗しました。")
        }
        return
      }
      setBanInput("")
      refresh()
    } finally {
      setBanSubmitting(false)
    }
  }

  const handleUnban = async (email: string) => {
    if (!confirm(`${email} の BAN を解除します。よろしいですか？`)) return
    setBusyEmail(email)
    setError(null)
    try {
      const res = await fetch("/api/admin/ban", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        setError("解除に失敗しました。")
        return
      }
      setBanned((prev) => prev.filter((b) => b.email !== email))
    } finally {
      setBusyEmail(null)
    }
  }

  return (
    <div className="flex flex-col gap-12">
      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold">最近のコメント ({comments.length})</h2>
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">コメントはまだありません。</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {comments.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {c.author.displayName || "(名前未設定)"}
                  </span>
                  <span className="break-all">{c.author.email}</span>
                  {c.author.banned ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">
                      BAN 中
                    </span>
                  ) : null}
                  <span>·</span>
                  <time dateTime={c.createdAt}>
                    {new Date(c.createdAt).toLocaleString("ja-JP")}
                  </time>
                  {c.parentId ? (
                    <span className="rounded-full bg-muted px-2 py-0.5">返信</span>
                  ) : null}
                  <Link
                    href={c.postId}
                    className="ml-auto break-all text-primary underline-offset-2 hover:underline"
                  >
                    {c.postId}
                  </Link>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteComment(c.id)}
                    disabled={busyCommentId === c.id}
                  >
                    {busyCommentId === c.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    削除
                  </Button>
                  {!c.author.banned ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBanInput(c.author.email)
                        document
                          .getElementById("admin-ban-input")
                          ?.scrollIntoView({ behavior: "smooth", block: "center" })
                      }}
                    >
                      このユーザーを BAN
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">BAN 管理</h2>
        <form onSubmit={handleBan} className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <label
            htmlFor="admin-ban-input"
            className="text-sm font-medium text-card-foreground"
          >
            BAN するメールアドレス
          </label>
          <Input
            id="admin-ban-input"
            type="email"
            value={banInput}
            onChange={(e) => setBanInput(e.target.value)}
            placeholder="user@example.com"
            disabled={banSubmitting}
          />
          <Button type="submit" disabled={!banInput.trim() || banSubmitting}>
            {banSubmitting ? "実行中…" : "BAN を実行"}
          </Button>
        </form>

        <h3 className="mb-2 text-sm font-medium">現在 BAN されているユーザー ({banned.length})</h3>
        {banned.length === 0 ? (
          <p className="text-sm text-muted-foreground">BAN されているユーザーはいません。</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {banned.map((b) => (
              <li
                key={b.email}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {b.displayName || "(名前未設定)"}
                  </span>
                  <span className="break-all text-xs text-muted-foreground">{b.email}</span>
                  {b.bannedAt ? (
                    <span className="text-xs text-muted-foreground">
                      {new Date(b.bannedAt).toLocaleString("ja-JP")} に BAN
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnban(b.email)}
                  disabled={busyEmail === b.email}
                >
                  {busyEmail === b.email ? "解除中…" : "BAN を解除"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
