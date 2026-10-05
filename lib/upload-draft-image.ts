import { prepareImageForUpload } from "@/lib/prepare-image-for-upload"

/**
 * Client-side upload of one image into a draft's Supabase namespace via
 * /api/admin/blog/upload-image. Shared by the body editor (BlockNote's
 * uploadFile) and the thumbnail picker so both normalise the file the same
 * way and surface the same human-readable errors.
 *
 * Browser-only (prepareImageForUpload uses <canvas>).
 */
export async function uploadDraftImageFile(draftId: string, rawFile: File): Promise<string> {
  const file = await prepareImageForUpload(rawFile)
  const fd = new FormData()
  fd.append("file", file)
  fd.append("draftId", draftId)

  let res: Response
  try {
    res = await fetch("/api/admin/blog/upload-image", { method: "POST", body: fd })
  } catch {
    throw new Error("通信に失敗しました。ネットワークを確認してもう一度お試しください。")
  }
  if (!res.ok) {
    // Vercel's platform-level 413 comes back as plain text, not our JSON.
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(describeUploadError(res.status, data?.error))
  }
  const data = (await res.json()) as { url?: string }
  if (!data?.url) throw new Error("アップロード結果にURLがありません。もう一度お試しください。")
  return data.url
}

function describeUploadError(status: number, code: string | undefined): string {
  if (status === 413 || code === "file_too_large")
    return "画像が大きすぎます（目安 4MB 以下）。小さい画像でお試しください。"
  if (code?.startsWith("unsupported_type"))
    return `対応していない画像形式です（${code.split(":")[1] ?? "unknown"}）。PNG / JPEG / WebP / GIF を使ってください。`
  if (code === "empty_file") return "空のファイルです。"
  if (code === "draft_not_found")
    return "下書きが見つかりません。削除されたか、別アカウントでログインしている可能性があります。"
  if (status === 401 || status === 403 || code === "not_found")
    return "ログインが切れている可能性があります。別タブで再ログインしてからもう一度お試しください。"
  if (code === "upload_failed")
    return "ストレージへの保存に失敗しました。少し待ってもう一度お試しください。"
  return `アップロードに失敗しました（${code ?? status}）`
}
