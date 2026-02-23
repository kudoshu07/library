"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ExternalLink,
  Heart,
  Link2,
  Share2,
} from "lucide-react"
import { type ContentItem, type ContentSource } from "@/lib/data"
import { cn } from "@/lib/utils"
import { SourceAvatar, SourceChip } from "@/components/source-ui"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function formatDateLabel(rawDate: string): string {
  const parsed = new Date(rawDate)
  if (Number.isNaN(parsed.getTime())) return rawDate
  return parsed.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function toPlainText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]+\]\([^)]*\)/g, "$1")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function createLeadText(item: ContentItem): string {
  const base = toPlainText(item.summary?.trim() || item.body?.trim() || "")
  if (!base) return ""
  const chars = Array.from(base)
  if (chars.length <= 80) return base
  return `${chars.slice(0, 80).join("")}...`
}

function getCanonicalUrl(item: ContentItem): string {
  if (item.url.startsWith("http://") || item.url.startsWith("https://")) {
    return item.url
  }

  return `https://kudoshu07.com${item.url}`
}

async function copyTextToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "absolute"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}

function ShareActions({
  title,
  url,
}: {
  title: string
  url: string
}) {
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const handleNativeShare = async () => {
    if (!canNativeShare || typeof navigator === "undefined") return
    try {
      await navigator.share({
        title,
        text: title,
        url,
      })
    } catch {
      // User dismissed or device blocked sharing.
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs transition-colors hover:text-sky-600"
          aria-label="Share options"
        >
          <Share2 className="size-4" />
          <span>Share</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 rounded-2xl p-2">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void handleCopy()
          }}
          className="rounded-xl px-3 py-3 text-base font-semibold"
        >
          <Link2 className="size-5" />
          <span>{copied ? "リンクをコピーしました" : "リンクをコピー"}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void handleNativeShare()
          }}
          disabled={!canNativeShare}
          className="rounded-xl px-3 py-3 text-base font-semibold"
        >
          <Share2 className="size-5" />
          <span>その他の方法で共有</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ContentCard({
  item,
  variant = "feed",
  likeCount = 0,
  isLiked = false,
  onToggleLike,
}: {
  item: ContentItem
  variant?: "feed" | "pickup"
  likeCount?: number
  isLiked?: boolean
  onToggleLike?: () => void
}) {
  if (variant === "pickup") {
    return <PickupCard item={item} />
  }

  return (
    <FeedCard
      item={item}
      likeCount={likeCount}
      isLiked={isLiked}
      onToggleLike={onToggleLike}
    />
  )
}

function FeedCard({
  item,
  likeCount,
  isLiked,
  onToggleLike,
}: {
  item: ContentItem
  likeCount: number
  isLiked: boolean
  onToggleLike?: () => void
}) {
  const isExternal = item.source !== "blog"
  const isInstagram = item.source === "ig_business" || item.source === "ig_photo"
  const isPodcast = item.source === "pod_yonakoi" || item.source === "pod_vegan"
  const isExternalLeadLink = isExternal
  const dateLabel = formatDateLabel(item.date)
  const lead = createLeadText(item)
  const canonicalUrl = getCanonicalUrl(item)

  return (
    <article className="border-b border-slate-200 bg-white px-4 py-4 transition-colors hover:bg-slate-50/70">
      <div className="flex items-start gap-3">
        <SourceAvatar source={item.source} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SourceChip source={item.source} />
            <time className="text-xs text-slate-500">{dateLabel}</time>
          </div>

          {!isInstagram &&
            (isExternal ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-lg font-semibold leading-snug text-slate-900 transition-colors hover:text-sky-600"
              >
                {item.title}
              </a>
            ) : (
              <Link href={item.url} className="mt-2 block text-lg font-semibold leading-snug text-slate-900 transition-colors hover:text-sky-600">
                {item.title}
              </Link>
            ))}

          {lead &&
            (isExternalLeadLink ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "block text-sm leading-relaxed text-slate-600 transition-colors hover:text-sky-600",
                  isInstagram ? "mt-1" : "mt-2"
                )}
              >
                {lead}
              </a>
            ) : (
              <p className={cn("text-sm leading-relaxed text-slate-600", isInstagram ? "mt-1" : "mt-2")}>
                {lead}
              </p>
            ))}

          {!isPodcast && item.thumbnail && (
            isInstagram ? (
              <div className="mt-3">
                <div className="aspect-video w-full">
                  <div className="h-full w-fit max-w-full">
                    {isExternal ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${item.title} を開く`}
                        className="block h-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                      >
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="h-full w-auto max-w-full object-contain"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(event) => {
                            const target = event.currentTarget
                            target.style.display = "none"
                          }}
                        />
                      </a>
                    ) : (
                      <Link
                        href={item.url}
                        aria-label={`${item.title} を開く`}
                        className="block h-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                      >
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="h-full w-auto max-w-full object-contain"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(event) => {
                            const target = event.currentTarget
                            target.style.display = "none"
                          }}
                        />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ) : isExternal ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${item.title} を開く`}
                className="mt-3 block overflow-hidden rounded-2xl border border-slate-200"
              >
                <img
                  src={item.thumbnail}
                  alt=""
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    const target = event.currentTarget
                    target.style.display = "none"
                  }}
                />
              </a>
            ) : (
              <Link
                href={item.url}
                aria-label={`${item.title} を開く`}
                className="mt-3 block overflow-hidden rounded-2xl border border-slate-200"
              >
                <img
                  src={item.thumbnail}
                  alt=""
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event) => {
                    const target = event.currentTarget
                    target.style.display = "none"
                  }}
                />
              </Link>
            )
          )}

          <div className="mt-3 flex items-center gap-6 text-slate-500">
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 text-xs transition-colors",
                isLiked ? "text-rose-500" : "hover:text-rose-500"
              )}
              aria-label="Like"
              onClick={onToggleLike}
            >
              <Heart className={cn("size-4", isLiked && "fill-current")} />
              <span>{likeCount}</span>
            </button>
            <ShareActions title={item.title} url={canonicalUrl} />
          </div>
        </div>
      </div>
    </article>
  )
}

function PickupCard({ item }: { item: ContentItem }) {
  const isExternal = item.source !== "blog"
  const isInstagram = item.source === "ig_business" || item.source === "ig_photo"
  const dateLabel = formatDateLabel(item.date)
  const lead = createLeadText(item)
  const className =
    "group m-0 block min-w-[250px] overflow-hidden rounded-2xl bg-white p-2 transition-colors hover:bg-slate-50 lg:min-w-0 lg:w-full"

  const body = (
    <>
      {item.thumbnail && (
        <div className="mt-3 overflow-hidden rounded-xl">
          <img
            src={item.thumbnail}
            alt=""
            className="aspect-video w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => {
              const target = event.currentTarget
              target.style.display = "none"
            }}
          />
        </div>
      )}
      <div className={cn("flex flex-wrap items-center gap-2", item.thumbnail ? "mt-3" : "")}>
        <SourceChip source={item.source} withIcon iconPosition="left" />
        <p className="text-xs text-slate-500">{dateLabel}</p>
        {isExternal && <ExternalLink className="size-3 text-slate-400" aria-hidden="true" />}
      </div>
      {!isInstagram && <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{item.title}</p>}
      {lead && (
        <p className={cn("text-xs leading-relaxed text-slate-600", item.thumbnail ? "mt-2" : isInstagram ? "mt-3" : "mt-3")}>
          {lead}
        </p>
      )}
    </>
  )

  if (isExternal) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    )
  }

  return (
    <Link href={item.url} className={className}>
      {body}
    </Link>
  )
}
