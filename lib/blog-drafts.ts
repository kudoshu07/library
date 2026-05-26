import "server-only"

import { getSupabaseClient } from "@/lib/newsletter"

export type BlogDraftRow = {
  id: string
  owner_subscriber_id: string
  title: string
  slug: string
  publish_date: string | null
  summary: string
  tags: string[]
  thumbnail_url: string | null
  body_html: string
  body_blocks: unknown
  source_path: string | null
  created_at: string
  updated_at: string
}

const SELECT_COLUMNS =
  "id, owner_subscriber_id, title, slug, publish_date, summary, tags, thumbnail_url, body_html, body_blocks, source_path, created_at, updated_at"

export async function listDraftsForOwner(subscriberId: string): Promise<BlogDraftRow[]> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("blog_drafts")
    .select(SELECT_COLUMNS)
    .eq("owner_subscriber_id", subscriberId)
    .order("updated_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as BlogDraftRow[]
}

export async function getDraftForOwner(
  subscriberId: string,
  id: string,
): Promise<BlogDraftRow | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("blog_drafts")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .eq("owner_subscriber_id", subscriberId)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as BlogDraftRow | null
}

export async function findDraftBySourcePath(
  subscriberId: string,
  sourcePath: string,
): Promise<BlogDraftRow | null> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("blog_drafts")
    .select(SELECT_COLUMNS)
    .eq("owner_subscriber_id", subscriberId)
    .eq("source_path", sourcePath)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as BlogDraftRow | null
}

export type DraftCreateInput = {
  ownerSubscriberId: string
  title?: string
  slug?: string
  publishDate?: string | null
  summary?: string
  tags?: string[]
  thumbnailUrl?: string | null
  bodyHtml?: string
  bodyBlocks?: unknown
  sourcePath?: string | null
}

export async function createDraft(input: DraftCreateInput): Promise<BlogDraftRow> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("blog_drafts")
    .insert({
      owner_subscriber_id: input.ownerSubscriberId,
      title: input.title ?? "",
      slug: input.slug ?? "",
      publish_date: input.publishDate ?? null,
      summary: input.summary ?? "",
      tags: input.tags ?? [],
      thumbnail_url: input.thumbnailUrl ?? null,
      body_html: input.bodyHtml ?? "",
      body_blocks: input.bodyBlocks ?? null,
      source_path: input.sourcePath ?? null,
    })
    .select(SELECT_COLUMNS)
    .single()
  if (error) throw error
  return data as BlogDraftRow
}

export type DraftUpdateInput = Partial<{
  title: string
  slug: string
  publishDate: string | null
  summary: string
  tags: string[]
  thumbnailUrl: string | null
  bodyHtml: string
  bodyBlocks: unknown
}>

export async function updateDraft(
  subscriberId: string,
  id: string,
  patch: DraftUpdateInput,
): Promise<BlogDraftRow | null> {
  const supabase = getSupabaseClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title !== undefined) update.title = patch.title
  if (patch.slug !== undefined) update.slug = patch.slug
  if (patch.publishDate !== undefined) update.publish_date = patch.publishDate
  if (patch.summary !== undefined) update.summary = patch.summary
  if (patch.tags !== undefined) update.tags = patch.tags
  if (patch.thumbnailUrl !== undefined) update.thumbnail_url = patch.thumbnailUrl
  if (patch.bodyHtml !== undefined) update.body_html = patch.bodyHtml
  if (patch.bodyBlocks !== undefined) update.body_blocks = patch.bodyBlocks

  const { data, error } = await supabase
    .from("blog_drafts")
    .update(update)
    .eq("id", id)
    .eq("owner_subscriber_id", subscriberId)
    .select(SELECT_COLUMNS)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as BlogDraftRow | null
}

export async function deleteDraft(subscriberId: string, id: string): Promise<boolean> {
  const supabase = getSupabaseClient()
  const { error, count } = await supabase
    .from("blog_drafts")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("owner_subscriber_id", subscriberId)
  if (error) throw error
  return (count ?? 0) > 0
}
