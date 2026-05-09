import "server-only"

import { getSupabaseClient } from "@/lib/newsletter"

export type AdminActionResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

export function extractEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 0) return null
  const domain = email.slice(at + 1).toLowerCase().trim()
  return domain || null
}

export async function banSubscriberById(
  subscriberId: string,
): Promise<AdminActionResult<{ email: string; displayName: string | null }>> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return { ok: false, error: "supabase_unconfigured" }
  }
  const { data, error } = await supabase
    .from("subscribers")
    .update({ banned: true, banned_at: new Date().toISOString() })
    .eq("id", subscriberId)
    .select("email, display_name")
    .maybeSingle()
  if (error) {
    console.error("banSubscriberById error", error)
    return { ok: false, error: error.message }
  }
  if (!data) return { ok: false, error: "not_found" }
  return { ok: true, email: data.email, displayName: data.display_name ?? null }
}

export async function addDomainToBlocklist(opts: {
  domain: string
  reason?: string | null
}): Promise<AdminActionResult<{ domain: string }>> {
  const domain = opts.domain.toLowerCase().trim()
  if (!domain || !domain.includes(".")) {
    return { ok: false, error: "invalid_domain" }
  }
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return { ok: false, error: "supabase_unconfigured" }
  }
  const { error } = await supabase
    .from("blocked_email_domains")
    .upsert({ domain, reason: opts.reason ?? null })
  if (error) {
    console.error("addDomainToBlocklist error", error)
    return { ok: false, error: error.message }
  }
  return { ok: true, domain }
}

export async function deleteCommentById(
  commentId: string,
): Promise<AdminActionResult<{ postId: string }>> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return { ok: false, error: "supabase_unconfigured" }
  }
  const { data: existing, error: selectError } = await supabase
    .from("comments")
    .select("id, post_id")
    .eq("id", commentId)
    .maybeSingle()
  if (selectError) {
    console.error("deleteCommentById select error", selectError)
    return { ok: false, error: selectError.message }
  }
  if (!existing) return { ok: false, error: "not_found" }

  const { error: deleteError } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
  if (deleteError) {
    console.error("deleteCommentById delete error", deleteError)
    return { ok: false, error: deleteError.message }
  }
  return { ok: true, postId: existing.post_id }
}
