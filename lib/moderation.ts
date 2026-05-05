import "server-only"

import { getSupabaseClient } from "@/lib/newsletter"

export type AdminCommentRow = {
  id: string
  postId: string
  parentId: string | null
  body: string
  createdAt: string
  editedAt: string | null
  author: {
    subscriberId: string
    email: string
    displayName: string | null
    banned: boolean
  }
}

export type BannedSubscriber = {
  email: string
  displayName: string | null
  bannedAt: string | null
}

export async function listRecentComments(limit = 100): Promise<AdminCommentRow[]> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return []
  }
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, post_id, parent_id, subscriber_id, body, created_at, edited_at, subscribers:subscriber_id (email, display_name, banned)",
    )
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) {
    console.error("listRecentComments error", error)
    return []
  }
  return (data ?? []).map((row) => {
    const sub = Array.isArray(
      (row as { subscribers?: unknown }).subscribers,
    )
      ? (row as {
          subscribers: Array<{
            email?: string | null
            display_name?: string | null
            banned?: boolean | null
          }>
        }).subscribers[0]
      : (row as {
          subscribers?: {
            email?: string | null
            display_name?: string | null
            banned?: boolean | null
          }
        }).subscribers
    return {
      id: row.id,
      postId: row.post_id,
      parentId: row.parent_id ?? null,
      body: row.body,
      createdAt: row.created_at,
      editedAt: row.edited_at ?? null,
      author: {
        subscriberId: row.subscriber_id,
        email: sub?.email ?? "",
        displayName: sub?.display_name ?? null,
        banned: !!sub?.banned,
      },
    }
  })
}

export async function listBannedSubscribers(): Promise<BannedSubscriber[]> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return []
  }
  const { data, error } = await supabase
    .from("subscribers")
    .select("email, display_name, banned_at")
    .eq("banned", true)
    .order("banned_at", { ascending: false })
  if (error) {
    console.error("listBannedSubscribers error", error)
    return []
  }
  return (data ?? []).map((row) => ({
    email: row.email,
    displayName: row.display_name ?? null,
    bannedAt: row.banned_at ?? null,
  }))
}

export type SetBanResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "error" }

export async function setBan(opts: {
  email: string
  banned: boolean
}): Promise<SetBanResult> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return { ok: false, reason: "error" }
  }
  const normalized = opts.email.trim().toLowerCase()
  const { data: existing, error: selectError } = await supabase
    .from("subscribers")
    .select("id")
    .eq("email", normalized)
    .maybeSingle()
  if (selectError) return { ok: false, reason: "error" }
  if (!existing) return { ok: false, reason: "not_found" }

  const { error: updateError } = await supabase
    .from("subscribers")
    .update({
      banned: opts.banned,
      banned_at: opts.banned ? new Date().toISOString() : null,
    })
    .eq("id", existing.id)
  if (updateError) return { ok: false, reason: "error" }
  return { ok: true }
}
