import "server-only"

import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"

function escapeMrkdwn(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function slackLink(url: string, text: string): string {
  return `<${url}|${escapeMrkdwn(text)}>`
}

export function slackEscape(value: string): string {
  return escapeMrkdwn(value)
}

export type SlackBlock = Record<string, unknown>

export type SlackPostResult = {
  ok: boolean
  ts?: string
  channel?: string
  error?: string
}

function getBotToken(): string | null {
  return process.env.SLACK_BOT_TOKEN?.trim() || null
}

function getChannelId(): string | null {
  return process.env.SLACK_CHANNEL_ID?.trim() || null
}

export function isSlackInteractivityConfigured(): boolean {
  return Boolean(getBotToken() && getChannelId())
}

export async function postSlackMessage(
  text: string,
  blocks?: SlackBlock[],
): Promise<SlackPostResult> {
  const botToken = getBotToken()
  const channel = getChannelId()
  if (botToken && channel) {
    return postViaApi({ botToken, channel, text, blocks })
  }
  return postViaWebhook(text)
}

async function postViaApi(opts: {
  botToken: string
  channel: string
  text: string
  blocks?: SlackBlock[]
}): Promise<SlackPostResult> {
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${opts.botToken}`,
      },
      body: JSON.stringify({
        channel: opts.channel,
        text: opts.text,
        blocks: opts.blocks,
      }),
    })
    const json = (await res.json()) as {
      ok: boolean
      ts?: string
      channel?: string
      error?: string
    }
    if (!json.ok) {
      console.error("Slack chat.postMessage error", json)
      return { ok: false, error: json.error ?? "unknown" }
    }
    return { ok: true, ts: json.ts, channel: json.channel }
  } catch (err) {
    console.error("Slack chat.postMessage failed", err)
    return { ok: false, error: "request_failed" }
  }
}

async function postViaWebhook(text: string): Promise<SlackPostResult> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim()
  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[dev] SLACK_WEBHOOK_URL not set. Skipping Slack notification.")
    }
    return { ok: false, error: "not_configured" }
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error("Slack webhook error", res.status, detail)
      return { ok: false, error: `webhook_${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    console.error("Slack webhook request failed", err)
    return { ok: false, error: "request_failed" }
  }
}

export async function postSlackThreadReply(opts: {
  channel: string
  threadTs: string
  text: string
}): Promise<void> {
  const botToken = getBotToken()
  if (!botToken) return
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        channel: opts.channel,
        thread_ts: opts.threadTs,
        text: opts.text,
      }),
    })
    const json = (await res.json()) as { ok: boolean; error?: string }
    if (!json.ok) {
      console.error("Slack thread reply error", json)
    }
  } catch (err) {
    console.error("Slack thread reply failed", err)
  }
}

export function verifySlackSignature(opts: {
  rawBody: string
  timestamp: string
  signature: string
}): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET?.trim()
  if (!secret) return false
  const ts = parseInt(opts.timestamp, 10)
  if (!Number.isFinite(ts)) return false
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > 60 * 5) return false
  const base = `v0:${opts.timestamp}:${opts.rawBody}`
  const expected =
    "v0=" + crypto.createHmac("sha256", secret).update(base).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(opts.signature)
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function resolveBlogPostTitle(postPath: string): Promise<string | null> {
  const m = postPath.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/([^/]+)\/?$/)
  if (!m) return null
  const [, year, month, day, slug] = m
  const filePath = path.join(process.cwd(), "content", "blog", year, month, day, `${slug}.mdx`)
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const fm = raw.match(/^---\s*\n([\s\S]*?)\n---/)
    if (!fm) return null
    const titleMatch = fm[1].match(/^title:\s*(.+?)\s*$/m)
    if (!titleMatch) return null
    return titleMatch[1].replace(/^["'](.*)["']$/, "$1").trim() || null
  } catch {
    return null
  }
}
