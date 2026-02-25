"use client"

import Image from "next/image"
import Link from "next/link"
import { type ReactNode } from "react"
import {
  ExternalLink,
  Heart,
} from "lucide-react"
import { type ContentItem, type ContentSource } from "@/lib/data"
import { cn } from "@/lib/utils"
import { SourceAvatar, SourceChip } from "@/components/source-ui"
import { ShareActions } from "@/components/share-actions"

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
// keep file as client component; ShareActions extracted to a shared component

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
  const thumbnail = item.thumbnail
  const instagramProxyThumbnail =
    isInstagram && thumbnail && thumbnail.startsWith("http")
      ? `/api/thumbnail?src=${encodeURIComponent(thumbnail)}`
      : undefined
  const lowQuality = 40
  const canOptimizeThumbnail =
    Boolean(thumbnail && thumbnail.startsWith("/") && !thumbnail.includes("?"))

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

          {!isPodcast && thumbnail && (
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
                          src={thumbnail}
                          alt=""
                          className="h-full w-auto max-w-full object-contain"
                          loading="lazy"
                          onError={(event) => {
                            const target = event.currentTarget
                            if (instagramProxyThumbnail && target.dataset.fallbackApplied !== "1") {
                              target.dataset.fallbackApplied = "1"
                              target.src = instagramProxyThumbnail
                              return
                            }
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
                          src={thumbnail}
                          alt=""
                          className="h-full w-auto max-w-full object-contain"
                          loading="lazy"
                          onError={(event) => {
                            const target = event.currentTarget
                            if (instagramProxyThumbnail && target.dataset.fallbackApplied !== "1") {
                              target.dataset.fallbackApplied = "1"
                              target.src = instagramProxyThumbnail
                              return
                            }
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
                {canOptimizeThumbnail ? (
                  <div className="relative aspect-video w-full">
                    <Image
                      src={thumbnail}
                      alt=""
                      fill
                      sizes="(max-width: 799px) 100vw, 640px"
                      quality={lowQuality}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <img
                    src={thumbnail}
                    alt=""
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                    onError={(event) => {
                      const target = event.currentTarget
                      target.style.display = "none"
                    }}
                  />
                )}
              </a>
            ) : (
            <Link
              href={item.url}
              aria-label={`${item.title} を開く`}
              className="mt-3 block overflow-hidden rounded-2xl border border-slate-200"
            >
              {canOptimizeThumbnail ? (
                <div className="relative aspect-video w-full">
                  <Image
                    src={thumbnail}
                    alt=""
                    fill
                    sizes="(max-width: 799px) 100vw, 640px"
                    quality={lowQuality}
                    className="object-cover"
                  />
                </div>
              ) : (
                <img
                  src={thumbnail}
                  alt=""
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                    onError={(event) => {
                      const target = event.currentTarget
                      target.style.display = "none"
                    }}
                  />
                )}
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
  const lowQuality = 40
  const thumbnail = item.thumbnail
  const canOptimizeThumbnail =
    Boolean(thumbnail && thumbnail.startsWith("/") && !thumbnail.includes("?"))

  const body: ReactNode = (
    <>
      {thumbnail && (
        <div className="mt-3 overflow-hidden rounded-xl">
          {canOptimizeThumbnail ? (
            <div className="relative aspect-video w-full">
              <Image
                src={thumbnail}
                alt=""
                fill
                sizes="280px"
                quality={lowQuality}
                className="object-cover"
              />
            </div>
          ) : (
            <img
              src={thumbnail}
              alt=""
              className="aspect-video w-full object-cover"
              loading="lazy"
              onError={(event) => {
                const target = event.currentTarget
                target.style.display = "none"
              }}
            />
          )}
        </div>
      )}
      <div className={cn("flex flex-wrap items-center gap-2", thumbnail ? "mt-3" : "")}>
        <SourceChip source={item.source} withIcon iconPosition="left" />
        <p className="text-xs text-slate-500">{dateLabel}</p>
        {isExternal && <ExternalLink className="size-3 text-slate-400" aria-hidden="true" />}
      </div>
      {!isInstagram && <p className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{item.title}</p>}
      {lead && (
        <p className={cn("text-xs leading-relaxed text-slate-600", thumbnail ? "mt-2" : isInstagram ? "mt-3" : "mt-3")}>
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
