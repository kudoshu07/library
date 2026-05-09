import "server-only"

import {
  getFromAddress,
  getReplyTo,
  getResendClient,
  getSiteUrl,
  getSupabaseClient,
  renderReplyNotificationEmail,
} from "@/lib/newsletter"
import {
  postSlackMessage,
  resolveBlogPostTitle,
  slackEscape,
  slackLink,
} from "@/lib/slack"
import { containsDisallowedScript } from "@/lib/script-filter"
import type { Session } from "@/lib/auth"

const POST_RATE_WINDOW_MS = 60 * 1000
const POST_RATE_MAX = 5
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000

export const COMMENT_BODY_MAX = 1000

export type CommentListItem = {
  id: string
  parentId: string | null
  body: string
  createdAt: string
  editedAt: string | null
  author: {
    subscriberId: string
    displayName: string
  }
  likeCount: number
  likedByViewer: boolean
  isMine: boolean
}

export type CommentsViewerInfo = {
  isLoggedIn: boolean
  needsDisplayName: boolean
  displayName: string | null
}

const FALLBACK_DISPLAY_NAME = "ゲスト"

export function sanitizeBody(input: string): string {
  // Normalize newlines, trim leading/trailing whitespace, collapse 3+ newlines.
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export async function fetchCommentsForPost(
  postId: string,
  viewerSubscriberId: string | null,
): Promise<CommentListItem[]> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return []
  }

  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, parent_id, subscriber_id, body, created_at, edited_at, subscribers:subscriber_id (display_name)",
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("fetchCommentsForPost error", error)
    return []
  }
  const rows = data ?? []
  if (rows.length === 0) return []

  const ids = rows.map((c: { id: string }) => c.id)
  const { data: likeRows, error: likesError } = await supabase
    .from("comment_likes")
    .select("comment_id, subscriber_id")
    .in("comment_id", ids)
  if (likesError) {
    console.error("fetchCommentsForPost likes error", likesError)
  }
  const counts = new Map<string, number>()
  const likedByViewer = new Set<string>()
  for (const row of likeRows ?? []) {
    counts.set(row.comment_id, (counts.get(row.comment_id) ?? 0) + 1)
    if (viewerSubscriberId && row.subscriber_id === viewerSubscriberId) {
      likedByViewer.add(row.comment_id)
    }
  }

  return rows.map((row) => {
    const sub = Array.isArray(
      (row as { subscribers?: unknown }).subscribers,
    )
      ? (row as { subscribers: Array<{ display_name?: string | null }> }).subscribers[0]
      : (row as { subscribers?: { display_name?: string | null } }).subscribers
    return {
      id: row.id,
      parentId: row.parent_id ?? null,
      body: row.body,
      createdAt: row.created_at,
      editedAt: row.edited_at ?? null,
      author: {
        subscriberId: row.subscriber_id,
        displayName: sub?.display_name ?? FALLBACK_DISPLAY_NAME,
      },
      likeCount: counts.get(row.id) ?? 0,
      likedByViewer: likedByViewer.has(row.id),
      isMine: viewerSubscriberId === row.subscriber_id,
    }
  })
}

export type CreateCommentResult =
  | { ok: true; comment: CommentListItem }
  | {
      ok: false
      reason:
        | "rate_limited"
        | "duplicate"
        | "parent_not_found"
        | "nesting_too_deep"
        | "display_name_required"
        | "invalid_body"
        | "banned"
        | "error"
    }

export async function createComment(opts: {
  session: Session
  postId: string
  parentId: string | null
  body: string
}): Promise<CreateCommentResult> {
  if (opts.session.banned) {
    return { ok: false, reason: "banned" }
  }
  if (!opts.session.displayName || !opts.session.displayName.trim()) {
    return { ok: false, reason: "display_name_required" }
  }
  const body = sanitizeBody(opts.body)
  if (body.length === 0 || body.length > COMMENT_BODY_MAX) {
    return { ok: false, reason: "invalid_body" }
  }
  if (containsDisallowedScript(body)) {
    return { ok: false, reason: "invalid_body" }
  }

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return { ok: false, reason: "error" }
  }

  const since = new Date(Date.now() - POST_RATE_WINDOW_MS).toISOString()
  const { count: recentCount, error: countError } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("subscriber_id", opts.session.subscriberId)
    .gte("created_at", since)
  if (countError) {
    console.error("createComment count error", countError)
    return { ok: false, reason: "error" }
  }
  if ((recentCount ?? 0) >= POST_RATE_MAX) {
    return { ok: false, reason: "rate_limited" }
  }

  // Block exact-duplicate body on the same post within DUPLICATE_WINDOW_MS.
  // This catches both accidental double-submits and bot floods of identical text.
  const dupSince = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString()
  const { data: dupRows, error: dupError } = await supabase
    .from("comments")
    .select("id")
    .eq("subscriber_id", opts.session.subscriberId)
    .eq("post_id", opts.postId)
    .eq("body", body)
    .gte("created_at", dupSince)
    .limit(1)
  if (dupError) {
    console.error("createComment dup check error", dupError)
    return { ok: false, reason: "error" }
  }
  if ((dupRows?.length ?? 0) > 0) {
    return { ok: false, reason: "duplicate" }
  }

  let parentSubscriberId: string | null = null

  if (opts.parentId) {
    const { data: parent, error: parentError } = await supabase
      .from("comments")
      .select("id, parent_id, post_id, subscriber_id")
      .eq("id", opts.parentId)
      .maybeSingle()
    if (parentError) {
      console.error("createComment parent error", parentError)
      return { ok: false, reason: "error" }
    }
    if (!parent || parent.post_id !== opts.postId) {
      return { ok: false, reason: "parent_not_found" }
    }
    parentSubscriberId = parent.subscriber_id
  }

  const { data: inserted, error } = await supabase
    .from("comments")
    .insert({
      post_id: opts.postId,
      parent_id: opts.parentId,
      subscriber_id: opts.session.subscriberId,
      body,
    })
    .select("id, parent_id, body, created_at, edited_at, subscriber_id")
    .single()
  if (error || !inserted) {
    console.error("createComment insert error", error)
    return { ok: false, reason: "error" }
  }

  const comment: CommentListItem = {
    id: inserted.id,
    parentId: inserted.parent_id ?? null,
    body: inserted.body,
    createdAt: inserted.created_at,
    editedAt: inserted.edited_at ?? null,
    author: {
      subscriberId: opts.session.subscriberId,
      displayName: opts.session.displayName,
    },
    likeCount: 0,
    likedByViewer: false,
    isMine: true,
  }

  // Fire-and-forget reply notification (don't fail the request if email fails).
  if (parentSubscriberId && parentSubscriberId !== opts.session.subscriberId) {
    void notifyReplyAuthor({
      parentSubscriberId,
      replierDisplayName: opts.session.displayName,
      replyBody: body,
      postId: opts.postId,
    }).catch((err) => {
      console.error("notifyReplyAuthor error", err)
    })
  }

  void notifyNewCommentToSlack({
    commentId: inserted.id,
    displayName: opts.session.displayName,
    postId: opts.postId,
    body,
  }).catch((err) => {
    console.error("notifyNewCommentToSlack error", err)
  })

  return { ok: true, comment }
}

export type UpdateCommentResult =
  | { ok: true; comment: CommentListItem }
  | {
      ok: false
      reason: "not_found" | "forbidden" | "invalid_body" | "banned" | "error"
    }

export async function updateOwnComment(opts: {
  session: Session
  commentId: string
  body: string
}): Promise<UpdateCommentResult> {
  if (opts.session.banned) {
    return { ok: false, reason: "banned" }
  }
  const body = sanitizeBody(opts.body)
  if (body.length === 0 || body.length > COMMENT_BODY_MAX) {
    return { ok: false, reason: "invalid_body" }
  }

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return { ok: false, reason: "error" }
  }

  const { data: existing, error: selectError } = await supabase
    .from("comments")
    .select("id, subscriber_id, parent_id, created_at")
    .eq("id", opts.commentId)
    .maybeSingle()
  if (selectError) return { ok: false, reason: "error" }
  if (!existing) return { ok: false, reason: "not_found" }
  if (existing.subscriber_id !== opts.session.subscriberId) {
    return { ok: false, reason: "forbidden" }
  }

  const editedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from("comments")
    .update({ body, edited_at: editedAt })
    .eq("id", opts.commentId)
    .select("id, parent_id, body, created_at, edited_at, subscriber_id")
    .single()
  if (updateError || !updated) return { ok: false, reason: "error" }

  const { count: likeCount } = await supabase
    .from("comment_likes")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", updated.id)
  const { data: myLike } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("comment_id", updated.id)
    .eq("subscriber_id", opts.session.subscriberId)
    .maybeSingle()

  return {
    ok: true,
    comment: {
      id: updated.id,
      parentId: updated.parent_id ?? null,
      body: updated.body,
      createdAt: updated.created_at,
      editedAt: updated.edited_at ?? null,
      author: {
        subscriberId: opts.session.subscriberId,
        displayName: opts.session.displayName ?? FALLBACK_DISPLAY_NAME,
      },
      likeCount: likeCount ?? 0,
      likedByViewer: myLike != null,
      isMine: true,
    },
  }
}

export type DeleteCommentResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "forbidden" | "error" }

export async function deleteCommentByAuthorOrOwner(opts: {
  session: Session
  commentId: string
}): Promise<DeleteCommentResult> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return { ok: false, reason: "error" }
  }

  const { data: existing, error: selectError } = await supabase
    .from("comments")
    .select("id, subscriber_id")
    .eq("id", opts.commentId)
    .maybeSingle()
  if (selectError) return { ok: false, reason: "error" }
  if (!existing) return { ok: false, reason: "not_found" }

  const isAuthor = existing.subscriber_id === opts.session.subscriberId
  if (!isAuthor && !opts.session.isOwner) {
    return { ok: false, reason: "forbidden" }
  }

  const { error: deleteError } = await supabase
    .from("comments")
    .delete()
    .eq("id", opts.commentId)
  if (deleteError) return { ok: false, reason: "error" }
  return { ok: true }
}

export type LikeResult =
  | { ok: true; liked: boolean; likeCount: number }
  | { ok: false; reason: "not_found" | "banned" | "error" }

export async function setLike(opts: {
  session: Session
  commentId: string
  liked: boolean
}): Promise<LikeResult> {
  if (opts.session.banned) {
    return { ok: false, reason: "banned" }
  }
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return { ok: false, reason: "error" }
  }

  // Make sure the comment exists.
  const { data: existing, error: selectError } = await supabase
    .from("comments")
    .select("id")
    .eq("id", opts.commentId)
    .maybeSingle()
  if (selectError) return { ok: false, reason: "error" }
  if (!existing) return { ok: false, reason: "not_found" }

  if (opts.liked) {
    const { error: upsertError } = await supabase
      .from("comment_likes")
      .upsert({
        comment_id: opts.commentId,
        subscriber_id: opts.session.subscriberId,
      })
    if (upsertError) return { ok: false, reason: "error" }
  } else {
    const { error: deleteError } = await supabase
      .from("comment_likes")
      .delete()
      .eq("comment_id", opts.commentId)
      .eq("subscriber_id", opts.session.subscriberId)
    if (deleteError) return { ok: false, reason: "error" }
  }

  const { count } = await supabase
    .from("comment_likes")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", opts.commentId)

  return { ok: true, liked: opts.liked, likeCount: count ?? 0 }
}

async function notifyNewCommentToSlack(opts: {
  commentId: string
  displayName: string
  postId: string
  body: string
}): Promise<void> {
  const site = getSiteUrl()
  const postUrl = `${site}${opts.postId}#comments`
  const title = (await resolveBlogPostTitle(opts.postId)) ?? opts.postId
  const link = slackLink(postUrl, title)
  const text = [
    "KudoShuLibraryにコメントが来たよ🎉",
    `・${slackEscape(opts.displayName)}さん`,
    `・${link}`,
    `・${slackEscape(opts.body)}`,
  ].join("\n")
  const blocks = [
    { type: "section", text: { type: "mrkdwn", text } },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          style: "danger",
          text: { type: "plain_text", text: "コメント削除", emoji: false },
          action_id: "delete_comment",
          value: JSON.stringify({ commentId: opts.commentId }),
          confirm: {
            title: { type: "plain_text", text: "コメントを削除しますか？" },
            text: { type: "plain_text", text: "削除すると元に戻せません。" },
            confirm: { type: "plain_text", text: "削除する" },
            deny: { type: "plain_text", text: "キャンセル" },
          },
        },
      ],
    },
  ]
  await postSlackMessage(text, blocks)
}

async function notifyReplyAuthor(opts: {
  parentSubscriberId: string
  replierDisplayName: string
  replyBody: string
  postId: string
}): Promise<void> {
  const supabase = getSupabaseClient()
  const { data: parentSub, error } = await supabase
    .from("subscribers")
    .select("email, display_name, notify_on_reply, unsubscribe_token, unsubscribed_at")
    .eq("id", opts.parentSubscriberId)
    .maybeSingle()
  if (error || !parentSub) return
  if (parentSub.unsubscribed_at) return
  if (parentSub.notify_on_reply === false) return

  let resend
  try {
    resend = getResendClient()
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[dev] Resend not configured. Skipping reply notification.")
    }
    return
  }

  const site = getSiteUrl()
  const postUrl = `${site}${opts.postId}#comments`
  const unsubscribeUrl = parentSub.unsubscribe_token
    ? `${site}/api/subscribe/unsubscribe?token=${encodeURIComponent(parentSub.unsubscribe_token)}`
    : `${site}/account`

  const email = renderReplyNotificationEmail({
    recipientDisplayName: parentSub.display_name,
    replierDisplayName: opts.replierDisplayName,
    replyBody: opts.replyBody,
    postUrl,
    accountUrl: `${site}/account`,
    unsubscribeUrl,
  })

  await resend.emails.send({
    from: getFromAddress(),
    to: parentSub.email,
    replyTo: getReplyTo(),
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
}
