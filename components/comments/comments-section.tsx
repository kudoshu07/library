"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import type { CommentListItem } from "@/lib/comments"
import { Button } from "@/components/ui/button"
import { ComposeForm } from "./compose-form"
import { CommentItem, type Viewer } from "./comment-item"

type FetchState = {
  loading: boolean
  comments: CommentListItem[]
  viewer: Viewer
}

const INITIAL_VIEWER: Viewer = {
  isLoggedIn: false,
  needsDisplayName: false,
  displayName: null,
}

export function CommentsSection({ postId }: { postId: string }) {
  const [state, setState] = useState<FetchState>({
    loading: true,
    comments: [],
    viewer: INITIAL_VIEWER,
  })

  useEffect(() => {
    let cancelled = false
    fetch(`/api/comments?post_id=${encodeURIComponent(postId)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("fetch_failed")
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        setState({
          loading: false,
          comments: Array.isArray(data.comments) ? data.comments : [],
          viewer: data.viewer ?? INITIAL_VIEWER,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setState({ loading: false, comments: [], viewer: INITIAL_VIEWER })
        }
      })
    return () => {
      cancelled = true
    }
  }, [postId])

  const { topLevel, repliesByParent } = useMemo(() => {
    const top: CommentListItem[] = []
    const map = new Map<string, CommentListItem[]>()
    for (const c of state.comments) {
      if (c.parentId) {
        const list = map.get(c.parentId) ?? []
        list.push(c)
        map.set(c.parentId, list)
      } else {
        top.push(c)
      }
    }
    return { topLevel: top, repliesByParent: map }
  }, [state.comments])

  const addComment = (c: CommentListItem) => {
    setState((s) => ({ ...s, comments: [...s.comments, c] }))
  }
  const updateComment = (c: CommentListItem) => {
    setState((s) => ({
      ...s,
      comments: s.comments.map((x) => (x.id === c.id ? c : x)),
    }))
  }
  const deleteComment = (id: string) => {
    setState((s) => ({
      ...s,
      comments: s.comments.filter((x) => x.id !== id && x.parentId !== id),
    }))
  }
  const updateLike = (id: string, liked: boolean, likeCount: number) => {
    setState((s) => ({
      ...s,
      comments: s.comments.map((x) =>
        x.id === id ? { ...x, likedByViewer: liked, likeCount } : x,
      ),
    }))
  }

  return (
    <section
      id="comments"
      className="mt-12 border-t border-border pt-8"
      aria-label="コメント"
    >
      <h2 className="mb-6 text-xl font-bold text-foreground">
        コメント {state.loading ? "" : `(${state.comments.length})`}
      </h2>

      {state.loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          読み込み中…
        </div>
      ) : state.viewer.isLoggedIn ? (
        state.viewer.needsDisplayName ? (
          <NeedsDisplayNameNotice />
        ) : (
          <ComposeForm postId={postId} onSuccess={addComment} />
        )
      ) : (
        <LoginCta postId={postId} />
      )}

      {!state.loading ? (
        <div className="mt-8 flex flex-col gap-6">
          {topLevel.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだコメントはありません。最初のコメントを投稿してみましょう。
            </p>
          ) : (
            topLevel.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                replies={repliesByParent.get(c.id)}
                postId={postId}
                viewer={state.viewer}
                onReplyAdded={addComment}
                onUpdated={updateComment}
                onDeleted={deleteComment}
                onLikeUpdated={updateLike}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  )
}

function LoginCta({ postId }: { postId: string }) {
  const next = encodeURIComponent(`${postId}#comments`)
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6">
      <p className="text-sm text-card-foreground">
        コメントするにはメルマガ登録 + ログインが必要です。
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={`/login?next=${next}`}>ログイン</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/subscribe">メルマガに登録</Link>
        </Button>
      </div>
    </div>
  )
}

function NeedsDisplayNameNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      コメントの前に
      <Link href="/account" className="mx-1 underline underline-offset-2">
        アカウント画面
      </Link>
      で表示名を設定してください。
    </div>
  )
}
