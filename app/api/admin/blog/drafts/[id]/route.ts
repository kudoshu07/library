import { NextResponse } from "next/server"
import { z } from "zod"
import { requireOwner } from "@/lib/admin-guard"
import { deleteDraft, getDraftForOwner, updateDraft } from "@/lib/blog-drafts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const patchSchema = z
  .object({
    title: z.string().max(500).optional(),
    slug: z.string().max(200).optional(),
    publishDate: z.string().datetime().nullable().optional(),
    summary: z.string().max(2000).optional(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    thumbnailUrl: z.string().max(2000).nullable().optional(),
    bodyHtml: z.string().max(2_000_000).optional(),
    bodyBlocks: z.unknown().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "empty_patch" })

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: RouteContext) {
  const guard = await requireOwner()
  if (!guard.ok) {
    return NextResponse.json({ error: "not_found" }, { status: guard.status })
  }
  const { id } = await params
  try {
    const draft = await getDraftForOwner(guard.session.subscriberId, id)
    if (!draft) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json({ draft })
  } catch (err) {
    console.error("get draft error", err)
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const guard = await requireOwner()
  if (!guard.ok) {
    return NextResponse.json({ error: "not_found" }, { status: guard.status })
  }
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid_input" },
      { status: 400 },
    )
  }

  try {
    const updated = await updateDraft(guard.session.subscriberId, id, parsed.data)
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json({ draft: updated })
  } catch (err) {
    console.error("update draft error", err)
    return NextResponse.json({ error: "update_failed" }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const guard = await requireOwner()
  if (!guard.ok) {
    return NextResponse.json({ error: "not_found" }, { status: guard.status })
  }
  const { id } = await params
  try {
    const ok = await deleteDraft(guard.session.subscriberId, id)
    if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("delete draft error", err)
    return NextResponse.json({ error: "delete_failed" }, { status: 500 })
  }
}
