#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const OUT_FILE = path.join(ROOT, "content", "external", "note-fallback.json")
const NOTE_RSS_URL = process.env.NOTE_RSS_URL || "https://note.com/onoshu1127/rss"

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripHtml(html) {
  return decodeHtml(String(html || ""))
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractTag(block, tag) {
  const cdata = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"))
  if (cdata?.[1]) return cdata[1].trim()
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))
  return plain?.[1]?.trim() || ""
}

function simpleHash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12)
}

function parseRss(xml) {
  const itemBlocks = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).map((m) => m[1] || "")
  const items = itemBlocks
    .map((block) => {
      const title = decodeHtml(extractTag(block, "title"))
      const link = decodeHtml(extractTag(block, "link"))
      const pubDate = extractTag(block, "pubDate")
      const description = extractTag(block, "description")
      const thumbnail = description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || undefined
      const summary = stripHtml(description)
      const date = new Date(pubDate)
      if (!title || !link || Number.isNaN(date.getTime())) return null

      return {
        id: `note:rss:${simpleHash(link)}`,
        source: "note",
        title,
        date: date.toISOString(),
        url: link,
        summary: summary || undefined,
        thumbnail,
      }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return items
}

async function main() {
  const res = await fetch(NOTE_RSS_URL, {
    headers: { "User-Agent": "KudoShuLibraryBot/1.0 (+https://kudoshu07.com)" },
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch note RSS: ${res.status}`)
  }
  const xml = await res.text()
  const items = parseRss(xml)
  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true })
  await fs.writeFile(OUT_FILE, `${JSON.stringify(items, null, 2)}\n`, "utf8")
  process.stdout.write(`[sync-note] wrote ${items.length} items -> ${OUT_FILE}\n`)
}

main().catch((error) => {
  console.error(`[sync-note] ERROR: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})

