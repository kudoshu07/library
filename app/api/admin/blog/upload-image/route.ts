import { NextResponse } from "next/server"
import { requireOwner } from "@/lib/admin-guard"
import { commitFileChanges, fileExists } from "@/lib/github-publisher"
import { sanitizeSlug } from "@/lib/mdx-serializer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
])

function extensionFor(mime: string, filename: string): string {
  switch (mime) {
    case "image/png": return "png"
    case "image/jpeg": return "jpg"
    case "image/webp": return "webp"
    case "image/gif": return "gif"
    case "image/svg+xml": return "svg"
    default:
      const fromName = filename.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase()
      if (fromName) return fromName
      return "bin"
  }
}

function safeBaseName(name: string): string {
  // Drop extension and any path/odd chars; keep ascii + dash + underscore.
  const noExt = name.replace(/\.[^.]+$/, "")
  return (
    noExt
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "image"
  )
}

export async function POST(req: Request) {
  const guard = await requireOwner()
  if (!guard.ok) {
    return NextResponse.json({ error: "not_found" }, { status: guard.status })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 })
  }

  const file = formData.get("file")
  const rawSlug = formData.get("slug")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 })
  }
  if (typeof rawSlug !== "string" || !rawSlug.trim()) {
    return NextResponse.json({ error: "slug_required" }, { status: 400 })
  }
  const slug = sanitizeSlug(rawSlug)
  if (!slug) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported_type:${file.type || "unknown"}` },
      { status: 415 },
    )
  }

  // Pick a non-colliding filename inside public/{slug}/. We add a short
  // timestamp+random suffix to avoid race conditions when the editor uploads
  // many images quickly, then double-check via the API.
  const base = safeBaseName(file.name || "image")
  const ext = extensionFor(file.type, file.name || "")
  const ts = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14) // YYYYMMDDHHMMSS
  const rand = Math.random().toString(36).slice(2, 6)
  const filename = `${base}-${ts}${rand}.${ext}`
  const repoPath = `public/${slug}/${filename}`
  const publicUrl = `/${slug}/${filename}`

  // Defensive: in case the same filename somehow already exists, refuse so we
  // don't silently overwrite an existing post asset.
  try {
    if (await fileExists(repoPath)) {
      return NextResponse.json(
        { error: "filename_collision" },
        { status: 409 },
      )
    }
  } catch (err) {
    console.error("fileExists probe failed", err)
    return NextResponse.json({ error: "github_unreachable" }, { status: 502 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString("base64")

  try {
    const commit = await commitFileChanges({
      message: `feat(blog): upload image for ${slug}`,
      changes: [
        {
          path: repoPath,
          mode: "100644",
          type: "blob",
          contentBase64: base64,
        },
      ],
    })
    return NextResponse.json({
      url: publicUrl,
      commitSha: commit.commitSha,
      commitUrl: commit.commitUrl,
    })
  } catch (err) {
    console.error("upload-image commit error", err)
    return NextResponse.json({ error: "commit_failed" }, { status: 502 })
  }
}
