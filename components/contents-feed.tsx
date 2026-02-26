"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Carrot,
  Handshake,
  Home,
  Instagram,
  Mail,
  Menu,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { type ContentItem, type ContentSource } from "@/lib/data"
import { ContentCard } from "@/components/content-card"
import { SourceInlineLabel, sourceFilterOptions } from "@/components/source-ui"

const ITEMS_PER_PAGE = 20
const DEBOUNCE_MS = 250
const LIKE_STORAGE_KEY = "ksl-content-likes-v1"

type RelatedLinkItem =
  | { kind: "source"; source: ContentSource; href: string; external: boolean }
  | {
      kind: "custom"
      label: string
      href: string
      external: true
      Icon: React.ComponentType<{ className?: string }>
    }

const relatedLinks: RelatedLinkItem[] = [
  { kind: "source", source: "blog", href: "/search?source=blog", external: false },
  { kind: "source", source: "note", href: "https://note.com/onoshu1127", external: true },
  { kind: "source", source: "ig_business", href: "https://www.instagram.com/kudoshu_vcook/", external: true },
  { kind: "source", source: "ig_photo", href: "https://www.instagram.com/onoshuphoto/", external: true },
  {
    kind: "source",
    source: "pod_yonakoi",
    href: "https://open.spotify.com/show/2AYAehcs0kEV6kU1HqX7wP?si=3691bce5c532431f",
    external: true,
  },
  {
    kind: "source",
    source: "pod_vegan",
    href: "https://open.spotify.com/show/0xEuxD2k2uwiLF9SRw7tAO?si=d53774049dd64983",
    external: true,
  },
  {
    kind: "custom",
    label: "採用情報",
    href: "https://doc.vcook.co.jp/recruit_vegansushitokyo",
    external: true,
    Icon: Handshake,
  },
  {
    kind: "custom",
    label: "株式会社ブイクック",
    href: "https://vcook.co.jp/",
    external: true,
    Icon: Carrot,
  },
]

function TimelineSearch({
  value,
  onChange,
  placeholder,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  onSubmit?: () => void
}) {
  return (
    <form
      className="relative"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.()
      }}
    >
      {onSubmit ? (
        <button
          type="submit"
          aria-label="Search"
          className="absolute left-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
        >
          <Search className="size-4" />
        </button>
      ) : (
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      )}
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:bg-white"
        aria-label="Search contents"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
        >
          <X className="size-4" />
        </button>
      )}
    </form>
  )
}

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

export function ContentsFeed({
  allItems,
  pickupItems,
  profileAvatarUrl,
}: {
  allItems: ContentItem[]
  pickupItems: ContentItem[]
  profileAvatarUrl?: string
}) {
  const router = useRouter()
  const [resolvedProfileAvatarUrl, setResolvedProfileAvatarUrl] = useState(profileAvatarUrl)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [selectedSources, setSelectedSources] = useState<ContentSource[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showStickyMenuButton, setShowStickyMenuButton] = useState(false)
  const [likesReady, setLikesReady] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [likesById, setLikesById] = useState<
    Record<string, { count: number; liked: boolean }>
  >({})

  useEffect(() => {
    setResolvedProfileAvatarUrl(profileAvatarUrl)
  }, [profileAvatarUrl])

  useEffect(() => {
    // If the server-side fetch failed (or is stale due to SSG), resolve the latest avatar on the client.
    // This endpoint is cached server-side for 1 hour.
    if (resolvedProfileAvatarUrl) return

    const controller = new AbortController()
    fetch("/api/instagram-avatar?username=kudoshu_vcook", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { avatarUrl?: string } | null) => {
        if (data?.avatarUrl) setResolvedProfileAvatarUrl(data.avatarUrl)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [resolvedProfileAvatarUrl])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LIKE_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<
          string,
          { count?: number; liked?: boolean }
        >

        const sanitized: Record<string, { count: number; liked: boolean }> = {}
        for (const [id, value] of Object.entries(parsed)) {
          const count = Number.isFinite(value.count) ? Math.max(0, Math.floor(value.count ?? 0)) : 0
          const liked = Boolean(value.liked) || count > 0
          sanitized[id] = { count, liked }
        }
        setLikesById(sanitized)
      }
    } catch {
      setLikesById({})
    } finally {
      setLikesReady(true)
    }
  }, [])

  useEffect(() => {
    if (!likesReady) return
    window.localStorage.setItem(LIKE_STORAGE_KEY, JSON.stringify(likesById))
  }, [likesById, likesReady])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim().toLowerCase())
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE)
  }, [selectedSources, selectedTags, search])

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyMenuButton(window.scrollY > 8)
    }

    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

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
    let items = [...allItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    if (selectedSourceSet.size > 0) {
      items = items.filter((item) => selectedSourceSet.has(item.source))
    }

    if (selectedTagSet.size > 0) {
      items = items.filter((item) => {
        const tags = item.tags ?? []
        return tags.some((tag) => selectedTagSet.has(tag))
      })
    }

    if (search) {
      items = items.filter((item) => {
        const target = item.searchText ??
          [
            item.title,
            item.summary ?? "",
            item.tags?.join(" ") ?? "",
            item.body ?? "",
          ]
            .join(" ")
            .toLowerCase()

        return target.includes(search)
      })
    }

    return items
  }, [allItems, selectedSourceSet, selectedTagSet, search])

  const visibleItems = filteredItems.slice(0, visibleCount)
  const hasMore = visibleItems.length < filteredItems.length

  const toggleLike = (id: string) => {
    setLikesById((prev) => {
      const current = prev[id] ?? { count: 0, liked: false }
      return {
        ...prev,
        [id]: {
          count: current.count + 1,
          liked: true,
        },
      }
    })
  }

  const buildSearchHref = (query: string) => {
    const q = query.trim()
    if (!q) return "/search"
    return `/search?q=${encodeURIComponent(q)}`
  }

  const goToSearchPage = () => {
    router.push(buildSearchHref(searchInput))
  }

  const toggleFilter = (value: ContentSource | "all") => {
    if (value === "all") {
      setSelectedSources([])
      return
    }

    setSelectedSources((prev) =>
      prev.includes(value)
        ? prev.filter((source) => source !== value)
        : [...prev, value]
    )
  }

  const isFilterActive = (value: ContentSource | "all") => {
    if (value === "all") return isAllSelected
    return selectedSourceSet.has(value)
  }

  const toggleTagFilter = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag]
    )
  }

  const isTagFilterActive = (tag: string) => selectedTagSet.has(tag)

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return

        setVisibleCount((prev) =>
          Math.min(prev + ITEMS_PER_PAGE, filteredItems.length)
        )
      },
      {
        root: null,
        rootMargin: "240px 0px 240px 0px",
        threshold: 0.01,
      }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, filteredItems.length])

  return (
    <div className="min-h-svh bg-[#f7f9f9] pb-[calc(clamp(3.75rem,8svh,4.5rem)+env(safe-area-inset-bottom))] min-[800px]:h-full min-[800px]:min-h-0 min-[800px]:overflow-hidden min-[800px]:overscroll-none min-[800px]:pb-0">
      <div className="mx-auto w-full max-w-[1320px] min-[800px]:h-full min-[800px]:min-h-0 min-[800px]:px-4">
        <div className="border-b border-slate-200 bg-white px-4 py-3 min-[800px]:hidden">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Kudo Shu Library</h1>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex size-10 items-center justify-center rounded-full border border-slate-200 text-slate-700"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>

        <div
          id="timeline-search"
          className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur min-[800px]:hidden"
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <TimelineSearch
                value={searchInput}
                onChange={setSearchInput}
                placeholder="コンテンツを検索"
                onSubmit={goToSearchPage}
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`inline-flex size-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition ${
                showStickyMenuButton ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 min-[800px]:h-full min-[800px]:min-h-0 min-[800px]:grid-cols-[44px_minmax(0,1fr)_280px] min-[800px]:gap-6 min-[800px]:overflow-hidden min-[1025px]:grid-cols-[200px_minmax(0,1fr)_280px]">
          <aside className="hidden min-[800px]:block min-[800px]:min-h-0">
            <div className="h-full overflow-y-auto overscroll-contain py-6">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <p className="px-3 text-xl font-bold tracking-tight text-slate-900 min-[800px]:max-[1024px]:px-0 min-[800px]:max-[1024px]:text-center min-[800px]:max-[1024px]:text-xs min-[800px]:max-[1024px]:leading-none">
                    <span className="min-[800px]:max-[1024px]:hidden">Kudo Shu Library</span>
                    <span className="hidden min-[800px]:max-[1024px]:inline">KSL</span>
                  </p>

                  <nav className="mt-6 space-y-2" aria-label="Main menu">
                    <Link
                      href="/home"
                      className="flex items-center gap-3 rounded-full px-3 py-2 text-base font-semibold text-slate-900 transition hover:bg-slate-200 min-[800px]:max-[1024px]:mx-auto min-[800px]:max-[1024px]:h-10 min-[800px]:max-[1024px]:w-10 min-[800px]:max-[1024px]:justify-center min-[800px]:max-[1024px]:px-0 min-[800px]:max-[1024px]:py-0"
                    >
                      <Home className="size-5" />
                      <span className="min-[800px]:max-[1024px]:hidden">ホーム</span>
                    </Link>
                    <button
                      type="button"
                      onClick={goToSearchPage}
                      className="flex items-center gap-3 rounded-full px-3 py-2 text-base font-semibold text-slate-900 transition hover:bg-slate-200 min-[800px]:max-[1024px]:mx-auto min-[800px]:max-[1024px]:h-10 min-[800px]:max-[1024px]:w-10 min-[800px]:max-[1024px]:justify-center min-[800px]:max-[1024px]:px-0 min-[800px]:max-[1024px]:py-0"
                    >
                      <Search className="size-5" />
                      <span className="min-[800px]:max-[1024px]:hidden">検索</span>
                    </button>
                    <a
                      href="https://www.instagram.com/kudoshu_vcook/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-full px-3 py-2 text-base font-semibold text-slate-900 transition hover:bg-slate-200 min-[800px]:max-[1024px]:mx-auto min-[800px]:max-[1024px]:h-10 min-[800px]:max-[1024px]:w-10 min-[800px]:max-[1024px]:justify-center min-[800px]:max-[1024px]:px-0 min-[800px]:max-[1024px]:py-0"
                    >
                      <Instagram className="size-5" />
                      <span className="min-[800px]:max-[1024px]:hidden">DMする</span>
                    </a>
                  </nav>
                </div>

                <a
                  href="/subscribe"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 min-[800px]:max-[1024px]:mx-auto min-[800px]:max-[1024px]:h-10 min-[800px]:max-[1024px]:w-10 min-[800px]:max-[1024px]:px-0 min-[1025px]:w-full min-[1025px]:px-5"
                >
                  <Mail className="size-4 min-[1025px]:hidden" />
                  <span className="min-[800px]:max-[1024px]:hidden">メール通知</span>
                </a>
              </div>
            </div>
          </aside>

          <main
            className="min-w-0 border-x border-slate-200 bg-white min-[800px]:h-full min-[800px]:min-h-0 min-[800px]:overflow-y-auto min-[800px]:overscroll-contain"
            aria-labelledby="timeline-heading"
          >
            <section className="border-b border-slate-200">
              <h2 id="timeline-heading" className="sr-only">
                Contents timeline
              </h2>

              <div className="relative h-44 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-800 sm:h-56">
                <img
                  src="/header.jpg"
                  alt="Header"
                  className="h-full w-full object-cover"
                  decoding="async"
                  onError={(event) => {
                    const target = event.currentTarget
                    target.style.display = "none"
                  }}
                />
                <a
                  href="https://www.instagram.com/kudoshu_vcook/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-0 left-4 z-10 inline-flex size-24 translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-200 sm:left-6 sm:size-32"
                  aria-label="Open Instagram profile"
                >
                  {resolvedProfileAvatarUrl ? (
                    <img
                      src={resolvedProfileAvatarUrl}
                      alt="kudoshu_vcook"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(event) => {
                        const target = event.currentTarget
                        target.style.display = "none"
                      }}
                    />
                  ) : (
                    <Instagram className="size-10 text-slate-700" />
                  )}
                </a>
              </div>

              <div className="px-6 pt-4">
                <div className="flex justify-end">
                  <Link
                    href="/subscribe"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                  >
                    <Mail className="size-4" />
                    <span className="whitespace-nowrap">メール通知する</span>
                  </Link>
                </div>
              </div>

              <div className="px-6 pb-5 pt-2 sm:pt-3">
                <div className="mt-4 sm:mt-5">
                  <p className="text-2xl font-bold text-slate-900">工藤 柊 / Kudo Shu</p>
                  <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
                    <p>株式会社ブイクック代表取締役CEO</p>
                    <p>1999年2月28日大阪生まれ。2024年入籍し小野に名字変更（仕事は工藤のまま）。</p>
                    <p>高校3年生で環境問題・動物倫理からヴィーガン生活を開始。</p>
                    <p>神戸大学国際人間科学部環境共生学科に入学後、学食へヴィーガンメニュー導入、ヴィーガンカフェThallo店長など活動。</p>
                    <p>学生起業しNPO法人設立後、事業拡大のため2020年4月に株式会社ブイクックを創業。2024年東京初ヴィーガン専門店「Vegan Sushi Tokyo」を開店。</p>
                    <p>夢は世界平和。趣味は恋バナと漫画・アニメ。</p>
                  </div>
                </div>
              </div>
            </section>

            <section
              id="timeline-search-desktop"
              className="sticky top-0 z-30 hidden border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur min-[800px]:block"
            >
              <TimelineSearch
                value={searchInput}
                onChange={setSearchInput}
                placeholder="タイトル・本文・要約を検索"
                onSubmit={goToSearchPage}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {sourceFilterOptions.map((source) => (
                  <button
                    key={source.value}
                    type="button"
                    onClick={() => toggleFilter(source.value)}
                    aria-pressed={isFilterActive(source.value)}
                    className={
                      isFilterActive(source.value)
                        ? "rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white"
                        : "rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                    }
                  >
                    {source.value === "all" ? (
                      source.label
                    ) : (
                      <SourceInlineLabel source={source.value} iconClassName="size-3.5" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            {pickupItems.length > 0 && (
              <section className="border-b border-slate-200 px-4 py-4 min-[800px]:hidden">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="size-4 text-sky-500" />
                  <h3 className="text-sm font-semibold text-slate-900">おすすめ</h3>
                </div>
                <div className="flex gap-0 overflow-x-auto pb-1">
                  {pickupItems.map((item) => (
                    <ContentCard key={item.id} item={item} variant="pickup" />
                  ))}
                </div>
              </section>
            )}

            <section className="sticky top-[69px] z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur min-[800px]:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sourceFilterOptions.map((source) => (
                  <button
                    key={source.value}
                    type="button"
                    onClick={() => toggleFilter(source.value)}
                    aria-pressed={isFilterActive(source.value)}
                    className={
                      isFilterActive(source.value)
                        ? "shrink-0 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        : "shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
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
            </section>

            <section>
              {visibleItems.length > 0 ? (
                <div>
                  {visibleItems.map((item) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      variant="feed"
                      likeCount={likesById[item.id]?.count ?? 0}
                      isLiked={likesById[item.id]?.liked ?? false}
                      onToggleLike={() => toggleLike(item.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="border-b border-slate-200 px-4 py-14 text-center">
                  <p className="text-sm font-semibold text-slate-700">該当するコンテンツがありません。</p>
                  <p className="mt-2 text-xs text-slate-500">検索語やフィルターを変更してください。</p>
                </div>
              )}
            </section>

            {hasMore && <div ref={loadMoreRef} className="h-1 w-full" aria-hidden="true" />}
          </main>

          <aside className="hidden min-[800px]:block min-[800px]:h-full min-[800px]:min-h-0 min-[800px]:overflow-y-auto min-[800px]:overscroll-contain">
            <div className="space-y-4 py-4">
              <TimelineSearch
                value={searchInput}
                onChange={setSearchInput}
                placeholder="検索"
                onSubmit={goToSearchPage}
              />

              {tagOptions.length > 0 && (
                <section className="rounded-2xl bg-white p-4">
                  <h3 className="text-lg font-bold text-slate-900">ハッシュタグ</h3>
                  <div className="mt-3 flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
                    {tagOptions.map(({ tag, label }) => (
                      <Link
                        key={tag}
                        href={`/search?tag=${encodeURIComponent(tag)}`}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        #{label}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-2xl bg-white p-4">
                <h3 className="text-lg font-bold text-slate-900">関連リンク</h3>
                <ul className="mt-3 space-y-2">
                  {relatedLinks.map((linkItem) => (
                    <li key={linkItem.kind === "source" ? linkItem.source : linkItem.href}>
                      {linkItem.kind === "source" ? (
                        linkItem.external ? (
                          <a
                            href={linkItem.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            <SourceInlineLabel source={linkItem.source} />
                          </a>
                        ) : (
                          <Link
                            href={linkItem.href}
                            className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                          >
                            <SourceInlineLabel source={linkItem.source} />
                          </Link>
                        )
                      ) : (
                        <a
                          href={linkItem.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          <span className="inline-flex items-center gap-2">
                            <linkItem.Icon className="size-4" />
                            <span>{linkItem.label}</span>
                          </span>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {pickupItems.length > 0 && (
                <section className="rounded-2xl bg-white p-4">
                  <h3 className="text-lg font-bold text-slate-900">おすすめ</h3>
                  <div className="mt-3 space-y-0">
                    {pickupItems.map((item) => (
                      <ContentCard key={item.id} item={item} variant="pickup" />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </aside>
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur min-[800px]:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
        aria-label="Bottom navigation"
      >
        <div className="grid grid-cols-4">
          <Link
            href="/home"
            className="flex h-[clamp(3.75rem,8svh,4.5rem)] flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold leading-none text-slate-700 sm:text-xs"
          >
            <Home className="size-5" />
            ホーム
          </Link>
          <a
            href="#timeline-search"
            className="flex h-[clamp(3.75rem,8svh,4.5rem)] flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold leading-none text-slate-700 sm:text-xs"
          >
            <Search className="size-5" />
            検索
          </a>
          <Link
            href="/subscribe"
            className="flex h-[clamp(3.75rem,8svh,4.5rem)] flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold leading-none text-slate-700 sm:text-xs"
          >
            <Mail className="size-5" />
            通知
          </Link>
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

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 min-[800px]:hidden" role="dialog" aria-modal="true">
          <div
            className="ml-auto h-full max-h-svh w-[85%] max-w-sm overflow-y-auto overscroll-contain bg-white p-5"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">メニュー</h2>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-700"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="mt-5 space-y-2 border-b border-slate-200 pb-5">
              <Link
                href="/home"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                <Home className="size-4" />
                ホーム
              </Link>
              <a
                href="#timeline-search"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                <Search className="size-4" />
                検索
              </a>
              <Link
                href="/subscribe"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                <Mail className="size-4" />
                メール通知
              </Link>
              <a
                href="https://www.instagram.com/kudoshu_vcook/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                <Instagram className="size-4" />
                DMする
              </a>
            </nav>

            <section className="pt-5">
              <h3 className="text-sm font-semibold text-slate-900">関連リンク</h3>
              <ul className="mt-3 space-y-2">
                {relatedLinks.map((linkItem) => (
                  <li key={`mobile-${linkItem.kind === "source" ? linkItem.source : linkItem.href}`}>
                    {linkItem.kind === "source" ? (
                      linkItem.external ? (
                        <a
                          href={linkItem.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <SourceInlineLabel source={linkItem.source} />
                        </a>
                      ) : (
                        <Link
                          href={linkItem.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                        >
                          <SourceInlineLabel source={linkItem.source} />
                        </Link>
                      )
                    ) : (
                      <a
                        href={linkItem.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        <span className="inline-flex items-center gap-2">
                          <linkItem.Icon className="size-4" />
                          <span>{linkItem.label}</span>
                        </span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>

              {tagOptions.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div aria-hidden="true" />
                    {selectedTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTags([])}
                        className="text-xs font-semibold text-slate-500 transition hover:text-slate-800"
                      >
                        クリア
                      </button>
                    )}
                  </div>
                  <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
                    {tagOptions.map(({ tag, label }) => (
                      <Link
                        key={`mobile-${tag}`}
                        href={`/search?tag=${encodeURIComponent(tag)}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        #{label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
