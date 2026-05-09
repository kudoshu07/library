import { NextResponse } from "next/server"
import { getSiteUrl, getSupabaseClient, sourceLabel } from "@/lib/newsletter"
import { postSlackMessage, slackEscape } from "@/lib/slack"
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  getSessionCookieAttrs,
  issueSession,
} from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Bots that subscribe and confirm within seconds of signup get blocked.
// Real users always take longer than this (open inbox, find the email, click).
const MIN_CONFIRM_ELAPSED_MS = 10 * 1000

function safeNextPath(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith("/") || value.startsWith("//")) return null
  if (value.length > 512) return null
  return value
}

function appendQueryFlag(target: string, key: string, value: string): string {
  // target may include "?query" and/or "#fragment"; preserve both.
  const hashIdx = target.indexOf("#")
  const hash = hashIdx >= 0 ? target.slice(hashIdx) : ""
  const head = hashIdx >= 0 ? target.slice(0, hashIdx) : target
  const sep = head.includes("?") ? "&" : "?"
  return `${head}${sep}${key}=${encodeURIComponent(value)}${hash}`
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")?.trim()
  const next = safeNextPath(url.searchParams.get("next"))
  const site = getSiteUrl()

  if (!token) {
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=invalid`, 303)
  }

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=error`, 303)
  }

  const { data: row, error: selectError } = await supabase
    .from("subscribers")
    .select(
      "id, email, confirmed, unsubscribed_at, display_name, sources, created_at, confirm_token_issued_at",
    )
    .eq("confirm_token", token)
    .maybeSingle()

  if (selectError) {
    console.error("supabase select error", selectError)
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=error`, 303)
  }

  if (!row) {
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=invalid`, 303)
  }

  if (row.confirmed && !row.unsubscribed_at) {
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=already`, 303)
  }

  // Fall back to created_at for legacy rows where the column is NULL.
  const issuedAtRaw = row.confirm_token_issued_at ?? row.created_at
  const issuedAtMs = issuedAtRaw ? new Date(issuedAtRaw).getTime() : NaN
  if (Number.isFinite(issuedAtMs) && Date.now() - issuedAtMs < MIN_CONFIRM_ELAPSED_MS) {
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=too_fast`, 303)
  }

  const { error: updateError } = await supabase
    .from("subscribers")
    .update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
      unsubscribed_at: null,
    })
    .eq("id", row.id)

  if (updateError) {
    console.error("supabase update error", updateError)
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=error`, 303)
  }

  const displayName = row.display_name?.trim() || "(名無し)"
  const sourcesArr = Array.isArray(row.sources) ? (row.sources as string[]) : []
  const labels = sourcesArr.map((s) => sourceLabel(s)).join(", ") || "(未選択)"

  const { count: confirmedCount, error: countError } = await supabase
    .from("subscribers")
    .select("*", { count: "exact", head: true })
    .eq("confirmed", true)
    .is("unsubscribed_at", null)
  if (countError) {
    console.error("supabase count error", countError)
  }
  const ordinal =
    typeof confirmedCount === "number" ? `(${confirmedCount}人目)` : ""

  const emailDomain = row.email.includes("@")
    ? row.email.slice(row.email.lastIndexOf("@") + 1).toLowerCase()
    : ""
  const slackText = [
    `ニュースレター新規登録${ordinal}🎉`,
    `・${slackEscape(displayName)}`,
    `・${slackEscape(row.email)}`,
    `・${slackEscape(labels)}`,
  ].join("\n")
  const slackBlocks = [
    { type: "section", text: { type: "mrkdwn", text: slackText } },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          style: "danger",
          text: { type: "plain_text", text: "BAN", emoji: false },
          action_id: "ban_subscriber",
          value: JSON.stringify({ subscriberId: row.id }),
          confirm: {
            title: { type: "plain_text", text: "BANしますか？" },
            text: {
              type: "plain_text",
              text: `${displayName} (${row.email}) をBANし、以降の投稿・いいね等を不可にします。`,
            },
            confirm: { type: "plain_text", text: "BANする" },
            deny: { type: "plain_text", text: "キャンセル" },
          },
        },
        {
          type: "button",
          text: { type: "plain_text", text: "ブロックリスト追加", emoji: false },
          action_id: "block_email_domain",
          value: JSON.stringify({ domain: emailDomain, subscriberId: row.id }),
          confirm: {
            title: { type: "plain_text", text: "ドメインを追加しますか？" },
            text: {
              type: "plain_text",
              text: `${emailDomain} を以後の購読登録不可にします。`,
            },
            confirm: { type: "plain_text", text: "追加する" },
            deny: { type: "plain_text", text: "キャンセル" },
          },
        },
      ],
    },
  ]
  void postSlackMessage(slackText, slackBlocks)

  const target = next
    ? `${site}${appendQueryFlag(next, "subscribed", "1")}`
    : `${site}/subscribe/confirmed?status=ok`
  const response = NextResponse.redirect(target, 303)
  const sessionToken = await issueSession(row.id)
  if (sessionToken) {
    response.cookies.set(
      SESSION_COOKIE,
      sessionToken,
      getSessionCookieAttrs(SESSION_TTL_MS),
    )
  }
  return response
}
