import "server-only"

import fs from "node:fs/promises"
import path from "node:path"

function escapeMrkdwn(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function slackLink(url: string, text: string): string {
  // Slack mrkdwn link: <url|text>
  return `<${url}|${escapeMrkdwn(text)}>`
}

export function slackEscape(value: string): string {
  return escapeMrkdwn(value)
}

export async function postSlackMessage(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim()
  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[dev] SLACK_WEBHOOK_URL not set. Skipping Slack notification.")
    }
    return
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
    }
  } catch (err) {
    console.error("Slack webhook request failed", err)
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
