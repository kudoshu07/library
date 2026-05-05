"use client"

import { useState } from "react"
import { Heart, MessageCircle, Pencil, Trash2, Loader2 } from "lucide-react"
import type { CommentListItem } from "@/lib/comments"
import { CommentAvatar } from "./avatar"
import { CommentBody } from "./comment-body"
import { ComposeForm } from "./compose-form"
import { RelativeTime } from "./relative-time"

export type Viewer = {
  isLoggedIn: boolean
  needsDisplayName: boolean
  displayName: string | null
  banned: boolean
  isOwner: boolean
}

export function CommentItem({
  comment,
  replies,
  postId,
  viewer,
  onReplyAdded,
  onUpdated,
  onDeleted,
  onLikeUpdated,
  isReply = false,
}: {
  comment: CommentListItem
  replies?: CommentListItem[]
  postId: string
  viewer: Viewer
  onReplyAdded: (c: CommentListItem) => void
  onUpdated: (c: CommentListItem) => void
  onDeleted: (id: string) => void
  onLikeUpdated: (id: string, liked: boolean, likeCount: number) => void
  isReply?: boolean
}) {
  const [isEditing, setEditing] = useState(false)
  const [isReplying, setReplying] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [busy, setBusy] = useState<null | "edit" | "delete" | "like">(null)
  const [error, setError] = useState<string | null>(null)

  const handleLike = async () => {
    if (!viewer.isLoggedIn || viewer.banned || busy) return
    const nextLiked = !comment.likedByViewer
    setBusy("like")
    try {
      const res = await fetch(`/api/comments/${comment.id}/like`, {
        method: nextLiked ? "POST" : "DELETE",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        liked?: boolean
        likeCount?: number
      }
      if (res.ok && data.ok && typeof data.likeCount === "number") {
        onLikeUpdated(comment.id, !!data.liked, data.likeCount)
      }
    } finally {
      setBusy(null)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editBody.trim() || busy) return
    setBusy("edit")
    setError(null)
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        comment?: CommentListItem
        error?: string
      }
      if (!res.ok || !data.ok || !data.comment) {
        setError("保存に失敗しました。")
        return
      }
      onUpdated(data.comment)
      setEditing(false)
    } catch {
      setError("ネットワークエラーが発生しました。")
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async () => {
    if (busy) return
    if (!confirm("このコメントを削除します。よろしいですか？")) return
    setBusy("delete")
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" })
      if (res.ok) onDeleted(comment.id)
    } finally {
      setBusy(null)
    }
  }

  const handleReplyAdded = (c: CommentListItem) => {
    onReplyAdded(c)
    setReplying(false)
  }

  return (
    <article>
      <div className="flex gap-3">
        <CommentAvatar name={comment.author.displayName} size={36} />
        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span className="font-semibold text-foreground">
              {comment.author.displayName}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <RelativeTime iso={comment.createdAt} />
            {comment.editedAt ? (
              <span className="text-xs text-muted-foreground">(編集済み)</span>
            ) : null}
          </header>

          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="mt-2 flex flex-col gap-2">
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={3}
                maxLength={1000}
                disabled={busy === "edit"}
                className="w-full resize-y rounded-md border border-border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!editBody.trim() || busy === "edit"}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "edit" ? <Loader2 className="size-3 animate-spin" /> : null}
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false)
                    setEditBody(comment.body)
                  }}
                  disabled={busy === "edit"}
                  className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
                >
                  キャンセル
                </button>
              </div>
              {error ? <p className="text-xs text-red-700">{error}</p> : null}
            </form>
          ) : (
            <div className="mt-1">
              <CommentBody body={comment.body} />
            </div>
          )}

          {!isEditing ? (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={handleLike}
                disabled={!viewer.isLoggedIn || viewer.banned || busy !== null}
                aria-label={comment.likedByViewer ? "いいねを取り消す" : "いいね"}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Heart
                  className={`size-3.5 ${comment.likedByViewer ? "fill-rose-500 text-rose-500" : ""}`}
                />
                {comment.likeCount > 0 ? <span>{comment.likeCount}</span> : null}
              </button>

              {!isReply &&
              viewer.isLoggedIn &&
              !viewer.needsDisplayName &&
              !viewer.banned ? (
                <button
                  type="button"
                  onClick={() => setReplying((r) => !r)}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-muted"
                >
                  <MessageCircle className="size-3.5" />
                  返信
                </button>
              ) : null}

              {comment.isMine && !viewer.banned ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-muted disabled:opacity-50"
                >
                  <Pencil className="size-3.5" />
                  編集
                </button>
              ) : null}

              {comment.isMine || viewer.isOwner ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  {busy === "delete" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  {viewer.isOwner && !comment.isMine ? "削除（オーナー）" : "削除"}
                </button>
              ) : null}
            </div>
          ) : null}

          {isReplying ? (
            <div className="mt-3">
              <ComposeForm
                postId={postId}
                parentId={comment.id}
                placeholder={`${comment.author.displayName} さんに返信...`}
                autoFocus
                submitLabel="返信する"
                onSuccess={handleReplyAdded}
                onCancel={() => setReplying(false)}
              />
            </div>
          ) : null}

          {replies && replies.length > 0 ? (
            <div className="mt-4 flex flex-col gap-4 border-l-2 border-border pl-4">
              {replies.map((r) => (
                <CommentItem
                  key={r.id}
                  comment={r}
                  postId={postId}
                  viewer={viewer}
                  onReplyAdded={onReplyAdded}
                  onUpdated={onUpdated}
                  onDeleted={onDeleted}
                  onLikeUpdated={onLikeUpdated}
                  isReply
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
