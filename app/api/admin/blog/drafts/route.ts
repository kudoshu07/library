import { NextResponse } from "next/server"
import { z } from "zod"
import { requireOwner } from "@/lib/admin-guard"
import { createDraft, listDraftsForOwner } from "@/lib/blog-drafts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST body lets the caller seed a draft with imported content (used by the
// "edit existing post" flow and the "+ new" entry point alike). All fields
// are optional — a bare POST creates a totally empty draft.
const createSchema = z
  .object({
    title: z.string().max(500).optional(),
    slug: z.string().max(200).optional(),
    // Supabase's timestamptz round-trip returns "+00:00" rather than "Z";
    // accept both by allowing an offset.
    publishDate: z.string().datetime({ offset: true }).nullable().optional(),
    summary: z.string().max(2000).optional(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    thumbnailUrl: z.string().max(2000).nullable().optional(),
    bodyHtml: z.string().max(2_000_000).optional(),
    bodyBlocks: z.unknown().optional(),
    sourcePath: z.string().max(500).nullable().optional(),
  })
  .strict()

export async function GET() {
  const guard = await requireOwner()
  if (!guard.ok) {
    return NextResponse.json(
      { error: "not_found" },
      { status: guard.status },
    )
  }
  try {
    const drafts = await listDraftsForOwner(guard.session.subscriberId)
    return NextResponse.json({ drafts })
  } catch (err) {
    console.error("list drafts error", err)
    return NextResponse.json({ error: "list_failed" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const guard = await requireOwner()
  if (!guard.ok) {
    return NextResponse.json(
      { error: "not_found" },
      { status: guard.status },
    )
  }

  let parsed: z.infer<typeof createSchema> = {}
  try {
    // Empty body is fine — that's how "+ new" creates a blank draft.
    const text = await req.text()
    if (text.trim()) {
      const json = JSON.parse(text)
      const result = createSchema.safeParse(json)
      if (!result.success) {
        return NextResponse.json(
          { error: result.error.issues[0]?.message ?? "invalid_input" },
          { status: 400 },
        )
      }
      parsed = result.data
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  try {
    const draft = await createDraft({
      ownerSubscriberId: guard.session.subscriberId,
      title: parsed.title,
      slug: parsed.slug,
      publishDate: parsed.publishDate,
      summary: parsed.summary,
      tags: parsed.tags,
      thumbnailUrl: parsed.thumbnailUrl,
      bodyHtml: parsed.bodyHtml,
      bodyBlocks: parsed.bodyBlocks,
      sourcePath: parsed.sourcePath,
    })
    return NextResponse.json({ draft }, { status: 201 })
  } catch (err) {
    console.error("create draft error", err)
    return NextResponse.json({ error: "create_failed" }, { status: 500 })
  }
}
