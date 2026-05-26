import { notFound } from "next/navigation"
import type { PartialBlock } from "@blocknote/core"
import { BlogEditor, type BlogEditorInitial } from "@/components/blog-editor/blog-editor"
import { getOwnerSession } from "@/lib/admin-guard"
import { getDraftForOwner } from "@/lib/blog-drafts"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "下書き編集 | KSL Admin",
  robots: { index: false, follow: false },
}

type PageProps = { params: Promise<{ id: string }> }

export default async function EditDraftPage({ params }: PageProps) {
  const session = await getOwnerSession()
  if (!session) return null
  const { id } = await params
  const draft = await getDraftForOwner(session.subscriberId, id)
  if (!draft) notFound()

  // Normalize publish_date into strict ISO 8601 with "Z". Supabase returns
  // timestamptz columns in the "+00:00" form, which our save-time Zod
  // schema now also accepts, but normalizing here keeps the round-trip
  // canonical and the form input parsing trivially deterministic.
  const normalizedPublishDate = (() => {
    if (!draft.publish_date) return ""
    const d = new Date(draft.publish_date)
    return Number.isNaN(d.getTime()) ? "" : d.toISOString()
  })()

  const initial: BlogEditorInitial = {
    id: draft.id,
    meta: {
      title: draft.title,
      publishDate: normalizedPublishDate,
      slug: draft.slug,
      summary: draft.summary,
      tags: draft.tags,
      thumbnailUrl: draft.thumbnail_url ?? "",
    },
    bodyBlocks: Array.isArray(draft.body_blocks)
      ? (draft.body_blocks as PartialBlock[])
      : null,
    bodyHtml: draft.body_html,
    sourcePath: draft.source_path,
  }

  return <BlogEditor initial={initial} />
}
