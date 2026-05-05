#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const CONTENT_ROOT = path.join(ROOT, "content")
const BLOG_ROOT = path.join(CONTENT_ROOT, "blog")
const EXTERNAL_ROOT = path.join(CONTENT_ROOT, "external")

const SUPABASE_URL = process.env.SUPABASE_URL?.trim()
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim()
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://kudoshu07.com").replace(/\/$/, "")
const FROM_EMAIL = process.env.NEWSLETTER_FROM_EMAIL?.trim() || "Kudo Shu Library <onboarding@resend.dev>"
const REPLY_TO = process.env.NEWSLETTER_REPLY_TO?.trim() || undefined
const DRY_RUN = process.env.NEWSLETTER_DRY_RUN === "1"
const MAX_ITEMS_PER_EMAIL = 10
const SEND_DELAY_MS = 600

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("[newsletter] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. Skipping.")
  process.exit(0)
}
if (!RESEND_API_KEY && !DRY_RUN) {
  console.warn("[newsletter] RESEND_API_KEY not set. Skipping.")
  process.exit(0)
}

const SOURCE_LABELS = {
  blog: "Blog",
  note: "note(個人)",
  ig_business: "kudoshu_vcook",
  ig_photo: "onoshu_photo(写真)",
}

const PALETTE = {
  primary: "#264F8B",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  background: "#F8FAFC",
}

const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c] ?? c)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) return { data: {}, body: raw.trim() }
  const end = raw.indexOf("\n---\n", 4)
  if (end === -1) return { data: {}, body: raw.trim() }
  const fm = raw.slice(4, end).trim()
  const body = raw.slice(end + 5).trim()
  const data = {}
  for (const line of fm.split("\n")) {
    const sep = line.indexOf(":")
    if (sep === -1) continue
    const key = line.slice(0, sep).trim()
    const value = stripQuotes(line.slice(sep + 1).trim())
    data[key] = value
  }
  return { data, body }
}

function stripMarkdown(input) {
  return String(input)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function makeSummary(body) {
  const text = stripMarkdown(body)
  if (!text) return ""
  return text.length <= 140 ? text : `${text.slice(0, 140).trim()}...`
}

function toAbsoluteUrl(value) {
  if (!value) return undefined
  const v = String(value).trim()
  if (!v) return undefined
  if (/^https?:\/\//i.test(v)) return v
  return `${SITE_URL}${v.startsWith("/") ? v : `/${v}`}`
}

async function listMdxFiles(dir) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await listMdxFiles(full)))
    else if (entry.isFile() && full.endsWith(".mdx")) out.push(full)
  }
  return out
}

async function readJsonArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function loadBlogItems() {
  const files = await listMdxFiles(BLOG_ROOT)
  const items = []
  for (const filepath of files) {
    const rel = path.relative(BLOG_ROOT, filepath)
    const parts = rel.split(path.sep)
    if (parts.length < 4) continue
    const [year, month, day, filename] = parts
    const slug = filename.replace(/\.mdx$/, "")
    const raw = await fs.readFile(filepath, "utf-8")
    const { data, body } = parseFrontmatter(raw)
    const title = String(data.title ?? slug.replace(/-/g, " ")).trim()
    const dateStr = String(data.date ?? `${year}-${month}-${day}T00:00:00.000Z`)
    const summary = String(data.summary ?? makeSummary(body)).trim()
    const thumbRaw = typeof data.thumbnail === "string" ? data.thumbnail.trim() : ""
    const thumbnail = toAbsoluteUrl(thumbRaw)
    items.push({
      id: `blog:${year}${month}${day}:${slug}`,
      source: "blog",
      title,
      date: new Date(dateStr).toISOString(),
      url: `${SITE_URL}/${year}/${month}/${day}/${slug}/`,
      summary: summary || undefined,
      thumbnail,
    })
  }
  return items
}

async function loadJsonItems(fileName, source) {
  const seeds = await readJsonArray(path.join(EXTERNAL_ROOT, fileName))
  return seeds
    .filter((seed) => seed && seed.id && seed.title && seed.url)
    .map((seed) => ({
      id: String(seed.id),
      source,
      title: String(seed.title).trim(),
      date: new Date(seed.date ?? Date.now()).toISOString(),
      url: String(seed.url),
      summary: seed.summary ? String(seed.summary).trim() : undefined,
      thumbnail: toAbsoluteUrl(seed.thumbnail),
    }))
}

async function loadAllCurrentItems() {
  const [blog, igBusiness, igPhoto, note] = await Promise.all([
    loadBlogItems(),
    loadJsonItems("instagram-business.json", "ig_business"),
    loadJsonItems("instagram-photo.json", "ig_photo"),
    loadJsonItems("note-fallback.json", "note"),
  ])
  return [...blog, ...igBusiness, ...igPhoto, ...note]
}

function emailLayout({ previewText, bodyHtml }) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kudo Shu Library</title>
  </head>
  <body style="margin:0;padding:0;background:${PALETTE.background};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',Meiryo,sans-serif;color:${PALETTE.text};">
    <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(previewText)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PALETTE.background};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${PALETTE.border};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid ${PALETTE.border};">
                <a href="${escapeHtml(SITE_URL)}" style="color:${PALETTE.primary};font-weight:700;font-size:16px;text-decoration:none;letter-spacing:0.02em;">Kudo Shu Library</a>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">${bodyHtml}</td>
            </tr>
            <tr>
              <td style="padding:20px 28px;border-top:1px solid ${PALETTE.border};color:${PALETTE.muted};font-size:12px;line-height:1.6;">
                Kudo Shu Library — <a href="${escapeHtml(SITE_URL)}" style="color:${PALETTE.muted};">${escapeHtml(SITE_URL.replace(/^https?:\/\//, ""))}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function renderNotificationEmail({ items, unsubscribeUrl }) {
  const count = items.length
  const subject =
    count === 1 ? `[Kudo Shu Library] 新着: ${items[0].title}` : `[Kudo Shu Library] 新着コンテンツ ${count} 件`
  const previewText = count === 1 ? items[0].title : `${items[0].title} ほか ${count - 1} 件`

  const itemsHtml = items
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
                ${escapeHtml(SOURCE_LABELS[item.source] ?? item.source)}
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
    count === 1 ? "新着コンテンツ" : `新着コンテンツ <span style="color:${PALETTE.muted};font-weight:500;">(${count})</span>`

  const bodyHtml = `
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;">${heading}</h1>
    ${itemsHtml}
    <hr style="border:0;border-top:1px solid ${PALETTE.border};margin:24px 0;" />
    <p style="margin:0;font-size:12px;line-height:1.7;color:${PALETTE.muted};">
      配信を停止するには
      <a href="${escapeHtml(unsubscribeUrl)}" style="color:${PALETTE.muted};text-decoration:underline;">こちら</a>
      をクリックしてください。
    </p>`

  const text = [
    count === 1 ? "新着コンテンツ" : `新着コンテンツ ${count} 件`,
    "",
    ...items.map((item) => {
      const lines = [`【${SOURCE_LABELS[item.source] ?? item.source}】 ${item.title}`, item.url]
      if (item.summary) lines.push(item.summary)
      return lines.join("\n")
    }),
    "",
    "---",
    `配信停止: ${unsubscribeUrl}`,
  ].join("\n\n")

  return { subject, html: emailLayout({ previewText, bodyHtml }), text }
}

async function fetchAllNotifiedIds(supabase) {
  const ids = new Set()
  const PAGE = 1000
  let from = 0
  // Loop in pages of 1000 (Supabase default max).
  for (;;) {
    const { data, error } = await supabase
      .from("notifications_log")
      .select("content_id")
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const row of data) ids.add(row.content_id)
    if (data.length < PAGE) break
    from += PAGE
  }
  return ids
}

async function fetchConfirmedSubscribers(supabase) {
  const { data, error } = await supabase
    .from("subscribers")
    .select("email, sources, unsubscribe_token")
    .eq("confirmed", true)
    .is("unsubscribed_at", null)
  if (error) throw error
  return data ?? []
}

async function main() {
  const supabaseOptions = {
    auth: { persistSession: false, autoRefreshToken: false },
  }
  // Node < 22 doesn't have native WebSocket. Supabase Realtime needs one even though we
  // don't subscribe to any channels here — supply `ws` as the transport when missing.
  if (typeof globalThis.WebSocket === "undefined") {
    const { default: ws } = await import("ws")
    supabaseOptions.realtime = { transport: ws }
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, supabaseOptions)

  const [items, notifiedIds] = await Promise.all([
    loadAllCurrentItems(),
    fetchAllNotifiedIds(supabase),
  ])

  console.log(`[newsletter] loaded ${items.length} items, ${notifiedIds.size} previously notified`)

  // First-run seeding: if the log is empty, mark every existing item as already-sent
  // without emailing. This prevents spamming subscribers with backlog on first deploy.
  if (notifiedIds.size === 0) {
    if (items.length === 0) {
      console.log("[newsletter] no items, nothing to seed")
      return
    }
    const rows = items.map((item) => ({
      content_id: item.id,
      source: item.source,
      title: item.title.slice(0, 500),
      url: item.url,
      recipient_count: 0,
    }))
    if (DRY_RUN) {
      console.log(`[newsletter] [dry-run] would seed ${rows.length} items`)
      return
    }
    // Insert in chunks to stay under request size limits.
    const CHUNK = 200
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK)
      const { error } = await supabase
        .from("notifications_log")
        .upsert(slice, { onConflict: "content_id", ignoreDuplicates: true })
      if (error) {
        console.error("[newsletter] seed insert error", error)
        process.exit(1)
      }
    }
    console.log(`[newsletter] seeded ${rows.length} items as already-sent`)
    return
  }

  const newItems = items.filter((item) => !notifiedIds.has(item.id))
  if (newItems.length === 0) {
    console.log("[newsletter] no new items")
    return
  }
  console.log(`[newsletter] ${newItems.length} new item(s)`)

  // Sort newest first and cap per email to avoid huge messages on backlog.
  newItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const subscribers = await fetchConfirmedSubscribers(supabase)
  console.log(`[newsletter] ${subscribers.length} confirmed subscriber(s)`)

  const recipientCount = new Map()
  for (const item of newItems) recipientCount.set(item.id, 0)

  const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

  let sent = 0
  let failed = 0
  for (const sub of subscribers) {
    const wanted = newItems.filter((item) => sub.sources?.includes(item.source))
    if (wanted.length === 0) continue
    const capped = wanted.slice(0, MAX_ITEMS_PER_EMAIL)
    const unsubscribeUrl = `${SITE_URL}/api/subscribe/unsubscribe?token=${encodeURIComponent(sub.unsubscribe_token)}`
    const message = renderNotificationEmail({ items: capped, unsubscribeUrl })

    if (DRY_RUN || !resend) {
      console.log(`[newsletter] [dry-run] -> ${sub.email}: "${message.subject}" (${capped.length} items)`)
      for (const item of capped) recipientCount.set(item.id, (recipientCount.get(item.id) ?? 0) + 1)
      sent += 1
      continue
    }

    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: sub.email,
        replyTo: REPLY_TO,
        subject: message.subject,
        html: message.html,
        text: message.text,
      })
      if (result.error) {
        console.error(`[newsletter] send failed for ${sub.email}`, result.error)
        failed += 1
      } else {
        for (const item of capped) recipientCount.set(item.id, (recipientCount.get(item.id) ?? 0) + 1)
        sent += 1
      }
    } catch (error) {
      console.error(`[newsletter] send threw for ${sub.email}`, error)
      failed += 1
    }
    await sleep(SEND_DELAY_MS)
  }

  console.log(`[newsletter] sent ${sent}, failed ${failed}`)

  // Always log the new items, even if no one was subscribed for that source. Otherwise we'd
  // re-attempt sending forever each run.
  const logRows = newItems.map((item) => ({
    content_id: item.id,
    source: item.source,
    title: item.title.slice(0, 500),
    url: item.url,
    recipient_count: recipientCount.get(item.id) ?? 0,
  }))

  if (DRY_RUN) {
    console.log(`[newsletter] [dry-run] would log ${logRows.length} items`)
    return
  }

  const CHUNK = 200
  for (let i = 0; i < logRows.length; i += CHUNK) {
    const slice = logRows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from("notifications_log")
      .upsert(slice, { onConflict: "content_id", ignoreDuplicates: true })
    if (error) {
      console.error("[newsletter] log insert error", error)
      process.exit(1)
    }
  }
}

main().catch((error) => {
  console.error("[newsletter] FATAL", error)
  process.exit(1)
})
