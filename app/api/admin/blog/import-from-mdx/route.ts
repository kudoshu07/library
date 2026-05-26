import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { requireOwner } from "@/lib/admin-guard"
import { createDraft, findDraftBySourcePath } from "@/lib/blog-drafts"
import { parseMdxFile } from "@/lib/mdx-serializer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Pulls an existing published MDX post into a fresh draft so it can be
// edited in the Notion-style editor. The "Edit" button on a published post
// page POSTs here; we either reuse an in-progress draft (if there's already
// one open for the same source_path — avoids duplicating work if the user
// double-clicked) or create a new one.
//
// Body shape: { path: "content/blog/YYYY/MM/DD/slug.mdx" }
//
// Returns: { draftId, reused: boolean }

const bodySchema = z
  .object({
    path: z
      .string()
      .min(1)
      .max(500)
      .regex(/^content\/blog\//, "path_must_be_blog")
      .regex(/\.mdx$/, "path_must_be_mdx")
      .refine((p) => !p.includes(".."), { message: "path_traversal" }),
  })
  .strict()

function isUnderBlogRoot(repoPath: string): boolean {
  const blogRoot = path.resolve(process.cwd(), "content", "blog") + path.sep
  const resolved = path.resolve(process.cwd(), repoPath)
  return resolved.startsWith(blogRoot)
}

export async function POST(req: Request) {
  const guard = await requireOwner()
  if (!guard.ok) {
    return NextResponse.json({ error: "not_found" }, { status: guard.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid_input" },
      { status: 400 },
    )
  }
  const { path: repoPath } = parsed.data
  if (!isUnderBlogRoot(repoPath)) {
    return NextResponse.json({ error: "path_outside_blog" }, { status: 400 })
  }

  // Reuse an existing draft for the same source if any — keeps the editor
  // history coherent if the user clicks "編集" twice.
  try {
    const existing = await findDraftBySourcePath(guard.session.subscriberId, repoPath)
    if (existing) {
      return NextResponse.json({ draftId: existing.id, reused: true })
    }
  } catch (err) {
    console.error("import: findDraftBySourcePath failed", err)
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 })
  }

  // Read the MDX from the local filesystem. On Vercel, this reflects what
  // was bundled at build time — fine for editing posts that already exist
  // on the deployed site. If the file isn't there, the user is trying to
  // edit a post that never made it to this deployment.
  let raw: string
  try {
    raw = await fs.readFile(path.join(process.cwd(), repoPath), "utf-8")
  } catch (err) {
    console.error("import: read mdx failed", err)
    return NextResponse.json({ error: "mdx_not_found" }, { status: 404 })
  }

  const { frontmatter, body: bodyHtml } = parseMdxFile(raw)

  // Note: HTML → BlockNote blocks conversion happens client-side in the
  // editor (see BlocknoteCanvas). Doing it server-side would require
  // @blocknote/server-util which transitively pulls in browser React
  // internals and trips Turbopack's server compilation. The user's editor
  // session has the same parser available, with no SSR hazards.

  try {
    const draft = await createDraft({
      ownerSubscriberId: guard.session.subscriberId,
      title: frontmatter.title,
      slug: frontmatter.slug,
      publishDate: frontmatter.date || null,
      summary: frontmatter.summary,
      tags: frontmatter.tags,
      thumbnailUrl: frontmatter.thumbnail ?? null,
      bodyHtml,
      bodyBlocks: null,
      sourcePath: repoPath,
    })
    return NextResponse.json({ draftId: draft.id, reused: false }, { status: 201 })
  } catch (err) {
    console.error("import: createDraft failed", err)
    return NextResponse.json({ error: "create_failed" }, { status: 500 })
  }
}
