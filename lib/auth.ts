import "server-only"

import { cookies } from "next/headers"
import { randomBytes } from "node:crypto"
import {
  getFromAddress,
  getReplyTo,
  getResendClient,
  getSiteUrl,
  getSupabaseClient,
  isSubscribableSource,
  renderLoginEmail,
} from "@/lib/newsletter"
import type { ContentSource } from "@/lib/data"

export const SESSION_COOKIE = "ksl_session"

export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000
// Hard cap from the moment a session was first issued. Prevents an
// indefinitely-extended cookie from outliving a stolen device.
export const SESSION_ABSOLUTE_TTL_MS = 365 * 24 * 60 * 60 * 1000
// Only extend the sliding window when less than this much time remains.
// Keeps DB writes to roughly once per ~45 days per active session.
const SESSION_REFRESH_THRESHOLD_MS = SESSION_TTL_MS / 2
const LOGIN_RATE_WINDOW_MS = 60 * 1000
const LOGIN_RATE_MAX = 3

function newToken(): string {
  return randomBytes(24).toString("base64url")
}

export type RequestLoginResult =
  | { kind: "sent" }
  | { kind: "not_subscribed" }
  | { kind: "not_confirmed" }
  | { kind: "rate_limited" }
  | { kind: "error"; message: string }

export async function requestLogin(
  email: string,
  nextUrl?: string,
): Promise<RequestLoginResult> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return { kind: "error", message: "supabase_not_configured" }
  }

  const normalized = email.trim().toLowerCase()

  const { data: subscriber, error } = await supabase
    .from("subscribers")
    .select("id, email, display_name, confirmed, unsubscribed_at")
    .eq("email", normalized)
    .maybeSingle()

  if (error) {
    console.error("supabase select error", error)
    return { kind: "error", message: "database_error" }
  }
  if (!subscriber) return { kind: "not_subscribed" }
  if (!subscriber.confirmed || subscriber.unsubscribed_at) {
    return { kind: "not_confirmed" }
  }

  const since = new Date(Date.now() - LOGIN_RATE_WINDOW_MS).toISOString()
  const { count, error: countError } = await supabase
    .from("login_tokens")
    .select("*", { count: "exact", head: true })
    .eq("subscriber_id", subscriber.id)
    .gte("created_at", since)
  if (countError) {
    console.error("supabase count error", countError)
    return { kind: "error", message: "database_error" }
  }
  if ((count ?? 0) >= LOGIN_RATE_MAX) return { kind: "rate_limited" }

  const token = newToken()
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MS).toISOString()
  const { error: insertError } = await supabase.from("login_tokens").insert({
    subscriber_id: subscriber.id,
    token,
    expires_at: expiresAt,
  })
  if (insertError) {
    console.error("supabase insert error", insertError)
    return { kind: "error", message: "database_error" }
  }

  const safeNext =
    nextUrl && nextUrl.startsWith("/") && !nextUrl.startsWith("//")
      ? nextUrl
      : undefined
  const verifyUrl = `${getSiteUrl()}/api/auth/verify?token=${encodeURIComponent(token)}${
    safeNext ? `&next=${encodeURIComponent(safeNext)}` : ""
  }`

  const emailContent = renderLoginEmail({
    email: normalized,
    displayName: subscriber.display_name,
    verifyUrl,
  })

  let resend
  try {
    resend = getResendClient()
  } catch {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[dev] Resend not configured. Magic link URL for ${normalized}:\n  ${verifyUrl}`,
      )
      return { kind: "sent" }
    }
    return { kind: "error", message: "resend_not_configured" }
  }

  const result = await resend.emails.send({
    from: getFromAddress(),
    to: normalized,
    replyTo: getReplyTo(),
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  })
  if (result.error) {
    console.error("resend login send error", result.error)
    return { kind: "error", message: "email_send_failed" }
  }
  return { kind: "sent" }
}

export type ConsumeLoginTokenResult =
  | { ok: true; sessionToken: string; subscriberId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "error" }

export async function consumeLoginToken(
  token: string,
): Promise<ConsumeLoginTokenResult> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return { ok: false, reason: "error" }
  }

  const { data: row, error } = await supabase
    .from("login_tokens")
    .select("id, subscriber_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle()

  if (error) {
    console.error("supabase select error", error)
    return { ok: false, reason: "error" }
  }
  if (!row) return { ok: false, reason: "invalid" }
  if (row.used_at) return { ok: false, reason: "used" }
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, reason: "expired" }
  }

  // Atomic mark-used: only succeeds if used_at is still null (race-safe).
  const { data: marked, error: markError } = await supabase
    .from("login_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle()
  if (markError) {
    console.error("supabase mark-used error", markError)
    return { ok: false, reason: "error" }
  }
  if (!marked) return { ok: false, reason: "used" }

  const sessionToken = await issueSession(row.subscriber_id)
  if (!sessionToken) return { ok: false, reason: "error" }

  return { ok: true, sessionToken, subscriberId: row.subscriber_id }
}

export async function issueSession(subscriberId: string): Promise<string | null> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return null
  }
  const sessionToken = newToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  const { error } = await supabase.from("sessions").insert({
    subscriber_id: subscriberId,
    token: sessionToken,
    expires_at: expiresAt,
  })
  if (error) {
    console.error("supabase session insert error", error)
    return null
  }
  return sessionToken
}

export type Session = {
  subscriberId: string
  email: string
  displayName: string | null
  notifyOnReply: boolean
  sources: ContentSource[]
  banned: boolean
  isOwner: boolean
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase()
  if (!owner || !email) return false
  return owner === email.toLowerCase()
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return null
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("subscriber_id, expires_at")
    .eq("token", token)
    .maybeSingle()
  if (!session) return null
  if (new Date(session.expires_at) < new Date()) return null

  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("id, email, display_name, notify_on_reply, sources, unsubscribed_at, banned")
    .eq("id", session.subscriber_id)
    .maybeSingle()
  if (!subscriber) return null
  if (subscriber.unsubscribed_at) return null

  const rawSources = Array.isArray(subscriber.sources) ? subscriber.sources : []
  const sources = rawSources
    .filter((value: unknown): value is string => typeof value === "string")
    .filter(isSubscribableSource)

  return {
    subscriberId: subscriber.id,
    email: subscriber.email,
    displayName: subscriber.display_name,
    notifyOnReply: subscriber.notify_on_reply ?? true,
    sources,
    banned: subscriber.banned ?? false,
    isOwner: isOwnerEmail(subscriber.email),
  }
}

export type TouchSessionResult =
  | { kind: "extended"; maxAgeMs: number }
  | { kind: "ok" }
  | { kind: "expired" }
  | { kind: "missing" }

export async function touchSession(token: string): Promise<TouchSessionResult> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return { kind: "missing" }
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, expires_at, issued_at")
    .eq("token", token)
    .maybeSingle()
  if (error || !session) return { kind: "missing" }

  const now = Date.now()
  const expiresAt = new Date(session.expires_at).getTime()
  if (expiresAt <= now) return { kind: "expired" }

  if (expiresAt - now > SESSION_REFRESH_THRESHOLD_MS) return { kind: "ok" }

  const issuedAt = new Date(session.issued_at).getTime()
  const absoluteCap = issuedAt + SESSION_ABSOLUTE_TTL_MS
  const target = Math.min(now + SESSION_TTL_MS, absoluteCap)
  if (target <= expiresAt) return { kind: "ok" }

  const newExpiresAt = new Date(target).toISOString()
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ expires_at: newExpiresAt })
    .eq("id", session.id)
  if (updateError) {
    console.error("supabase session touch error", updateError)
    return { kind: "ok" }
  }

  return { kind: "extended", maxAgeMs: target - now }
}

export async function destroySession(token: string): Promise<void> {
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return
  }
  await supabase.from("sessions").delete().eq("token", token)
}

export function getSessionCookieAttrs(maxAgeMs: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  }
}
