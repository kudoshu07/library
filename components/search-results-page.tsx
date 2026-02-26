"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ExternalLink, Home, Instagram, Mail, Search, X } from "lucide-react"
import { type ContentItem, type ContentSource } from "@/lib/data"
import { cn } from "@/lib/utils"
import { SourceChip, SourceInlineLabel, sourceFilterOptions } from "@/components/source-ui"
import { ENABLE_SUBSCRIBE_UI } from "@/lib/feature-flags"

function decodeTagLabel(tag: string): string {
  try {
    return decodeURIComponent(tag)
  } catch {
    return tag
  }
}

function getCategoryTagLabel(tag: string): string {
  const decoded = decodeTagLabel(tag).trim()
  if (decoded === "スタートアップ") return "startup"
  if (decoded === "事業") return "business"
  if (decoded === "組織") return "org"
  return decoded
}

function isCategoryTagVisible(tag: string): boolean {
  const normalized = decodeTagLabel(tag).trim().toLowerCase()
  if (normalized === "allcontents") return false

  const hiddenDecodedTags = new Set([
    "近況",
    "ブログ",
    "リーダーシップ",
    "知恵借り",
    "2023",
  ])

  return !hiddenDecodedTags.has(decodeTagLabel(tag).trim())
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase()
}

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

function buildSearchTarget(item: ContentItem): string {
  return (
    item.searchText ??
    [item.title, item.summary ?? "", item.tags?.join(" ") ?? "", item.body ?? ""]
      .join(" ")
      .toLowerCase()
  )
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength).trim()}...`
}

function createSearchSnippet(item: ContentItem, query: string): string {
  const base = toPlainText(item.summary?.trim() || item.body?.trim() || "")
  if (!base) return ""
  if (!query) return truncateText(base, 120)

  const lowerBase = base.toLowerCase()
  const index = lowerBase.indexOf(query)
  if (index === -1) return truncateText(base, 120)

  const start = Math.max(0, index - 26)
  const end = Math.min(base.length, index + query.length + 54)
  let snippet = base.slice(start, end).trim()
  if (start > 0) snippet = `...${snippet}`
  if (end < base.length) snippet = `${snippet}...`
  return snippet
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function HighlightText({
  text,
  query,
  className,
}: {
  text: string
  query: string
  className?: string
}) {
  if (!query) {
    return <span className={className}>{text}</span>
  }

  const regex = new RegExp(`(${escapeRegExp(query)})`, "ig")
  const parts = text.split(regex)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) return null
        if (part.toLowerCase() === query.toLowerCase()) {
          return (
            <mark
              key={`${part}-${index}`}
              className="rounded-sm bg-amber-100 px-0.5 text-rose-600"
            >
              {part}
            </mark>
          )
        }
        return <span key={`${part}-${index}`}>{part}</span>
      })}
    </span>
  )
}

function SearchResultCard({
  item,
  query,
  onTagSelect,
}: {
  item: ContentItem
  query: string
  onTagSelect: (tag: string) => void
}) {
  const isExternal = item.source !== "blog"
  const isInstagram = item.source === "ig_business" || item.source === "ig_photo"
  const isTaggable = item.source === "blog" || item.source === "note"
  const title = item.title || ""
  const snippet = createSearchSnippet(item, query)
  const dateLabel = formatDateLabel(item.date)
  const tags = (item.tags ?? []).filter((tag) => Boolean(tag) && isCategoryTagVisible(tag))
  const thumbnail = item.thumbnail
  const instagramProxyThumbnail =
    isInstagram && thumbnail && thumbnail.startsWith("http")
      ? `/api/thumbnail?src=${encodeURIComponent(thumbnail)}`
      : undefined
  const instagramThumbnailSrc = isInstagram && instagramProxyThumbnail ? instagramProxyThumbnail : thumbnail
  const lowQuality = 40
  const canOptimizeThumbnail =
    Boolean(thumbnail && thumbnail.startsWith("/") && !thumbnail.includes("?"))

  return (
    <article className="h-full rounded-2xl bg-white p-4 transition hover:bg-slate-50">
      {thumbnail && (
        isExternal ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 block overflow-hidden rounded-xl"
          >
            {canOptimizeThumbnail ? (
              <div className="relative aspect-video w-full">
                <Image
                  src={thumbnail}
                  alt=""
                  fill
                  sizes="(max-width: 799px) 100vw, 320px"
                  quality={lowQuality}
                  className="object-cover"
                />
              </div>
            ) : (
              <img
                src={instagramThumbnailSrc}
                alt=""
                className="aspect-video w-full object-cover"
                loading="lazy"
                onError={(event) => {
                  const target = event.currentTarget
                  if (!instagramThumbnailSrc?.startsWith("/api/thumbnail") && instagramProxyThumbnail && target.dataset.fallbackApplied !== "1") {
                    target.dataset.fallbackApplied = "1"
                    target.src = instagramProxyThumbnail
                    return
                  }
                  target.style.display = "none"
                }}
              />
            )}
          </a>
        ) : (
          <Link href={item.url} className="mb-3 block overflow-hidden rounded-xl">
            {canOptimizeThumbnail ? (
              <div className="relative aspect-video w-full">
                <Image
                  src={thumbnail}
                  alt=""
                  fill
                  sizes="(max-width: 799px) 100vw, 320px"
                  quality={lowQuality}
                  className="object-cover"
                />
              </div>
            ) : (
              <img
                src={instagramThumbnailSrc}
                alt=""
                className="aspect-video w-full object-cover"
                loading="lazy"
                onError={(event) => {
                  const target = event.currentTarget
                  if (!instagramThumbnailSrc?.startsWith("/api/thumbnail") && instagramProxyThumbnail && target.dataset.fallbackApplied !== "1") {
                    target.dataset.fallbackApplied = "1"
                    target.src = instagramProxyThumbnail
                    return
                  }
                  target.style.display = "none"
                }}
              />
            )}
          </Link>
        )
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SourceChip source={item.source} withIcon iconPosition="left" />
        <time className="text-xs text-slate-500">{dateLabel}</time>
        {isExternal && <ExternalLink className="size-3 text-slate-400" aria-hidden="true" />}
      </div>

      {!isInstagram &&
        (isExternal ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition-colors hover:text-[#264F8B]"
          >
            <HighlightText text={title} query={query} />
          </a>
        ) : (
          <Link
            href={item.url}
            className="mt-3 block line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition-colors hover:text-[#264F8B]"
          >
            <HighlightText text={title} query={query} />
          </Link>
        ))}

      {snippet &&
        (isExternal ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "block text-xs leading-relaxed text-slate-600 transition-colors hover:text-[#264F8B]",
              isInstagram ? "mt-3" : "mt-2"
            )}
          >
            <HighlightText text={snippet} query={query} />
          </a>
        ) : (
          <p className={cn("text-xs leading-relaxed text-slate-600", isInstagram ? "mt-3" : "mt-2")}>
            <HighlightText text={snippet} query={query} />
          </p>
        ))}

      {isTaggable && tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.slice(0, 6).map((tag) => (
            <button
              key={`${item.id}-${tag}`}
              type="button"
              onClick={() => onTagSelect(tag)}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              #{getCategoryTagLabel(tag)}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}

export function SearchResultsPage({
  allItems,
  initialQuery,
  initialTags,
  initialSources,
}: {
  allItems: ContentItem[]
  initialQuery: string
  initialTags: string[]
  initialSources: ContentSource[]
}) {
  const router = useRouter()
  const [queryInput, setQueryInput] = useState(initialQuery)
  const [selectedSources, setSelectedSources] = useState<ContentSource[]>(initialSources)
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags)

  useEffect(() => {
    setQueryInput(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    setSelectedTags(initialTags)
  }, [initialTags])

  useEffect(() => {
    setSelectedSources(initialSources)
  }, [initialSources])

  const query = normalizeQuery(queryInput)
  const selectedSourceSet = useMemo(() => new Set(selectedSources), [selectedSources])
  const isAllSelected = selectedSourceSet.size === 0
  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags])

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>()

    for (const item of allItems) {
      if (item.source !== "blog" && item.source !== "note") continue
      for (const tag of item.tags ?? []) {
        const normalized = tag.trim()
        if (!normalized) continue
        if (!isCategoryTagVisible(normalized)) continue
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
      }
    }

    return [...counts.entries()]
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        return getCategoryTagLabel(a[0]).localeCompare(getCategoryTagLabel(b[0]), "ja")
      })
      .map(([tag, count]) => ({ tag, count, label: getCategoryTagLabel(tag) }))
  }, [allItems])

  const filteredItems = useMemo(() => {
    const sorted = [...allItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    return sorted.filter((item) => {
      if (selectedSourceSet.size > 0 && !selectedSourceSet.has(item.source)) {
        return false
      }

      if (selectedTagSet.size > 0) {
        const tags = item.tags ?? []
        if (!tags.some((tag) => selectedTagSet.has(tag))) {
          return false
        }
      }

      if (!query) return true
      return buildSearchTarget(item).includes(query)
    })
  }, [allItems, query, selectedSourceSet, selectedTagSet])

  const buildSearchHref = (
    nextQuery: string,
    nextTags: string[],
    nextSources: ContentSource[]
  ) => {
    const params = new URLSearchParams()
    const trimmedQuery = nextQuery.trim()
    if (trimmedQuery) params.set("q", trimmedQuery)
    for (const tag of nextTags) {
      params.append("tag", tag)
    }
    for (const source of nextSources) {
      params.append("source", source)
    }
    const qs = params.toString()
    return qs ? `/search?${qs}` : "/search"
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    router.push(buildSearchHref(queryInput, selectedTags, selectedSources))
  }

  const toggleFilter = (value: ContentSource | "all") => {
    if (value === "all") {
      setSelectedSources([])
      router.push(buildSearchHref(queryInput, selectedTags, []))
      return
    }

    setSelectedSources((prev) => {
      const next = prev.length === 1 && prev[0] === value ? [] : [value]
      router.push(buildSearchHref(queryInput, selectedTags, next))
      return next
    })
  }

  const isFilterActive = (value: ContentSource | "all") => {
    if (value === "all") return isAllSelected
    return selectedSourceSet.has(value)
  }

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) => {
      const next = prev.includes(tag)
        ? prev.filter((value) => value !== tag)
        : [...prev, tag]
      router.push(buildSearchHref(queryInput, next, selectedSources))
      return next
    })
  }

  const isTagFilterActive = (tag: string) => selectedTagSet.has(tag)

  const resultTitle = useMemo(() => {
    const countLabel = `（${filteredItems.length}件）`
    if (queryInput.trim()) return `${queryInput.trim()}${countLabel}`
    if (selectedTags.length > 0) {
      const labels = selectedTags.slice(0, 2).map((tag) => `#${decodeTagLabel(tag)}`)
      const suffix = selectedTags.length > 2 ? ` +${selectedTags.length - 2}` : ""
      return `${labels.join(" / ")}${suffix}${countLabel}`
    }
    return `すべてのコンテンツ${countLabel}`
  }, [filteredItems.length, queryInput, selectedTags])

  return (
    <div className="min-h-svh bg-[#f7f9f9] pb-[calc(clamp(3.75rem,8svh,4.5rem)+env(safe-area-inset-bottom))] min-[800px]:pb-0">
      <div className="mx-auto w-full max-w-[1520px] px-4 py-4 sm:px-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Link
              href="/home"
              className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-100"
              aria-label="Back to contents"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <form onSubmit={submitSearch} className="min-w-0 flex-1">
              <div className="relative">
              <button
                type="submit"
                className="absolute left-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                aria-label="Search"
              >
                <Search className="size-4" />
              </button>
              <input
                type="search"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="タイトル・本文・要約を検索"
                className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm text-slate-900 outline-none transition focus:border-[#264F8B] focus:bg-white"
                aria-label="Search query"
              />
              {queryInput && (
                <button
                  type="button"
                  onClick={() => {
                    setQueryInput("")
                    router.push(buildSearchHref("", selectedTags, selectedSources))
                  }}
                  className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
                )}
              </div>
            </form>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {sourceFilterOptions.map((source) => (
              <button
                key={source.value}
                type="button"
                onClick={() => toggleFilter(source.value)}
                aria-pressed={isFilterActive(source.value)}
                className={
                  isFilterActive(source.value)
                    ? "rounded-full bg-[#264F8B] px-3.5 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                }
              >
                {source.value === "all" ? (
                  source.label
                ) : (
                  <SourceInlineLabel source={source.value} iconClassName="size-4" />
                )}
              </button>
            ))}
          </div>

          {tagOptions.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
                {tagOptions.map(({ tag, label }) => (
                  <button
                    key={`search-tag-${tag}`}
                    type="button"
                    onClick={() => toggleTagFilter(tag)}
                    aria-pressed={isTagFilterActive(tag)}
                    className={
                      isTagFilterActive(tag)
                        ? "rounded-full bg-[#264F8B] px-3 py-1.5 text-xs font-semibold text-white"
                        : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                    }
                  >
                    #{label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-900">{resultTitle}</h2>

          {filteredItems.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-4 min-[760px]:justify-center min-[760px]:[grid-template-columns:repeat(2,320px)] min-[1100px]:[grid-template-columns:repeat(3,320px)] min-[1460px]:[grid-template-columns:repeat(4,320px)]">
              {filteredItems.map((item) => (
                <SearchResultCard
                  key={item.id}
                  item={item}
                  query={query}
                  onTagSelect={toggleTagFilter}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">該当するコンテンツがありません。</p>
              <p className="mt-2 text-xs text-slate-500">検索語や媒体フィルターを変更してください。</p>
            </div>
          )}
        </section>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur min-[800px]:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
        aria-label="Bottom navigation"
      >
        <div className={ENABLE_SUBSCRIBE_UI ? "grid grid-cols-4" : "grid grid-cols-3"}>
          <Link
            href="/home"
            className="flex h-[clamp(3.75rem,8svh,4.5rem)] flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold leading-none text-slate-700 sm:text-xs"
          >
            <Home className="size-5" />
            ホーム
          </Link>
          <Link
            href="/search"
            aria-current="page"
            className="flex h-[clamp(3.75rem,8svh,4.5rem)] flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold leading-none text-[#264F8B] sm:text-xs"
          >
            <Search className="size-5" />
            検索
          </Link>
          {ENABLE_SUBSCRIBE_UI && (
            <Link
              href="/subscribe"
              className="flex h-[clamp(3.75rem,8svh,4.5rem)] flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold leading-none text-slate-700 sm:text-xs"
            >
              <Mail className="size-5" />
              通知
            </Link>
          )}
          <a
            href="https://www.instagram.com/kudoshu_vcook/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[clamp(3.75rem,8svh,4.5rem)] flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold leading-none text-slate-700 sm:text-xs"
          >
            <Instagram className="size-5" />
            DMする
          </a>
        </div>
      </nav>
    </div>
  )
}
