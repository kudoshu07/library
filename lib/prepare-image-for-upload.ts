/**
 * Client-side image normalisation, run just before an image is uploaded to
 * /api/admin/blog/upload-image.
 *
 * Why this exists:
 *  1. Vercel serverless functions reject any request body over ~4.5 MB at
 *     the platform level — before our route handler (with its own 10 MB
 *     check) ever runs. A large screenshot/photo therefore fails with an
 *     opaque 413. We shrink oversized images below that budget here so the
 *     upload just works.
 *  2. The server only accepts png/jpeg/webp/gif/svg. iPhone photos are
 *     HEIC/HEIF, and other odd formats show up occasionally. We convert
 *     anything decodable into a supported type (WebP by default) so the
 *     author doesn't have to think about formats.
 *
 * This module touches browser-only APIs (createImageBitmap, <canvas>) and
 * must only ever be imported from client components.
 */

// Vercel's serverless request-body ceiling is ~4.5 MB. multipart/form-data
// adds a little overhead on top of the raw bytes, so we aim a bit under.
const TARGET_MAX_BYTES = 4_000_000

// Longest-edge cap. Blog images are displayed at most ~800px wide; 2400px
// keeps them crisp on retina / for zoom while cutting file size hard.
const MAX_DIMENSION = 2400

// Formats the upload endpoint accepts as-is.
const SERVER_SUPPORTED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
])

function isHeic(type: string, name: string): boolean {
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence" ||
    /\.(heic|heif)$/i.test(name)
  )
}

let webpEncodable: boolean | null = null
function canEncodeWebp(): boolean {
  if (webpEncodable !== null) return webpEncodable
  try {
    const c = document.createElement("canvas")
    c.width = 1
    c.height = 1
    webpEncodable = c.toDataURL("image/webp").startsWith("data:image/webp")
  } catch {
    webpEncodable = false
  }
  return webpEncodable
}

function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "image"
}

/**
 * Convert an HEIC/HEIF file to JPEG. The decoder (heic2any, a libheif WASM
 * wrapper) is imported dynamically so it's only downloaded when an author
 * actually drops a HEIC — the common PNG/JPEG path pays nothing for it.
 */
async function heicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any")
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 })
  const blob = Array.isArray(out) ? out[0] : out
  return new File([blob], `${stripExt(file.name || "image")}.jpg`, {
    type: "image/jpeg",
  })
}

/**
 * Decode → (optionally downscale) → re-encode until the result fits under
 * TARGET_MAX_BYTES. Output is WebP (keeps transparency, compresses photos
 * well, and is in the server allow-list); falls back to JPEG on browsers
 * that can't encode WebP.
 */
async function reencodeUnderBudget(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    // `from-image` respects EXIF orientation so phone photos don't come out
    // rotated.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    throw new Error(
      "画像を読み込めませんでした（対応していない形式の可能性があります）",
    )
  }

  const useWebp = canEncodeWebp()
  const outType = useWebp ? "image/webp" : "image/jpeg"
  const ext = useWebp ? "webp" : "jpg"
  const base = stripExt(file.name || "image")

  try {
    let scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    for (let attempt = 0; attempt < 8; attempt++) {
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("画像の変換に失敗しました")
      // JPEG has no alpha: paint white first so transparent areas don't turn
      // black in the WebP-unavailable fallback path.
      if (outType === "image/jpeg") {
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, w, h)
      }
      ctx.drawImage(bitmap, 0, 0, w, h)

      // Ease quality down first (0.9→0.6), then lean on dimension shrink.
      const quality = attempt < 4 ? 0.9 - attempt * 0.1 : 0.55
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outType, quality),
      )
      if (blob && blob.size <= TARGET_MAX_BYTES) {
        return new File([blob], `${base}.${ext}`, { type: outType })
      }
      scale *= 0.8
    }
  } finally {
    bitmap.close?.()
  }

  throw new Error(
    "画像を十分に圧縮できませんでした。もう少し小さい画像でお試しください。",
  )
}

/**
 * Normalise a user-selected image into something the upload endpoint will
 * accept: a supported format, comfortably under the request-body limit.
 * Returns the original File untouched when no work is needed.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  const type = (file.type || "").toLowerCase()
  const name = file.name || "image"

  // Vector — never rasterise; effectively always tiny.
  if (type === "image/svg+xml") return file

  // Animated GIF — canvas would flatten it to a single frame and kill the
  // animation. Pass it through as-is (a GIF over the body limit is rare; if
  // it happens the upload will surface the error rather than us silently
  // destroying the animation).
  if (type === "image/gif") return file

  // HEIC/HEIF (iPhone) — decode to JPEG first, then fall through to the size
  // handling below.
  let working = file
  if (isHeic(type, name)) {
    working = await heicToJpeg(working)
  }

  // Already a supported format and within budget → ship untouched, no
  // needless recompression.
  if (
    SERVER_SUPPORTED.has((working.type || "").toLowerCase()) &&
    working.size <= TARGET_MAX_BYTES
  ) {
    return working
  }

  // Too big, or an unsupported-but-decodable format → re-encode.
  return reencodeUnderBudget(working)
}
