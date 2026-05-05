"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { CommentListItem } from "@/lib/comments"

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "ログインが必要です。",
  invalid_body: "本文を1〜1000文字で入力してください。",
  display_name_required: "表示名を設定してから投稿してください。",
  parent_not_found: "返信先のコメントが見つかりません。",
  nesting_too_deep: "返信に返信はできません。",
  rate_limited: "投稿が早すぎます。1 分ほどお待ちください。",
  invalid_input: "入力内容に誤りがあります。",
  invalid_json: "送信に失敗しました。もう一度お試しください。",
}

const FALLBACK_ERROR = "投稿に失敗しました。時間をおいてお試しください。"

export function ComposeForm({
  postId,
  parentId = null,
  placeholder = "コメントを書く...",
  autoFocus = false,
  onSuccess,
  onCancel,
  submitLabel = "投稿する",
}: {
  postId: string
  parentId?: string | null
  placeholder?: string
  autoFocus?: boolean
  onSuccess: (c: CommentListItem) => void
  onCancel?: () => void
  submitLabel?: string
}) {
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() || submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, parentId, body }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        comment?: CommentListItem
        error?: string
      }
      if (!res.ok || !data.ok || !data.comment) {
        const code = data.error
        setError((code && ERROR_MESSAGES[code]) ?? FALLBACK_ERROR)
        return
      }
      onSuccess(data.comment)
      setBody("")
    } catch {
      setError("ネットワークエラーが発生しました。")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        maxLength={1000}
        disabled={submitting}
        className="w-full resize-y rounded-md border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{body.length} / 1000</span>
        <div className="flex gap-2">
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={submitting}
            >
              キャンセル
            </Button>
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                投稿中
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </form>
  )
}
