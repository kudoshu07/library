import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"
import { requireOwner } from "@/lib/admin-guard"
import { deleteDraft, getDraftForOwner } from "@/lib/blog-drafts"
import {
  blogPostPath,
  blogPostUrl,
  buildMdxFile,
  isValidSlug,
  type BlogFrontmatter,
} from "@/lib/mdx-serializer"
import { commitFileChanges, fileExists, type FileChange } from "@/lib/github-publisher"
import {
  deleteDraftImages,
  fetchDraftImageBase64,
  findDraftImageReferences,
  rewriteImageSrc,
} from "@/lib/blog-image-storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ id: string }> }

const BLOG_ROOT_REL = "content/blog"

// Probe the local repo tree first so we don't waste a GitHub round-trip when
// the slug obviously collides with a file already on disk. On Vercel the
// running deployment sees whatever was bundled at build time, which is the
// canonical source for the "is this slug taken?" question except in the
// brief window where a newer post was just committed and the deploy hasn't
// finished — for that gap we also probe GitHub directly.
async function localFileExists(repoPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(process.cwd(), repoPath))
    return true
  } catch {
    return false
  }
}

export async function POST(_req: Request, { params }: RouteContext) {
  const guard = await requireOwner()
  if (!guard.ok) {
    return NextResponse.json({ error: "not_found" }, { status: guard.status })
  }

  const { id } = await params

  let draft
  try {
    draft = await getDraftForOwner(guard.session.subscriberId, id)
  } catch (err) {
    console.error("publish: load draft failed", err)
    return NextResponse.json({ error: "load_failed" }, { status: 500 })
  }
  if (!draft) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  // --- Validate ---
  const title = draft.title.trim()
  const slug = draft.slug.trim()
  const summary = draft.summary.trim()
  const tags = draft.tags.filter((t) => t.trim()).map((t) => t.trim())
  const thumbnail = draft.thumbnail_url?.trim() || undefined
  const bodyHtml = draft.body_html.trim()

  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 })
  if (!draft.publish_date)
    return NextResponse.json({ error: "publish_date_required" }, { status: 400 })
  if (!slug) return NextResponse.json({ error: "slug_required" }, { status: 400 })
  if (!isValidSlug(slug))
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 })

  let targetPath: string
  let publicUrl: string
  try {
    targetPath = blogPostPath({ date: draft.publish_date, slug })
    publicUrl = blogPostUrl({ date: draft.publish_date, slug })
  } catch (err) {
    console.error("publish: path build failed", err)
    return NextResponse.json({ error: "invalid_date_or_slug" }, { status: 400 })
  }

  // If we're editing an existing post and the slug/date hasn't changed, the
  // target == source and we'll just overwrite. If they HAVE changed, we'll
  // delete the old file and create the new one in the same commit. Either
  // way, the collision check below should ignore the source path.
  const sourcePath = draft.source_path && draft.source_path !== targetPath
    ? draft.source_path
    : null

  // --- Slug collision check ---
  // Try local FS first (cheap); fall back to GitHub for the freshly-committed
  // gap.
  if (targetPath !== draft.source_path) {
    let collides = await localFileExists(targetPath)
    if (!collides) {
      try {
        collides = await fileExists(targetPath)
      } catch (err) {
        console.error("publish: fileExists probe failed", err)
        return NextResponse.json({ error: "github_unreachable" }, { status: 502 })
      }
    }
    if (collides) {
      return NextResponse.json(
        { error: `slug_conflict:${publicUrl}` },
        { status: 409 },
      )
    }
  }

  // --- Resolve in-flight images ---
  // Any <img src="..."> in the body that points at the draft images
  // bucket needs to (a) move into the GitHub commit at public/{slug}/
  // and (b) have its URL rewritten to "/{slug}/{filename}" so the
  // published MDX follows the existing local-path convention. Doing
  // this here keeps the entire post — MDX + assets — atomic on a
  // single commit, so the site never has a stale image reference.
  const imageRefs = findDraftImageReferences(bodyHtml)
  const imageChanges: FileChange[] = []
  let rewrittenBody = bodyHtml
  for (const ref of imageRefs) {
    // storagePath is "{draftId}/{filename}"; filename is the last segment.
    const filename = ref.storagePath.split("/").pop()
    if (!filename) continue
    try {
      const { base64 } = await fetchDraftImageBase64(ref.storagePath)
      imageChanges.push({
        path: `public/${slug}/${filename}`,
        mode: "100644",
        type: "blob",
        contentBase64: base64,
      })
      rewrittenBody = rewriteImageSrc(rewrittenBody, ref.src, `/${slug}/${filename}`)
    } catch (err) {
      console.error("publish: image fetch failed", { storagePath: ref.storagePath, err })
      return NextResponse.json(
        { error: `image_fetch_failed:${filename}` },
        { status: 502 },
      )
    }
  }

  // --- Build MDX file (using rewritten body) ---
  const frontmatter: BlogFrontmatter = {
    title,
    date: draft.publish_date,
    slug,
    summary,
    tags,
    thumbnail,
  }
  const mdxContent = buildMdxFile(frontmatter, rewrittenBody)

  // --- Assemble the atomic commit ---
  // Order: optional old-file delete (rename case), the new MDX, then any
  // images. A single commit means Vercel sees the post and all its
  // assets together in one build, eliminating broken-image windows.
  const changes: FileChange[] = []
  if (sourcePath) {
    // Slug or date changed — delete old, create new in one atomic commit.
    changes.push({ path: sourcePath, sha: null })
  }
  changes.push({
    path: targetPath,
    mode: "100644",
    type: "blob",
    content: mdxContent,
  })
  changes.push(...imageChanges)

  const action = draft.source_path ? "update" : "publish"
  const commitMessage =
    action === "update"
      ? `chore(blog): update "${title}"`
      : `feat(blog): publish "${title}"`

  let commit
  try {
    commit = await commitFileChanges({ message: commitMessage, changes })
  } catch (err: unknown) {
    console.error("publish: commit failed", err)
    const message = err instanceof Error ? err.message : "commit_failed"
    if (message.startsWith("github_not_configured")) {
      return NextResponse.json({ error: "github_not_configured" }, { status: 500 })
    }
    return NextResponse.json({ error: "commit_failed" }, { status: 502 })
  }

  // --- Clean up: draft row + Storage copies of the images ---
  // Both are non-fatal: the post is already live, so any cleanup hiccup
  // just leaves orphan rows/blobs that can be tidied later.
  try {
    await deleteDraft(guard.session.subscriberId, id)
  } catch (err) {
    console.error("publish: post-publish draft cleanup failed", err)
  }
  if (imageRefs.length > 0) {
    void deleteDraftImages(id).catch((err) => {
      console.error("publish: storage cleanup failed", err)
    })
  }

  return NextResponse.json({
    ok: true,
    url: publicUrl,
    path: targetPath,
    commitSha: commit.commitSha,
    commitUrl: commit.commitUrl,
    imagesCommitted: imageChanges.length,
  })
}
