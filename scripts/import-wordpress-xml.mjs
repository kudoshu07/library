#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"

const DEFAULT_INPUT = "WordPress.2026-02-19.xml"
const DEFAULT_OUTPUT_ROOT = "content/blog"
const DEFAULT_LIMIT = 10
const JST_OFFSET = "+09:00"

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    limit: DEFAULT_LIMIT,
    write: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === "--input" && argv[i + 1]) {
      options.input = argv[i + 1]
      i += 1
      continue
    }
    if (token === "--output-root" && argv[i + 1]) {
      options.outputRoot = argv[i + 1]
      i += 1
      continue
    }
    if (token === "--limit" && argv[i + 1]) {
      const limit = Number.parseInt(argv[i + 1], 10)
      if (!Number.isNaN(limit) && limit > 0) {
        options.limit = limit
      }
      i += 1
      continue
    }
    if (token === "--write") {
      options.write = true
    }
  }

  return options
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function decodeHtmlEntities(input) {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
}

function normalizeMediaUrl(url) {
  if (!url) return ""
  return decodeHtmlEntities(url).trim().replace(/^http:\/\//i, "https://")
}

function normalizeWpHtml(html) {
  if (!html) return ""

  return html
    .replace(/<!--\s*\/?wp:[\s\S]*?-->/g, "")
    .replace(/(?:\r\n|\r)/g, "\n")
    .replace(/\s*<figcaption>\s*<br\s*\/?>\s*<\/figcaption>\s*/gi, "")
    .replace(/(\s(?:src|href)=["'])http:\/\//gi, "$1https://")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function stripHtmlToText(html) {
  const withoutWpComments = html.replace(/<!--[\s\S]*?-->/g, " ")
  const withLineBreaks = withoutWpComments
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<h1[^>]*>/gi, "\n# ")
    .replace(/<h2[^>]*>/gi, "\n## ")
    .replace(/<h3[^>]*>/gi, "\n### ")
    .replace(/<h[4-6][^>]*>/gi, "\n#### ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/(ul|ol|blockquote|figure|div|section|article)>/gi, "\n\n")
    .replace(/<(ul|ol|blockquote|figure|div|section|article)[^>]*>/gi, "\n")
  const withoutTags = withLineBreaks.replace(/<[^>]+>/g, " ")
  const decoded = decodeHtmlEntities(withoutTags)
  return decoded
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function stripTextForSummary(input) {
  return input.replace(/\s+/g, " ").trim()
}

function truncate(input, length) {
  if (input.length <= length) return input
  return `${input.slice(0, length - 3).trim()}...`
}

function toIsoFromWpDate(localDate, gmtDate) {
  const gmt = gmtDate?.trim()
  if (gmt && gmt !== "0000-00-00 00:00:00") {
    const date = new Date(`${gmt.replace(" ", "T")}Z`)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  const local = localDate?.trim()
  if (!local || local === "0000-00-00 00:00:00") {
    return new Date(0).toISOString()
  }
  const date = new Date(`${local.replace(" ", "T")}${JST_OFFSET}`)
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString()
  }
  return new Date(0).toISOString()
}

function getTag(block, tagName) {
  const safe = escapeRegExp(tagName)
  const cdata = block.match(new RegExp(`<${safe}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${safe}>`))
  if (cdata?.[1]) return cdata[1].trim()
  const plain = block.match(new RegExp(`<${safe}>([\\s\\S]*?)<\\/${safe}>`))
  if (plain?.[1]) return plain[1].trim()
  return ""
}

function getCategories(block) {
  const matches = [...block.matchAll(/<category\s+domain="([^"]+)"\s+nicename="([^"]*)"><!\[CDATA\[([\s\S]*?)\]\]><\/category>/g)]
  return matches.map(([, domain, nicename, label]) => ({
    domain: domain.trim(),
    nicename: nicename.trim(),
    label: label.trim(),
  }))
}

function getPostMetaMap(block) {
  const map = new Map()
  const metaBlocks = [...block.matchAll(/<wp:postmeta>([\s\S]*?)<\/wp:postmeta>/g)].map((m) => m[1])
  for (const metaBlock of metaBlocks) {
    const key = getTag(metaBlock, "wp:meta_key")
    if (!key) continue
    const value = getTag(metaBlock, "wp:meta_value")
    map.set(key, value)
  }
  return map
}

function buildFrontmatter({ title, dateIso, slug, summary, tags, thumbnail }) {
  const lines = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `date: ${JSON.stringify(dateIso)}`,
    `slug: ${JSON.stringify(slug)}`,
  ]

  if (summary) {
    lines.push(`summary: ${JSON.stringify(summary)}`)
  }

  if (tags.length > 0) {
    lines.push(`tags: [${tags.map((tag) => JSON.stringify(tag)).join(", ")}]`)
  }

  if (thumbnail) {
    lines.push(`thumbnail: ${JSON.stringify(thumbnail)}`)
  }

  lines.push("---")
  return lines.join("\n")
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const xml = await fs.readFile(options.input, "utf8")
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1])
  const attachmentUrlById = new Map()

  for (const block of itemBlocks) {
    if (getTag(block, "wp:post_type") !== "attachment") continue
    const attachmentId = getTag(block, "wp:post_id")
    const attachmentUrl = normalizeMediaUrl(getTag(block, "wp:attachment_url"))
    if (!attachmentId || !attachmentUrl) continue
    attachmentUrlById.set(attachmentId, attachmentUrl)
  }

  const posts = itemBlocks
    .map((block) => {
      const postType = getTag(block, "wp:post_type")
      const status = getTag(block, "wp:status")
      if (postType !== "post" || status !== "publish") return null

      const title = decodeHtmlEntities(getTag(block, "title"))
      const slug = getTag(block, "wp:post_name")
      const dateLocal = getTag(block, "wp:post_date")
      const dateGmt = getTag(block, "wp:post_date_gmt")
      const contentRaw = getTag(block, "content:encoded")
      const contentHtml = normalizeWpHtml(contentRaw)
      const excerptRaw = stripHtmlToText(getTag(block, "excerpt:encoded"))
      const categories = getCategories(block)
      const postMeta = getPostMetaMap(block)

      if (!slug || !dateLocal) return null

      const plainBody = stripHtmlToText(contentHtml)
      const featuredId = postMeta.get("_thumbnail_id")?.trim() || ""
      const featuredThumbnail = attachmentUrlById.get(featuredId) || ""
      const firstImage = normalizeMediaUrl(contentHtml.match(/<img[^>]*src="([^"]+)"/i)?.[1] || "")
      const thumbnail = featuredThumbnail || firstImage || undefined
      const summaryBase = excerptRaw || stripTextForSummary(plainBody)
      const summary = summaryBase ? truncate(summaryBase, 140) : ""
      const tags = Array.from(
        new Set(
          categories
            .filter((cat) => cat.domain === "post_tag" || cat.domain === "category")
            .map((cat) => cat.nicename || cat.label)
            .map((tag) => tag.trim())
            .filter(Boolean)
        )
      ).slice(0, 12)

      const routeDate = dateLocal.slice(0, 10).split("-")
      if (routeDate.length !== 3) return null
      const [year, month, day] = routeDate

      return {
        title: title || slug,
        slug,
        year,
        month,
        day,
        dateLocal,
        dateIso: toIsoFromWpDate(dateLocal, dateGmt),
        summary,
        tags,
        thumbnail,
        body: contentHtml,
      }
    })
    .filter((post) => post !== null)
    .sort((a, b) => new Date(b.dateLocal).getTime() - new Date(a.dateLocal).getTime())
    .slice(0, options.limit)

  if (posts.length === 0) {
    console.log("No publish posts found.")
    return
  }

  const outputs = posts.map((post) => {
    const dirPath = path.join(options.outputRoot, post.year, post.month, post.day)
    const filePath = path.join(dirPath, `${post.slug}.mdx`)
    const frontmatter = buildFrontmatter({
      title: post.title,
      dateIso: post.dateIso,
      slug: post.slug,
      summary: post.summary,
      tags: post.tags,
      thumbnail: post.thumbnail,
    })
    const content = `${frontmatter}\n${post.body ? `\n${post.body}\n` : "\n"}`
    return { filePath, content, title: post.title, dateLocal: post.dateLocal }
  })

  if (!options.write) {
    console.log(`Dry run: ${outputs.length} files would be generated.`)
    for (const output of outputs) {
      console.log(`- ${output.filePath} :: ${output.title} (${output.dateLocal})`)
    }
    console.log("Add --write to create files.")
    return
  }

  for (const output of outputs) {
    await fs.mkdir(path.dirname(output.filePath), { recursive: true })
    await fs.writeFile(output.filePath, output.content, "utf8")
  }

  console.log(`Generated ${outputs.length} files.`)
  for (const output of outputs) {
    console.log(`- ${output.filePath}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
