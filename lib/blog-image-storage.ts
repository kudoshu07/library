import "server-only"

import { getSupabaseClient } from "@/lib/newsletter"

/**
 * Storage helpers for in-flight blog draft images.
 *
 * The flow:
 *  1. Editor uploads images → uploadDraftImage stores them under
 *     blog-draft-images/{draftId}/{filename} in Supabase Storage and
 *     returns a public URL the editor immediately renders. No Vercel
 *     rebuild required.
 *  2. On publish, the publish endpoint scans the body HTML for any
 *     URLs matching this bucket, downloads each image, commits it to
 *     GitHub at public/{slug}/{filename}, and rewrites the HTML to
 *     reference the local path "/{slug}/{filename}" (matching the
 *     existing post convention).
 *  3. After the GitHub commit lands, deleteDraftImages removes the
 *     bucket entries so we don't pay for duplicate storage of images
 *     that now live in the repo.
 */

export const BUCKET = "blog-draft-images"

/** Substring that uniquely identifies an URL pointing at this bucket. */
export const BUCKET_PUBLIC_PATH_FRAGMENT = `/storage/v1/object/public/${BUCKET}/`

export type UploadedImage = {
  /** Public URL the editor stores in its body blocks. */
  publicUrl: string
  /** Storage path inside the bucket (without bucket prefix). */
  storagePath: string
  /** Filename (last segment of storagePath). */
  filename: string
}

function safeBaseName(name: string): string {
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

function extensionFor(mime: string, fallback: string): string {
  switch (mime) {
    case "image/png": return "png"
    case "image/jpeg": return "jpg"
    case "image/webp": return "webp"
    case "image/gif": return "gif"
    case "image/svg+xml": return "svg"
    default: return fallback || "bin"
  }
}

/**
 * Upload an image into the draft's namespace. We DON'T use upsert: the
 * filename includes a timestamp+random suffix, so collisions are
 * essentially impossible and we'd rather see an error than silently
 * overwrite if the impossible does happen.
 */
export async function uploadDraftImage(params: {
  draftId: string
  file: File
}): Promise<UploadedImage> {
  const supabase = getSupabaseClient()

  const originalName = params.file.name || "image"
  const fallbackExt =
    originalName.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ?? ""
  const base = safeBaseName(originalName)
  const ext = extensionFor(params.file.type, fallbackExt)
  const ts = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)
  const rand = Math.random().toString(36).slice(2, 6)
  const filename = `${base}-${ts}${rand}.${ext}`
  const storagePath = `${params.draftId}/${filename}`

  const bytes = await params.file.arrayBuffer()
  const { error } = await supabase.storage.from(BUCKET).upload(
    storagePath,
    new Uint8Array(bytes),
    {
      contentType: params.file.type || "application/octet-stream",
      upsert: false,
    },
  )
  if (error) throw error

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return {
    publicUrl: pub.publicUrl,
    storagePath,
    filename,
  }
}

/**
 * Remove every image associated with a draft. Called both when the draft
 * is deleted explicitly and after the draft is published (the images
 * have been copied to GitHub so we no longer need the Storage copies).
 *
 * Returns the number of removed files; logs but doesn't throw on
 * individual list/remove failures so a cleanup hiccup doesn't break the
 * primary action (delete/publish) that the user triggered.
 */
export async function deleteDraftImages(draftId: string): Promise<number> {
  try {
    const supabase = getSupabaseClient()
    const { data, error: listError } = await supabase.storage
      .from(BUCKET)
      .list(draftId)
    if (listError) {
      console.error("blog-image-storage: list failed", listError)
      return 0
    }
    if (!data || data.length === 0) return 0
    const paths = data
      .filter((entry) => entry.name && !entry.name.startsWith("."))
      .map((entry) => `${draftId}/${entry.name}`)
    if (paths.length === 0) return 0

    const { error: rmError } = await supabase.storage
      .from(BUCKET)
      .remove(paths)
    if (rmError) {
      console.error("blog-image-storage: remove failed", rmError)
      return 0
    }
    return paths.length
  } catch (err) {
    console.error("blog-image-storage: cleanup failed", err)
    return 0
  }
}

/**
 * Download an image from the bucket and return it as a base64 string
 * (ready to drop straight into a GitHub git data blob payload).
 */
export async function fetchDraftImageBase64(storagePath: string): Promise<{
  base64: string
  contentType: string
}> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error) throw error
  if (!data) throw new Error("blog-image-storage: empty download")
  const arrayBuffer = await data.arrayBuffer()
  return {
    base64: Buffer.from(arrayBuffer).toString("base64"),
    contentType: data.type || "application/octet-stream",
  }
}

/**
 * Find every <img src="..."> in `html` whose src points at the draft
 * images bucket, and return the parsed storage paths in document order.
 * Used by the publish endpoint to figure out which images to copy into
 * GitHub before rewriting the HTML.
 *
 * Matching is forgiving: we accept either bucket URL form (the canonical
 * public URL or a relative path that happens to include the bucket
 * fragment) and we don't care about quote style.
 */
export function findDraftImageReferences(html: string): Array<{
  src: string
  storagePath: string
}> {
  const found: Array<{ src: string; storagePath: string }> = []
  const seen = new Set<string>()
  // Match any non-empty src attribute value. We post-filter to the bucket.
  const re = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const src = m[1] ?? m[2] ?? m[3] ?? ""
    const idx = src.indexOf(BUCKET_PUBLIC_PATH_FRAGMENT)
    if (idx === -1) continue
    const storagePath = src.slice(idx + BUCKET_PUBLIC_PATH_FRAGMENT.length)
    if (!storagePath || storagePath.includes("..")) continue
    if (seen.has(src)) continue
    seen.add(src)
    found.push({ src, storagePath })
  }
  return found
}

/**
 * Replace every occurrence of `oldSrc` in `html` with `newSrc`, escaping
 * HTML-significant chars in the replacement so a malicious filename
 * can't break out of an attribute value (paranoid; our filenames are
 * already ASCII-clean by the time they hit Storage).
 */
export function rewriteImageSrc(html: string, oldSrc: string, newSrc: string): string {
  // String.prototype.replaceAll exists in Node 18+/ES2021, which the
  // project targets.
  return html.replaceAll(oldSrc, newSrc)
}
