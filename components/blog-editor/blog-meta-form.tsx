"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { isValidSlug, sanitizeSlug } from "@/lib/mdx-serializer"

export type BlogMeta = {
  title: string
  publishDate: string // ISO 8601 (publish_date column). May be "" when blank.
  slug: string
  summary: string
  tags: string[]
  thumbnailUrl: string
}

/**
 * Left-rail metadata form. Keeps a tight grip on the inputs because publish
 * time validates slug uniqueness and date format and we don't want to send
 * the user back from the publish modal for trivial fixes.
 */
export function BlogMetaForm({
  value,
  onChange,
  knownTags,
  draftId,
}: {
  value: BlogMeta
  onChange: (next: BlogMeta) => void
  knownTags: string[]
  draftId: string
}) {
  const [tagInput, setTagInput] = useState("")

  const set = <K extends keyof BlogMeta>(key: K, next: BlogMeta[K]) => {
    onChange({ ...value, [key]: next })
  }

  const addTag = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    if (value.tags.includes(trimmed)) return
    set("tags", [...value.tags, trimmed])
    setTagInput("")
  }

  const removeTag = (tag: string) => {
    set(
      "tags",
      value.tags.filter((t) => t !== tag),
    )
  }

  const suggestions = knownTags
    .filter((t) => !value.tags.includes(t))
    .filter((t) => !tagInput || t.toLowerCase().includes(tagInput.toLowerCase()))
    .slice(0, 12)

  // Title is intentionally NOT rendered here — it lives at the top of the
  // body editor so it reads like a Notion-style document heading. Everything
  // else stays as left-rail metadata.
  return (
    <div className="flex flex-col gap-5">
      <Field label="公開日" required hint="UTCで保存されます。空欄なら公開時に未入力エラー。">
        <input
          type="datetime-local"
          value={toLocalDatetimeInputValue(value.publishDate)}
          onChange={(e) => set("publishDate", fromLocalDatetimeInputValue(e.target.value))}
          className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </Field>

      <Field label="slug" required hint="半角英数字とハイフン。URLの末尾になります。">
        <input
          type="text"
          value={value.slug}
          onChange={(e) => set("slug", e.target.value)}
          className="block w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-sm"
          placeholder="my-post-slug"
        />
        <SlugValidationHint
          raw={value.slug}
          onApplySuggested={(suggested) => set("slug", suggested)}
        />
      </Field>

      <Field label="説明文" hint="一覧やSNSシェア時に表示されます。空欄なら本文冒頭から自動生成。">
        <textarea
          value={value.summary}
          onChange={(e) => set("summary", e.target.value)}
          rows={3}
          className="block w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm"
          placeholder="記事の要約（140字程度）"
        />
      </Field>

      <Field label="カテゴリ (tags)" hint="既存タグから選択 or 入力してEnterで追加。">
        <div className="flex flex-wrap gap-2 rounded-md border border-border bg-white p-2">
          {value.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`${tag}を削除`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault()
                addTag(tagInput)
              } else if (e.key === "Backspace" && !tagInput && value.tags.length > 0) {
                removeTag(value.tags[value.tags.length - 1])
              }
            }}
            placeholder={value.tags.length === 0 ? "タグを追加..." : ""}
            className="min-w-[8ch] flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="rounded-full border border-border bg-white px-2 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                + {tag}
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field
        label="サムネイル画像"
        hint="公開時に本文中の画像と一緒に public/{slug}/ に保存されます。"
      >
        <ThumbnailUpload
          draftId={draftId}
          url={value.thumbnailUrl}
          onChange={(url) => set("thumbnailUrl", url)}
        />
      </Field>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  )
}

/**
 * Live feedback for the slug field. Most failures users hit at publish time
 * are slug-shape problems (Japanese characters, spaces, leading/trailing
 * dashes) — surface them as the user types so they don't waste a publish
 * round-trip OR an image upload to find out. Includes a one-tap fix that
 * applies the sanitized form.
 */
function SlugValidationHint({
  raw,
  onApplySuggested,
}: {
  raw: string
  onApplySuggested: (suggested: string) => void
}) {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (isValidSlug(trimmed)) return null
  const suggested = sanitizeSlug(trimmed)
  return (
    <div className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
      ⚠️ slug は半角英数字とハイフンのみ使えます（画像アップロードもこのslugでフォルダ分けされます）。
      {suggested ? (
        <button
          type="button"
          onClick={() => onApplySuggested(suggested)}
          className="ml-1 underline underline-offset-2 hover:no-underline"
        >
          「{suggested}」に修正
        </button>
      ) : (
        <span className="ml-1">入力例: <code className="font-mono">my-post</code></span>
      )}
    </div>
  )
}

function ThumbnailUpload({
  draftId,
  url,
  onChange,
}: {
  draftId: string
  url: string
  onChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    // Slug isn't needed during drafting — Supabase Storage holds the
    // image under the draftId namespace, and the publish endpoint copies
    // it to public/{slug}/ at the moment we know the slug is final.
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("draftId", draftId)
      const res = await fetch("/api/admin/blog/upload-image", {
        method: "POST",
        body: fd,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data?.error ?? `upload failed (${res.status})`)
      }
      const data = (await res.json()) as { url: string }
      onChange(data.url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {url && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="thumbnail preview"
            className="h-32 w-auto rounded-md border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded-full bg-background/90 text-xs"
            aria-label="サムネイル解除"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/slug/thumbnail.png またはアップロード"
          className="block flex-1 rounded-md border border-border bg-white px-3 py-2 font-mono text-xs"
        />
      </div>
      <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-white px-3 py-2 text-xs text-muted-foreground hover:bg-secondary">
        {uploading ? "アップロード中…" : "画像を選択"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ""
          }}
        />
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// HTML <input type="datetime-local"> wants `YYYY-MM-DDTHH:mm` in the local
// timezone. Server stores ISO UTC. These helpers bridge both directions.

function toLocalDatetimeInputValue(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function fromLocalDatetimeInputValue(local: string): string {
  if (!local) return ""
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString()
}

export function useKnownTags(): string[] {
  const [tags, setTags] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/blog/known-tags", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { tags: [] }))
      .then((data: { tags?: string[] }) => {
        if (!cancelled && Array.isArray(data?.tags)) setTags(data.tags)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return tags
}
