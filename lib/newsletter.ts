import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { sourceLabels, type ContentSource } from "@/lib/data"

export const SUBSCRIBABLE_SOURCES: ContentSource[] = [
  "blog",
  "note",
  "ig_business",
  "ig_photo",
  "pod_ochinashi",
  "pod_yonakoi",
  "pod_vegan",
]

export function isSubscribableSource(value: string): value is ContentSource {
  return (SUBSCRIBABLE_SOURCES as string[]).includes(value)
}

let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) return supabaseClient
  const url = process.env.SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error("supabase_not_configured")
  }
  supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return supabaseClient
}

let resendClient: Resend | null = null

export function getResendClient(): Resend {
  if (resendClient) return resendClient
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("resend_not_configured")
  }
  resendClient = new Resend(apiKey)
  return resendClient
}

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (raw) return raw.replace(/\/$/, "")
  return "https://kudoshu07.com"
}

export function getFromAddress(): string {
  return (
    process.env.NEWSLETTER_FROM_EMAIL?.trim() ||
    "Kudo Shu Library <onboarding@resend.dev>"
  )
}

export function getReplyTo(): string | undefined {
  return process.env.NEWSLETTER_REPLY_TO?.trim() || undefined
}

const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] ?? char)
}

export function sourceLabel(source: string): string {
  if (isSubscribableSource(source) && sourceLabels[source]) {
    return sourceLabels[source]
  }
  return source
}

const PALETTE = {
  primary: "#264F8B",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  background: "#F8FAFC",
}

function emailLayout(opts: { previewText: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kudo Shu Library</title>
  </head>
  <body style="margin:0;padding:0;background:${PALETTE.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',Meiryo,sans-serif;color:${PALETTE.text};">
    <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(opts.previewText)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PALETTE.background};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${PALETTE.border};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid ${PALETTE.border};">
                <a href="${escapeHtml(getSiteUrl())}" style="color:${PALETTE.primary};font-weight:700;font-size:16px;text-decoration:none;letter-spacing:0.02em;">Kudo Shu Library</a>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">${opts.bodyHtml}</td>
            </tr>
            <tr>
              <td style="padding:20px 28px;border-top:1px solid ${PALETTE.border};color:${PALETTE.muted};font-size:12px;line-height:1.6;">
                Kudo Shu Library — <a href="${escapeHtml(getSiteUrl())}" style="color:${PALETTE.muted};">${escapeHtml(getSiteUrl().replace(/^https?:\/\//, ""))}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function renderConfirmEmail(opts: {
  email: string
  displayName?: string | null
  confirmUrl: string
  sources: string[]
}): { subject: string; html: string; text: string } {
  const labels = opts.sources.map((s) => sourceLabel(s)).join(", ")
  const previewText = "登録を完了するには、ボタンをクリックしてください。"
  const greeting = opts.displayName
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;"><strong>${escapeHtml(opts.displayName)}</strong> さん、ご登録ありがとうございます。</p>`
    : ""
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:20px;line-height:1.4;">登録の確認</h1>
    ${greeting}
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;">
      Kudo Shu Library の更新通知を <strong>${escapeHtml(opts.email)}</strong> 宛に登録しようとしています。
      下のボタンをクリックして登録を完了してください。
    </p>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:${PALETTE.muted};">
      購読対象: ${escapeHtml(labels) || "(未選択)"}
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(opts.confirmUrl)}" style="display:inline-block;background:${PALETTE.primary};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">登録を確定する</a>
    </p>
    <p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:${PALETTE.muted};">
      ボタンが動作しない場合は、以下の URL をブラウザで開いてください。
    </p>
    <p style="margin:0;font-size:12px;line-height:1.7;color:${PALETTE.muted};word-break:break-all;">
      ${escapeHtml(opts.confirmUrl)}
    </p>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:${PALETTE.muted};">
      心当たりがない場合は、このメールを破棄してください。確認しない限り登録は完了しません。
    </p>`
  const textGreeting = opts.displayName
    ? `${opts.displayName} さん、ご登録ありがとうございます。\n\n`
    : ""
  const text = [
    "Kudo Shu Library の更新通知の登録",
    "",
    `${textGreeting}登録メール: ${opts.email}`,
    `購読対象: ${labels || "(未選択)"}`,
    "",
    "以下の URL を開いて登録を確定してください。",
    opts.confirmUrl,
    "",
    "心当たりがない場合は、このメールを破棄してください。",
  ].join("\n")
  return {
    subject: "[Kudo Shu Library] 登録の確認",
    html: emailLayout({ previewText, bodyHtml }),
    text,
  }
}

export function renderLoginEmail(opts: {
  email: string
  displayName: string | null
  verifyUrl: string
}): { subject: string; html: string; text: string } {
  const previewText = "ログインリンクをお送りします。"
  const greeting = opts.displayName
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;"><strong>${escapeHtml(opts.displayName)}</strong> さん、いつもありがとうございます。</p>`
    : ""
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:20px;line-height:1.4;">ログインリンク</h1>
    ${greeting}
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;">
      <strong>${escapeHtml(opts.email)}</strong> 宛のログインリンクです。
      下のボタンをクリックして Kudo Shu Library にログインしてください。
    </p>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(opts.verifyUrl)}" style="display:inline-block;background:${PALETTE.primary};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">ログインする</a>
    </p>
    <p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:${PALETTE.muted};">
      このリンクは 15 分で失効し、一度しか使えません。
    </p>
    <p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:${PALETTE.muted};">
      ボタンが動作しない場合は、以下の URL をブラウザで開いてください。
    </p>
    <p style="margin:0;font-size:12px;line-height:1.7;color:${PALETTE.muted};word-break:break-all;">
      ${escapeHtml(opts.verifyUrl)}
    </p>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:${PALETTE.muted};">
      心当たりがない場合は、このメールを破棄してください。
    </p>`
  const text = [
    "Kudo Shu Library のログインリンク",
    "",
    "以下の URL を 15 分以内に開いてログインしてください。リンクは一度しか使えません。",
    opts.verifyUrl,
    "",
    "心当たりがない場合は、このメールを破棄してください。",
  ].join("\n")
  return {
    subject: "[Kudo Shu Library] ログインリンク",
    html: emailLayout({ previewText, bodyHtml }),
    text,
  }
}

export function renderReplyNotificationEmail(opts: {
  recipientDisplayName: string | null
  replierDisplayName: string
  replyBody: string
  postUrl: string
  accountUrl: string
  unsubscribeUrl: string
}): { subject: string; html: string; text: string } {
  const subject = `[Kudo Shu Library] ${opts.replierDisplayName} さんから返信が届きました`
  const previewText = `${opts.replierDisplayName} さんがあなたのコメントに返信しました。`
  const greeting = opts.recipientDisplayName
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;"><strong>${escapeHtml(opts.recipientDisplayName)}</strong> さんへ</p>`
    : ""
  const truncated =
    opts.replyBody.length > 280
      ? `${opts.replyBody.slice(0, 280)}…`
      : opts.replyBody
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:20px;line-height:1.4;">返信が届きました</h1>
    ${greeting}
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;">
      <strong>${escapeHtml(opts.replierDisplayName)}</strong> さんがあなたのコメントに返信しました。
    </p>
    <blockquote style="margin:0 0 20px;padding:12px 16px;border-left:3px solid ${PALETTE.border};color:${PALETTE.text};font-size:14px;line-height:1.7;background:${PALETTE.background};border-radius:0 8px 8px 0;white-space:pre-wrap;">${escapeHtml(truncated)}</blockquote>
    <p style="margin:0 0 24px;">
      <a href="${escapeHtml(opts.postUrl)}" style="display:inline-block;background:${PALETTE.primary};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">返信を確認する</a>
    </p>
    <hr style="border:0;border-top:1px solid ${PALETTE.border};margin:24px 0;" />
    <p style="margin:0;font-size:12px;line-height:1.7;color:${PALETTE.muted};">
      返信メール通知の設定は
      <a href="${escapeHtml(opts.accountUrl)}" style="color:${PALETTE.muted};text-decoration:underline;">アカウント画面</a>
      から変更できます。メルマガ自体を停止する場合は
      <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${PALETTE.muted};text-decoration:underline;">こちら</a>
      から。
    </p>`
  const text = [
    `${opts.replierDisplayName} さんからの返信`,
    "",
    truncated,
    "",
    `返信を見る: ${opts.postUrl}`,
    "",
    "---",
    `通知設定の変更: ${opts.accountUrl}`,
    `メルマガを停止する: ${opts.unsubscribeUrl}`,
  ].join("\n")
  return {
    subject,
    html: emailLayout({ previewText, bodyHtml }),
    text,
  }
}

export type NotificationContentItem = {
  source: string
  title: string
  url: string
  summary?: string
  thumbnail?: string
  date?: string
}

export function renderNotificationEmail(opts: {
  items: NotificationContentItem[]
  unsubscribeUrl: string
}): { subject: string; html: string; text: string } {
  const count = opts.items.length
  const subject =
    count === 1
      ? `[Kudo Shu Library] 新着: ${opts.items[0].title}`
      : `[Kudo Shu Library] 新着コンテンツ ${count} 件`

  const previewText =
    count === 1
      ? opts.items[0].title
      : `${opts.items[0].title} ほか ${count - 1} 件`

  const itemsHtml = opts.items
    .map((item) => {
      const summary = item.summary ? escapeHtml(item.summary) : ""
      const thumb =
        item.thumbnail && /^https?:\/\//i.test(item.thumbnail)
          ? `<img src="${escapeHtml(item.thumbnail)}" alt="" width="120" height="120" style="display:block;width:120px;height:120px;border-radius:8px;object-fit:cover;border:1px solid ${PALETTE.border};" />`
          : ""
      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
          <tr>
            ${thumb ? `<td valign="top" width="120" style="padding-right:16px;">${thumb}</td>` : ""}
            <td valign="top">
              <div style="font-size:11px;letter-spacing:0.04em;text-transform:uppercase;color:${PALETTE.muted};margin-bottom:4px;">
                ${escapeHtml(sourceLabel(item.source))}
              </div>
              <a href="${escapeHtml(item.url)}" style="color:${PALETTE.text};text-decoration:none;font-weight:600;font-size:15px;line-height:1.45;">
                ${escapeHtml(item.title)}
              </a>
              ${summary ? `<p style="margin:6px 0 0;font-size:13px;line-height:1.6;color:${PALETTE.muted};">${summary}</p>` : ""}
            </td>
          </tr>
        </table>`
    })
    .join("")

  const heading =
    count === 1
      ? "新着コンテンツ"
      : `新着コンテンツ <span style="color:${PALETTE.muted};font-weight:500;">(${count})</span>`

  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;">${heading}</h1>
    ${itemsHtml}
    <hr style="border:0;border-top:1px solid ${PALETTE.border};margin:24px 0;" />
    <p style="margin:0;font-size:12px;line-height:1.7;color:${PALETTE.muted};">
      配信を停止するには
      <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${PALETTE.muted};text-decoration:underline;">こちら</a>
      をクリックしてください。
    </p>`

  const text = [
    count === 1 ? "新着コンテンツ" : `新着コンテンツ ${count} 件`,
    "",
    ...opts.items.map((item) => {
      const lines = [`【${sourceLabel(item.source)}】 ${item.title}`, item.url]
      if (item.summary) lines.push(item.summary)
      return lines.join("\n")
    }),
    "",
    "---",
    `配信停止: ${opts.unsubscribeUrl}`,
  ].join("\n\n")

  return {
    subject,
    html: emailLayout({ previewText, bodyHtml }),
    text,
  }
}
