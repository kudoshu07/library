import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"
import { requireOwner } from "@/lib/admin-guard"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Returns the deduplicated set of tags used across the published blog
// (content/blog/**/*.mdx). The editor's tag selector seeds its options from
// this so the owner can pick from existing categories rather than typing
// fresh strings every time. New tags can still be added free-form.

const BLOG_ROOT = path.join(process.cwd(), "content", "blog")

async function listMdxFiles(dir: string): Promise<string[]> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return listMdxFiles(fullPath)
      if (entry.isFile() && fullPath.endsWith(".mdx")) return [fullPath]
      return []
    }),
  )
  return nested.flat()
}

function extractTags(raw: string): string[] {
  if (!raw.startsWith("---\n")) return []
  const end = raw.indexOf("\n---\n", 4)
  if (end === -1) return []
  const frontmatter = raw.slice(4, end)
  const tagsLineMatch = frontmatter.match(/^tags:\s*(.*)$/m)
  if (!tagsLineMatch) return []
  const value = tagsLineMatch[1].trim()
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((t) => t.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean)
  }
  // Block list under a bare `tags:` key — collect "  - ..." entries.
  if (!value) {
    const linesAfter = frontmatter.slice(frontmatter.indexOf("tags:") + 5).split("\n").slice(1)
    const tags: string[] = []
    for (const line of linesAfter) {
      const m = line.match(/^\s*-\s+(.+)$/)
      if (!m) break
      tags.push(m[1].trim().replace(/^["']|["']$/g, ""))
    }
    return tags
  }
  return []
}

export async function GET() {
  const guard = await requireOwner()
  if (!guard.ok) {
    return NextResponse.json({ error: "not_found" }, { status: guard.status })
  }

  try {
    const files = await listMdxFiles(BLOG_ROOT)
    const tagSet = new Set<string>()
    await Promise.all(
      files.map(async (file) => {
        try {
          const raw = await fs.readFile(file, "utf-8")
          for (const tag of extractTags(raw)) {
            const trimmed = tag.trim()
            if (trimmed) tagSet.add(trimmed)
          }
        } catch {
          // skip unreadable files
        }
      }),
    )
    const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b))
    return NextResponse.json({ tags })
  } catch (err) {
    console.error("known-tags error", err)
    return NextResponse.json({ error: "list_failed" }, { status: 500 })
  }
}
