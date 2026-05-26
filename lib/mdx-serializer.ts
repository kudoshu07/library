/**
 * Serializer/deserializer for the blog post MDX format used by the editor UI.
 *
 * Existing posts (see content/blog/YYYY/MM/DD/{slug}.mdx) use a very minimal
 * frontmatter dialect — the parser in lib/content-loader.ts only handles
 *   key: "value"             (quoted strings)
 *   tags: ["a","b"]          (single-line JSON-ish array)
 *   tags:\n  - "a"\n  - "b"  (block-list arrays)
 *
 * So we only emit those exact shapes here, never anything richer (no nested
 * mappings, no multi-line strings). That keeps round-tripping with the
 * existing parser lossless.
 */

export type BlogFrontmatter = {
  title: string
  date: string // ISO 8601
  slug: string
  summary: string
  tags: string[]
  thumbnail?: string
}

function escapeQuotedString(value: string): string {
  // Existing posts use `"` for quoted strings. We support escaping " and
  // backslash; everything else (newlines, tabs) is rejected because the
  // simple parser in content-loader.ts can't handle them.
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function sanitizeSingleLine(value: string): string {
  // Collapse any newlines so frontmatter stays one-line-per-key.
  return value.replace(/\r?\n/g, " ").trim()
}

/**
 * Build the full MDX file content (frontmatter + body). The body is written
 * verbatim — typically the HTML output of BlockNote.
 */
export function buildMdxFile(frontmatter: BlogFrontmatter, bodyHtml: string): string {
  const fm = frontmatter
  const lines: string[] = ["---"]

  lines.push(`title: "${escapeQuotedString(sanitizeSingleLine(fm.title))}"`)
  lines.push(`date: "${fm.date}"`)
  lines.push(`slug: "${escapeQuotedString(fm.slug)}"`)
  lines.push(`summary: "${escapeQuotedString(sanitizeSingleLine(fm.summary))}"`)

  if (fm.tags && fm.tags.length > 0) {
    const inline = fm.tags
      .map((tag) => `"${escapeQuotedString(tag)}"`)
      .join(",")
    lines.push(`tags: [${inline}]`)
  } else {
    lines.push(`tags: []`)
  }

  if (fm.thumbnail && fm.thumbnail.trim()) {
    lines.push(`thumbnail: "${escapeQuotedString(fm.thumbnail.trim())}"`)
  }

  lines.push("---")
  lines.push("")
  lines.push(bodyHtml.trim())
  lines.push("") // trailing newline

  return lines.join("\n")
}

/**
 * Parse an MDX file produced by us (or hand-written in the existing style).
 * Mirrors the simple frontmatter parser in lib/content-loader.ts.
 */
export function parseMdxFile(raw: string): {
  frontmatter: BlogFrontmatter
  body: string
} {
  if (!raw.startsWith("---\n")) {
    return {
      frontmatter: emptyFrontmatter(),
      body: raw.trim(),
    }
  }

  const end = raw.indexOf("\n---\n", 4)
  if (end === -1) {
    return {
      frontmatter: emptyFrontmatter(),
      body: raw.trim(),
    }
  }

  const fmText = raw.slice(4, end).trim()
  const body = raw.slice(end + 5).trim()

  const data: Record<string, string | string[]> = {}
  const flines = fmText.split("\n")

  for (let i = 0; i < flines.length; i += 1) {
    const line = flines[i]
    const sep = line.indexOf(":")
    if (sep === -1) continue

    const key = line.slice(0, sep).trim()
    const value = line.slice(sep + 1).trim()

    if (key === "tags") {
      if (value.startsWith("[") && value.endsWith("]")) {
        data.tags = value
          .slice(1, -1)
          .split(",")
          .map((tag) => stripQuotes(tag.trim()))
          .filter(Boolean)
        continue
      }
      if (!value) {
        const tags: string[] = []
        while (i + 1 < flines.length && flines[i + 1].trim().startsWith("- ")) {
          i += 1
          tags.push(stripQuotes(flines[i].trim().slice(2).trim()))
        }
        data.tags = tags
        continue
      }
    }

    data[key] = stripQuotes(value)
  }

  return {
    frontmatter: {
      title: typeof data.title === "string" ? data.title : "",
      date: typeof data.date === "string" ? data.date : "",
      slug: typeof data.slug === "string" ? data.slug : "",
      summary: typeof data.summary === "string" ? data.summary : "",
      tags: Array.isArray(data.tags) ? data.tags : [],
      thumbnail: typeof data.thumbnail === "string" ? data.thumbnail : undefined,
    },
    body,
  }
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function emptyFrontmatter(): BlogFrontmatter {
  return {
    title: "",
    date: "",
    slug: "",
    summary: "",
    tags: [],
    thumbnail: undefined,
  }
}

/**
 * Build the relative repo path for a blog post given its publish date and
 * slug. Used for both new posts and rename detection.
 */
export function blogPostPath(params: { date: string; slug: string }): string {
  const d = new Date(params.date)
  if (Number.isNaN(d.getTime())) {
    throw new Error("blogPostPath: invalid date")
  }
  const y = String(d.getUTCFullYear())
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  const safeSlug = sanitizeSlug(params.slug)
  if (!safeSlug) throw new Error("blogPostPath: empty slug")
  return `content/blog/${y}/${m}/${day}/${safeSlug}.mdx`
}

/**
 * Build the public URL path for a blog post — matches how content-loader.ts
 * computes it from the filesystem path.
 */
export function blogPostUrl(params: { date: string; slug: string }): string {
  const d = new Date(params.date)
  if (Number.isNaN(d.getTime())) {
    throw new Error("blogPostUrl: invalid date")
  }
  const y = String(d.getUTCFullYear())
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  const safeSlug = sanitizeSlug(params.slug)
  return `/${y}/${m}/${day}/${safeSlug}/`
}

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug)
}

export function sanitizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}
