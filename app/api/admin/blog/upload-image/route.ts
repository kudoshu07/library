import { NextResponse } from "next/server"
import { requireOwner } from "@/lib/admin-guard"
import { getDraftForOwner } from "@/lib/blog-drafts"
import { uploadDraftImage } from "@/lib/blog-image-storage"

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

// Drafting-phase images go to Supabase Storage (blog-draft-images bucket)
// rather than straight to GitHub. That sidesteps the 1-2 minute Vercel
// rebuild gap that would otherwise leave every freshly-uploaded image
// returning 404 in the editor — and worse, getting the 404 cached by the
// browser so the image stays broken even after the rebuild completes.
// The publish endpoint sweeps these URLs out of the body HTML and
// commits the actual image bytes to public/{slug}/ in the same commit
// as the MDX, so the final post still follows the existing convention.
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
  const rawDraftId = formData.get("draftId")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 })
  }
  if (typeof rawDraftId !== "string" || !rawDraftId.trim()) {
    return NextResponse.json({ error: "draft_id_required" }, { status: 400 })
  }
  const draftId = rawDraftId.trim()
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

  // Confirm the draft belongs to this owner so a stray draftId from one
  // user's session can't be used to dump images into another owner's
  // namespace (defense in depth — there's only ever one owner today).
  try {
    const draft = await getDraftForOwner(guard.session.subscriberId, draftId)
    if (!draft) {
      return NextResponse.json({ error: "draft_not_found" }, { status: 404 })
    }
  } catch (err) {
    console.error("upload-image: draft lookup failed", err)
    return NextResponse.json({ error: "draft_lookup_failed" }, { status: 500 })
  }

  try {
    const uploaded = await uploadDraftImage({ draftId, file })
    return NextResponse.json({
      url: uploaded.publicUrl,
      storagePath: uploaded.storagePath,
      filename: uploaded.filename,
    })
  } catch (err) {
    console.error("upload-image: storage upload failed", err)
    return NextResponse.json({ error: "upload_failed" }, { status: 502 })
  }
}
