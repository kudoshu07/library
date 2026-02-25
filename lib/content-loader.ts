import "server-only"

import fs from "node:fs/promises"
import path from "node:path"
import type { Dirent } from "node:fs"
import { cache } from "react"
import { type ContentItem, type ContentSource } from "@/lib/data"

const CONTENT_ROOT = path.join(process.cwd(), "content")
const BLOG_ROOT = path.join(CONTENT_ROOT, "blog")
const EXTERNAL_ROOT = path.join(CONTENT_ROOT, "external")
const PICKUP_FILE = path.join(CONTENT_ROOT, "pickup.json")
const INSTAGRAM_APP_ID = "936619743392459"
const INSTAGRAM_ASBD_ID = "129477"
const INSTAGRAM_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
const DEFAULT_INSTAGRAM_FETCH_LIMIT = 12
const MAX_INSTAGRAM_FETCH_LIMIT = 100
const DEFAULT_INSTAGRAM_GRAPH_API_VERSION = "v24.0"

type ExternalSeed = {
  id?: string
  title: string
  date: string
  url: string
  summary?: string
  tags?: string[]
  thumbnail?: string
}

type PodcastSeed = {
  source: "pod_yonakoi" | "pod_vegan"
  title: string
  date?: string
  url: string
  summary?: string
}

type InstagramTimelineNode = {
  shortcode?: string
  taken_at_timestamp?: number
  display_url?: string
  thumbnail_src?: string
  edge_media_to_caption?: {
    edges?: Array<{
      node?: {
        text?: string
      }
    }>
  }
}

type InstagramProfileResponse = {
  data?: {
    user?: {
      profile_pic_url?: string
      profile_pic_url_hd?: string
      edge_owner_to_timeline_media?: {
        edges?: Array<{
          node?: InstagramTimelineNode
        }>
      }
    }
  }
}

type InstagramGraphMediaChild = {
  id?: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
}

type InstagramGraphMedia = {
  id?: string
  caption?: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  children?: { data?: InstagramGraphMediaChild[] }
}

type InstagramGraphMediaResponse = {
  data?: InstagramGraphMedia[]
  paging?: {
    cursors?: { after?: string }
    next?: string
  }
}

function parseFrontmatter(raw: string): {
  data: Record<string, string | string[]>
  body: string
} {
  if (!raw.startsWith("---\n")) {
    return { data: {}, body: raw.trim() }
  }

  const end = raw.indexOf("\n---\n", 4)
  if (end === -1) {
    return { data: {}, body: raw.trim() }
  }

  const frontmatter = raw.slice(4, end).trim()
  const body = raw.slice(end + 5).trim()
  const data: Record<string, string | string[]> = {}

  const lines = frontmatter.split("\n")
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const sep = line.indexOf(":")
    if (sep === -1) continue

    const key = line.slice(0, sep).trim()
    const value = line.slice(sep + 1).trim()

    if (key === "tags") {
      if (value.startsWith("[") && value.endsWith("]")) {
        data.tags = value
          .slice(1, -1)
          .split(",")
          .map((tag) => stripQuotes(tag.trim()))
          .filter(Boolean)
        continue
      }

      if (!value) {
        const tags: string[] = []
        while (i + 1 < lines.length && lines[i + 1].trim().startsWith("- ")) {
          i += 1
          tags.push(stripQuotes(lines[i].trim().slice(2).trim()))
        }
        data.tags = tags
        continue
      }
    }

    data[key] = stripQuotes(value)
  }

  return { data, body }
}

function stripQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function normalizeTagValue(raw: string): string | null {
  const trimmed = raw.trim().replace(/^[#＃]/, "")
  if (!trimmed) return null

  const decoded = safeDecodeURIComponent(trimmed).trim()
  if (!decoded) return null

  if (decoded === "事業") return "business"
  if (decoded === "組織") return "org"
  return trimmed
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags || tags.length === 0) return []
  const normalized = tags.map((tag) => normalizeTagValue(tag)).filter((tag): tag is string => Boolean(tag))
  return Array.from(new Set(normalized))
}

function stripHtml(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function makeSummary(body: string): string {
  const text = stripMarkdown(body)
  if (!text) return ""
  if (text.length <= 140) return text
  return `${text.slice(0, 140).trim()}...`
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 3).trim()}...`
}

function normalizeDate(input: string, fallback?: string): string {
  const date = new Date(input)
  if (!Number.isNaN(date.getTime())) return date.toISOString()
  if (fallback) return fallback
  return new Date(0).toISOString()
}

function parseInteger(input: string | undefined, fallback: number): number {
  if (!input) return fallback
  const parsed = Number.parseInt(input, 10)
  if (Number.isNaN(parsed)) return fallback
  return parsed
}

function parseInstagramShortcodeFromPermalink(permalink: string | undefined): string | undefined {
  const url = String(permalink ?? "").trim()
  if (!url) return undefined

  // Examples:
  // https://www.instagram.com/p/SHORTCODE/
  // https://www.instagram.com/reel/SHORTCODE/
  const match = url.match(/instagram\.com\/(?:p|reel)\/([^/]+)/i)
  return match?.[1]?.trim()
}

function proxyThumbnailUrl(raw: string | undefined): string | undefined {
  const url = String(raw ?? "").trim()
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return `/api/thumbnail?src=${encodeURIComponent(url)}`
  return url
}

async function listMdxFiles(dir: string): Promise<string[]> {
  let entries: Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return listMdxFiles(fullPath)
      if (entry.isFile() && fullPath.endsWith(".mdx")) return [fullPath]
      return []
    })
  )

  return nested.flat()
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as T[]
    return []
  } catch {
    return []
  }
}

function buildSearchText(item: {
  title: string
  summary?: string
  tags?: string[]
  body?: string
}): string {
  return [item.title, item.summary ?? "", item.tags?.join(" ") ?? "", item.body ?? ""]
    .join(" ")
    .toLowerCase()
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed
}

function simpleHash(value: string): string {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function extractRssTag(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i"))
  if (!match?.[1]) return ""
  return match[1].trim()
}

function extractHashtagsFromText(input: string): string[] {
  const plain = stripHtml(input)
  return Array.from(
    new Set(
      Array.from(plain.matchAll(/[#＃]([^\s#＃]+)/g))
        .map((match) => (match[1] ?? "").trim())
        .map((tag) => tag.replace(/[.,、。!！?？:：;；]+$/g, ""))
        .filter(Boolean)
    )
  )
}

function extractRssTags(block: string, rawTitle = "", rawDescription = ""): string[] {
  const matches = [
    ...Array.from(block.matchAll(/<category>([\s\S]*?)<\/category>/gi)),
    ...Array.from(block.matchAll(/<dc:subject>([\s\S]*?)<\/dc:subject>/gi)),
  ]

  return Array.from(
    new Set(
      [
        ...matches
          .map((match) => stripHtml(match[1] ?? "").trim())
          .map((tag) => tag.replace(/^[#＃]/, "").trim())
          .filter(Boolean),
        ...extractHashtagsFromText(rawTitle),
        ...extractHashtagsFromText(rawDescription),
      ]
    )
  )
}

function extractRssThumbnail(block: string): string | undefined {
  const mediaText = block.match(/<media:thumbnail>([\s\S]*?)<\/media:thumbnail>/i)
  if (mediaText?.[1]) return mediaText[1].trim()

  const media = block.match(/<media:thumbnail[^>]*url=["']([^"']+)["'][^>]*>/i)
  if (media?.[1]) return media[1]

  const enclosure = block.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image\//i)
  if (enclosure?.[1]) return enclosure[1]

  const imageInDescription = block.match(/<img[^>]*src=["']([^"']+)["']/i)
  if (imageInDescription?.[1]) return imageInDescription[1]

  return undefined
}

function parseNoteRss(xml: string): ExternalSeed[] {
  const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/gi) ?? []

  return itemBlocks
    .map((block) => {
      const rawTitle = extractRssTag(block, "title")
      const rawLink = extractRssTag(block, "link")
      const rawDate = extractRssTag(block, "pubDate")
      const rawDescription = extractRssTag(block, "description")
      const summary = stripHtml(rawDescription)
      const tags = normalizeTags(extractRssTags(block, rawTitle, rawDescription))

      if (!rawTitle || !rawLink || !rawDate) {
        return null
      }

      const normalizedLink = normalizeUrl(stripHtml(rawLink))

      const seed: ExternalSeed = {
        id: `note:rss:${simpleHash(normalizedLink)}`,
        title: stripHtml(rawTitle),
        url: normalizedLink,
        date: normalizeDate(stripHtml(rawDate)),
        summary,
        tags,
        thumbnail: extractRssThumbnail(block),
      }
      return seed
    })
    .filter((item): item is ExternalSeed => item !== null)
}

function parseInstagramCaption(caption: string): {
  title: string
  summary: string
  tags: string[]
} {
  const normalized = caption.replace(/\s+/g, " ").trim()
  const firstLine = caption
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)

  const title = firstLine ? truncateText(firstLine, 64) : "Instagram post"
  const summary = normalized ? truncateText(normalized, 140) : ""
  const tags = normalizeTags(
    Array.from(new Set(Array.from(caption.matchAll(/#([^\s#]+)/g)).map((match) => match[1]))).slice(0, 8)
  )

  return {
    title,
    summary,
    tags,
  }
}

function toInstagramItem(
  source: "ig_business" | "ig_photo",
  username: string,
  node: InstagramTimelineNode
): ContentItem | null {
  const shortcode = node.shortcode?.trim()
  const takenAt = node.taken_at_timestamp
  if (!shortcode || !takenAt) {
    return null
  }

  const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text?.trim() ?? ""
  const { title, summary, tags } = parseInstagramCaption(caption)
  const fallbackSummary = summary || `Latest post from @${username}`
  const date = normalizeDate(new Date(takenAt * 1000).toISOString())
  const url = `https://www.instagram.com/p/${shortcode}/`
  const rawThumbnail = node.display_url ?? node.thumbnail_src
  const thumbnail = rawThumbnail
    ? `/api/thumbnail?src=${encodeURIComponent(rawThumbnail)}`
    : undefined

  return {
    id: `${source}:ig:${shortcode}`,
    source,
    title,
    date,
    url,
    summary: fallbackSummary,
    tags,
    thumbnail,
    body: caption,
    searchText: buildSearchText({ title, summary: fallbackSummary, tags, body: caption }),
  }
}

function toExternalItem(source: ContentSource, seed: ExternalSeed, index: number): ContentItem {
  const normalizedDate = normalizeDate(seed.date)
  const title = seed.title.trim()
  const summary = (seed.summary ?? "").trim()
  const url = normalizeUrl(seed.url)
  const tags = normalizeTags(seed.tags)
  const rawThumbnail = (seed.thumbnail ?? "").trim()
  const thumbnail =
    rawThumbnail && /^https?:\/\//i.test(rawThumbnail)
      ? `/api/thumbnail?src=${encodeURIComponent(rawThumbnail)}`
      : rawThumbnail || undefined

  return {
    id:
      seed.id ??
      (source === "note"
        ? `note:rss:${simpleHash(url)}`
        : `${source}:${simpleHash(`${url}:${index}`)}`),
    source,
    title,
    date: normalizedDate,
    url,
    summary,
    tags,
    thumbnail,
    body: "",
    searchText: buildSearchText({ title, summary, tags }),
  }
}

async function loadBlogPosts(): Promise<ContentItem[]> {
  const filePaths = await listMdxFiles(BLOG_ROOT)

  const posts = await Promise.all(
    filePaths.map(async (filePath) => {
      const relative = path.relative(BLOG_ROOT, filePath)
      const parts = relative.split(path.sep)
      if (parts.length < 4) return null

      const [year, month, day, filename] = parts
      const slug = filename.replace(/\.mdx$/, "")

      const raw = await fs.readFile(filePath, "utf-8")
      const { data, body } = parseFrontmatter(raw)
      const title = String(data.title ?? slug.replace(/-/g, " ")).trim()
      const date = normalizeDate(String(data.date ?? `${year}-${month}-${day}T00:00:00.000Z`))
      const summary = String(data.summary ?? makeSummary(body)).trim()
      const tags = normalizeTags(Array.isArray(data.tags) ? data.tags : [])
      const rawThumbnail = typeof data.thumbnail === "string" ? data.thumbnail.trim() : ""
      const thumbnail =
        rawThumbnail && /^https?:\/\//i.test(rawThumbnail)
          ? `/api/thumbnail?src=${encodeURIComponent(rawThumbnail)}`
          : rawThumbnail || undefined
      const url = `/${year}/${month}/${day}/${slug}/`

      const post: ContentItem = {
        id: `blog:${year}${month}${day}:${slug}`,
        source: "blog" as const,
        title,
        date,
        url,
        year,
        month,
        day,
        slug,
        summary,
        tags,
        thumbnail,
        body,
        searchText: buildSearchText({ title, summary, tags, body: stripMarkdown(body) }),
      }
      return post
    })
  )

  return posts
    .filter((post): post is ContentItem => post !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

async function loadExternalFromFile(fileName: string, source: ContentSource): Promise<ContentItem[]> {
  const seeds = await readJsonArray<ExternalSeed>(path.join(EXTERNAL_ROOT, fileName))

  return seeds
    .map((seed, index) => toExternalItem(source, seed, index))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

async function loadNoteFallback(): Promise<ContentItem[]> {
  const seeds = await readJsonArray<ExternalSeed>(path.join(EXTERNAL_ROOT, "note-fallback.json"))
  return seeds
    .map((seed, index) => toExternalItem("note", seed, index))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function extractOpenGraphContent(html: string, property: string): string | undefined {
  const pattern = new RegExp(
    `<meta[^>]+property=["']${property.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  )
  const match = html.match(pattern)
  if (!match?.[1]) return undefined
  return safeDecodeURIComponent(match[1].trim())
}

async function resolveOpenGraphImage(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 },
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KudoShuLibraryBot/1.0; +https://kudoshu07.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    })
    if (!response.ok) return undefined
    const html = await response.text()
    const ogImage = extractOpenGraphContent(html, "og:image")
    if (!ogImage) return undefined
    return `/api/thumbnail?src=${encodeURIComponent(ogImage)}`
  } catch {
    return undefined
  }
}

type SpotifyShowInitialState = {
  entities?: {
    items?: Record<
      string,
      {
        pages?: {
          items?: Array<{
            entity?: {
              data?: {
                id?: string
                name?: string
                description?: string
                releaseDate?: { isoString?: string }
                coverArt?: { sources?: Array<{ url?: string }> }
              }
            }
          }>
          pagingInfo?: { nextOffset?: number }
          totalCount?: number
        }
      }
    >
  }
}

function normalizeSentence(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim()
}

function extractSpotifyShowId(url: string): string | undefined {
  const match = url.match(/open\.spotify\.com\/show\/([a-zA-Z0-9]+)/)
  return match?.[1]
}

function extractSpotifyInitialState(html: string): string | undefined {
  // Be liberal about attribute order/whitespace; Spotify occasionally changes markup.
  const match = html.match(/<script[^>]+id=["']initialState["'][^>]*>([^<]+)<\/script>/i)
  return match?.[1]?.trim()
}

function canonicalSpotifyShowUrl(showId: string): string {
  return `https://open.spotify.com/show/${showId}`
}

type SpotifyWebAccessTokenResponse = {
  accessToken?: string
  accessTokenExpirationTimestampMs?: number
  isAnonymous?: boolean
}

type SpotifyApiEpisode = {
  id: string
  name: string
  description?: string
  release_date: string
  release_date_precision?: "year" | "month" | "day"
  external_urls?: { spotify?: string }
  images?: Array<{ url?: string }>
}

type SpotifyApiShowEpisodesResponse = {
  items: SpotifyApiEpisode[]
  limit: number
  offset: number
  total: number
  next: string | null
}

type SpotifyClientCredentialsResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
}

let spotifyAppTokenCache: { token: string; expiresAtMs: number } | null = null
// Spotify tends to serve the full `initialState` HTML for generic UA, while more bot-like UA strings can trigger
// simplified/blocked markup (missing `initialState`).
const SPOTIFY_WEB_USER_AGENT = "Mozilla/5.0"

async function getSpotifyAppAccessToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim()
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null

  const now = Date.now()
  if (spotifyAppTokenCache && spotifyAppTokenCache.expiresAtMs > now) {
    return spotifyAppTokenCache.token
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": SPOTIFY_WEB_USER_AGENT,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      next: { revalidate: 3300 },
    })

    if (!response.ok) return null
    const data = (await response.json()) as SpotifyClientCredentialsResponse
    const token = data.access_token?.trim()
    if (!token) return null
    const expiresIn = Math.max(0, Math.floor(data.expires_in ?? 0))
    // refresh 60s early
    const expiresAtMs = now + Math.max(0, (expiresIn - 60) * 1000)
    spotifyAppTokenCache = { token, expiresAtMs }
    return token
  } catch {
    return null
  }
}

function toSpotifyEpisodeItem(seed: PodcastSeed, episode: SpotifyApiEpisode): ContentItem | null {
  const episodeId = episode.id?.trim()
  const title = (episode.name ?? "").trim()
  if (!episodeId || !title) return null

  const description = normalizeSentence(episode.description ?? "")
  const summary = description ? truncateText(description, 140) : ""

  // Spotify API returns release_date in YYYY-MM-DD (day precision for episodes).
  const date = normalizeDate(episode.release_date ? `${episode.release_date}T00:00:00.000Z` : seed.date ?? new Date().toISOString())
  const url = episode.external_urls?.spotify?.trim() || `https://open.spotify.com/episode/${episodeId}`

  const rawCover = episode.images?.[0]?.url?.trim()
  const thumbnail = rawCover ? `/api/thumbnail?src=${encodeURIComponent(rawCover)}` : undefined

  return {
    id: `podcast:${seed.source}:episode:${episodeId}`,
    source: seed.source,
    title,
    date,
    url,
    summary,
    tags: [],
    thumbnail,
    body: "",
    searchText: buildSearchText({ title, summary }),
  }
}

async function fetchSpotifyShowEpisodesViaApi(seed: PodcastSeed): Promise<ContentItem[]> {
  const showUrlInput = normalizeUrl(seed.url)
  if (!showUrlInput) return []

  const showId = extractSpotifyShowId(showUrlInput)
  if (!showId) return []

  const token = await getSpotifyAppAccessToken()
  if (!token) return []

  const items: ContentItem[] = []
  const limit = 50
  let offset = 0
  let guard = 0

  while (guard < 40) {
    guard += 1
    const apiUrl = `https://api.spotify.com/v1/shows/${encodeURIComponent(showId)}/episodes?market=JP&limit=${limit}&offset=${offset}`

    let data: SpotifyApiShowEpisodesResponse
    try {
      const response = await fetch(apiUrl, {
        next: { revalidate: 3600 },
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": SPOTIFY_WEB_USER_AGENT,
          Accept: "application/json",
        },
      })
      if (!response.ok) {
        // Token might have expired early.
        if (response.status === 401) {
          spotifyAppTokenCache = null
        }
        break
      }
      data = (await response.json()) as SpotifyApiShowEpisodesResponse
    } catch {
      break
    }

    const batch = (data.items ?? [])
      .map((episode) => toSpotifyEpisodeItem(seed, episode))
      .filter((item): item is ContentItem => item !== null)

    items.push(...batch)

    if (!data.next || batch.length === 0) break
    offset += limit
    if (typeof data.total === "number" && offset >= data.total) break
  }

  return items
}

async function buildPodcastShowFallback(
  seed: PodcastSeed,
  showId: string,
  showUrl: string
): Promise<ContentItem[]> {
  const showDescription = normalizeSentence(seed.summary ?? "")
  const showSummary = showDescription ? truncateText(showDescription, 140) : ""

  return [
    {
      id: `podcast:${seed.source}:show:${showId}`,
      source: seed.source,
      title: seed.title,
      date: normalizeDate(seed.date ?? new Date().toISOString()),
      url: showUrl,
      summary: showSummary,
      tags: [],
      thumbnail: await resolveOpenGraphImage(showUrl),
      body: "",
      searchText: buildSearchText({ title: seed.title, summary: showSummary }),
    },
  ]
}

async function fetchSpotifyShowEpisodes(
  seed: PodcastSeed
): Promise<ContentItem[]> {
  // Prefer the API route (full episode list). Fallback to HTML parsing when blocked.
  const viaApi = await fetchSpotifyShowEpisodesViaApi(seed)
  if (viaApi.length > 0) return viaApi

  const showUrlInput = normalizeUrl(seed.url)
  if (!showUrlInput) return []

  const showId = extractSpotifyShowId(showUrlInput)
  if (!showId) return []

  // Use canonical URL for fetching to avoid cache-busting query params like `?si=...`.
  const showUrl = canonicalSpotifyShowUrl(showId)

  try {
    const response = await fetch(showUrl, {
      next: { revalidate: 3600 },
      headers: {
        "User-Agent": SPOTIFY_WEB_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    })
    if (!response.ok) return buildPodcastShowFallback(seed, showId, showUrl)

    const html = await response.text()
    const encoded = extractSpotifyInitialState(html)
    if (!encoded) return buildPodcastShowFallback(seed, showId, showUrl)

    const parsed = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8")
    ) as SpotifyShowInitialState

    const showKey = `spotify:show:${showId}`
    const show = parsed.entities?.items?.[showKey]
    const pageItems = show?.pages?.items ?? []

    const episodes = pageItems
      .map((item) => item.entity?.data)
      .map((episode) => {
        if (!episode) return null
        const episodeId = episode.id?.trim()
        const title = (episode.name ?? "").trim()
        if (!episodeId || !title) return null

        const description = normalizeSentence(episode.description ?? "")
        const summary = description ? truncateText(description, 140) : ""
        const releaseIso = episode.releaseDate?.isoString?.trim()
        const date = normalizeDate(releaseIso ?? seed.date ?? new Date().toISOString())

        const rawCover = episode.coverArt?.sources?.[0]?.url?.trim()
        const thumbnail = rawCover ? `/api/thumbnail?src=${encodeURIComponent(rawCover)}` : undefined

        const url = `https://open.spotify.com/episode/${episodeId}`

        const item: ContentItem = {
          id: `podcast:${seed.source}:episode:${episodeId}`,
          source: seed.source,
          title,
          date,
          url,
          summary,
          tags: [],
          thumbnail,
          body: "",
          searchText: buildSearchText({ title, summary }),
        }
        return item
      })
      .filter((item): item is ContentItem => item !== null)

    if (episodes.length > 0) return episodes

    return buildPodcastShowFallback(seed, showId, showUrl)
  } catch {
    return buildPodcastShowFallback(seed, showId, showUrl)
  }
}

async function loadPodcastEpisodes(): Promise<ContentItem[]> {
  let seeds: PodcastSeed[] = []
  try {
    seeds = await readJsonArray<PodcastSeed>(path.join(EXTERNAL_ROOT, "podcasts.json"))
  } catch {
    return []
  }

  const episodeLists = await Promise.all(seeds.map((seed) => fetchSpotifyShowEpisodes(seed)))
  const items = episodeLists.flat()

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

async function loadNoteItems(): Promise<ContentItem[]> {
  const rssUrl = process.env.NOTE_RSS_URL
  if (!rssUrl) {
    return loadNoteFallback()
  }

  try {
    const response = await fetch(rssUrl, {
      next: { revalidate: 3600 },
      headers: {
        "User-Agent": "KudoShuLibraryBot/1.0 (+https://kudoshu07.com)",
      },
    })

    if (!response.ok) {
      return loadNoteFallback()
    }

    const xml = await response.text()
    const seeds = parseNoteRss(xml)

    if (seeds.length === 0) {
      return loadNoteFallback()
    }

    return seeds
      .map((seed, index) => toExternalItem("note", seed, index))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch {
    return loadNoteFallback()
  }
}

function toInstagramGraphItem(
  source: "ig_business" | "ig_photo",
  username: string,
  media: InstagramGraphMedia
): ContentItem | null {
  const permalink = (media.permalink ?? "").trim()
  const shortcode = parseInstagramShortcodeFromPermalink(permalink)
  const idPart = shortcode || (media.id ?? "").trim()
  if (!idPart) return null

  const caption = String(media.caption ?? "").trim()
  const { title, summary, tags } = parseInstagramCaption(caption)

  const date = normalizeDate(String(media.timestamp ?? ""))
  const url = permalink || (shortcode ? `https://www.instagram.com/p/${shortcode}/` : "")
  if (!url) return null

  const mediaType = String(media.media_type ?? "").toUpperCase()
  let rawThumb = ""

  if (mediaType === "VIDEO") {
    rawThumb = String(media.thumbnail_url ?? "").trim() || String(media.media_url ?? "").trim()
  } else {
    rawThumb = String(media.media_url ?? "").trim() || String(media.thumbnail_url ?? "").trim()
  }

  // CAROUSEL_ALBUM sometimes has a better image in children.
  if (!rawThumb && Array.isArray(media.children?.data) && media.children?.data?.length) {
    const child = media.children.data[0]
    rawThumb =
      String(child?.media_url ?? "").trim() ||
      String(child?.thumbnail_url ?? "").trim()
  }

  const thumbnail = proxyThumbnailUrl(rawThumb)
  const normalizedUsername = username.trim().replace(/^@/, "")

  return {
    id: `ig:${normalizedUsername || username || source}:${idPart}`,
    source,
    title,
    date,
    url,
    summary,
    tags,
    thumbnail,
    body: "",
    searchText: buildSearchText({ title, summary, tags }),
  }
}

async function fetchInstagramItemsViaGraphApi({
  source,
  username,
  igUserId,
  accessToken,
  limit,
  apiVersion = DEFAULT_INSTAGRAM_GRAPH_API_VERSION,
}: {
  source: "ig_business" | "ig_photo"
  username: string
  igUserId: string
  accessToken: string
  limit: number
  apiVersion?: string
}): Promise<ContentItem[]> {
  const normalizedIgUserId = igUserId.trim()
  const token = accessToken.trim()
  if (!normalizedIgUserId || !token) return []

  const fields = [
    "id",
    "caption",
    "media_type",
    "media_url",
    "thumbnail_url",
    "permalink",
    "timestamp",
    "children{media_type,media_url,thumbnail_url}",
  ].join(",")

  const items: ContentItem[] = []
  const perPage = 50
  let after: string | undefined
  let guard = 0

  while (items.length < limit && guard < 20) {
    guard += 1

    const url = new URL(
      `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(normalizedIgUserId)}/media`
    )
    url.searchParams.set("fields", fields)
    url.searchParams.set("limit", String(perPage))
    url.searchParams.set("access_token", token)
    if (after) url.searchParams.set("after", after)

    let data: InstagramGraphMediaResponse
    try {
      const response = await fetch(url.toString(), {
        next: { revalidate: 3600 },
        headers: {
          Accept: "application/json",
          "User-Agent": "KudoShuLibraryBot/1.0 (+https://kudoshu07.com)",
        },
      })
      if (!response.ok) break
      data = (await response.json()) as InstagramGraphMediaResponse
    } catch {
      break
    }

    const batch = (data.data ?? [])
      .map((media) => toInstagramGraphItem(source, username, media))
      .filter((item): item is ContentItem => item !== null)

    items.push(...batch)

    if (items.length >= limit) break

    const nextAfter = data.paging?.cursors?.after?.trim()
    if (!nextAfter) break
    if (nextAfter === after) break
    after = nextAfter
  }

  return items
    .slice(0, limit)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

async function loadInstagramItems(
  source: "ig_business" | "ig_photo",
  username: string | undefined,
  fallbackFile: string
): Promise<ContentItem[]> {
    // Instagram frequently blocks serverless/data-center IPs (e.g., Vercel).
    // Default to JSON seeds in production (MVP requirement), but if seeds are empty, try runtime fetch.
    const seeds = await loadExternalFromFile(fallbackFile, source)
    const forceRuntimeFetch = process.env.INSTAGRAM_RUNTIME_FETCH === "1"
    const disableRuntimeFetch = process.env.INSTAGRAM_RUNTIME_FETCH === "0"
    const isProd = process.env.NODE_ENV === "production"

    if (!username) {
      return seeds
    }

    const normalizedUsername = username.trim().replace(/^@/, "")
    if (!normalizedUsername) {
      return seeds
    }

  const limit = Math.min(
    Math.max(parseInteger(process.env.INSTAGRAM_FETCH_LIMIT, DEFAULT_INSTAGRAM_FETCH_LIMIT), 1),
    MAX_INSTAGRAM_FETCH_LIMIT
  )

  const graphAccessToken = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN?.trim()
  const graphIgUserId =
    source === "ig_business"
      ? process.env.INSTAGRAM_GRAPH_BUSINESS_IG_USER_ID?.trim()
      : process.env.INSTAGRAM_GRAPH_PHOTO_IG_USER_ID?.trim()
  const graphApiVersion = process.env.INSTAGRAM_GRAPH_API_VERSION?.trim() || DEFAULT_INSTAGRAM_GRAPH_API_VERSION

  // Prefer the official Instagram Graph API when configured (works reliably on Vercel).
  if (graphAccessToken && graphIgUserId) {
    const viaGraph = await fetchInstagramItemsViaGraphApi({
      source,
      username: normalizedUsername,
      igUserId: graphIgUserId,
      accessToken: graphAccessToken,
      limit,
      apiVersion: graphApiVersion,
    })
    if (viaGraph.length > 0) return viaGraph
  }

  if (isProd && !forceRuntimeFetch && seeds.length > 0) return seeds
  if (disableRuntimeFetch) return seeds

  try {
    const headers = {
      "User-Agent": INSTAGRAM_UA,
      "x-ig-app-id": INSTAGRAM_APP_ID,
      "x-asbd-id": INSTAGRAM_ASBD_ID,
      Accept: "application/json",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      Referer: "https://www.instagram.com/",
    } satisfies Record<string, string>

    // Primary: "i.instagram.com" (often used for web_profile_info).
    // On some hosting providers Instagram blocks bot-like headers; use a real browser UA above.
    let response = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(normalizedUsername)}`,
      { next: { revalidate: 3600 }, headers }
    )

    // Secondary: same endpoint on "www.instagram.com" (sometimes works when "i." is blocked).
    if (!response.ok) {
      response = await fetch(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(normalizedUsername)}`,
        { next: { revalidate: 3600 }, headers }
      )
    }

    if (!response.ok) return loadExternalFromFile(fallbackFile, source)

    const data = (await response.json()) as InstagramProfileResponse
    const nodes = data.data?.user?.edge_owner_to_timeline_media?.edges ?? []

    const items = nodes
      .map((edge) => edge.node)
      .map((node) => (node ? toInstagramItem(source, normalizedUsername, node) : null))
      .filter((item): item is ContentItem => item !== null)
      .slice(0, limit)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    if (items.length === 0) {
      return seeds
    }

    return items
  } catch {
    return seeds
  }
}

function extractInstagramOgImage(html: string): string | undefined {
  // Instagram profile pages typically expose the profile picture via og:image.
  const match = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i
  )
  if (!match?.[1]) return undefined
  return safeDecodeURIComponent(match[1].trim())
}

export const getInstagramProfileAvatar = cache(async (username: string | undefined): Promise<string | undefined> => {
  if (!username) return undefined

  const normalizedUsername = username.trim().replace(/^@/, "")
  if (!normalizedUsername) return undefined

  try {
    const response = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(normalizedUsername)}`,
      {
        next: { revalidate: 3600 },
        headers: {
          "User-Agent": INSTAGRAM_UA,
          "x-ig-app-id": INSTAGRAM_APP_ID,
          "x-asbd-id": INSTAGRAM_ASBD_ID,
          Accept: "application/json",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        },
      }
    )

    if (response.ok) {
      const data = (await response.json()) as InstagramProfileResponse
      const profilePic =
        data.data?.user?.profile_pic_url_hd?.trim() || data.data?.user?.profile_pic_url?.trim()
      if (profilePic) {
        return `/api/thumbnail?src=${encodeURIComponent(profilePic)}`
      }
    }

    // Fallback: parse og:image from the public profile page.
    const htmlResponse = await fetch(`https://www.instagram.com/${encodeURIComponent(normalizedUsername)}/`, {
      next: { revalidate: 3600 },
      headers: {
        "User-Agent": INSTAGRAM_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        Referer: "https://www.instagram.com/",
      },
    })
    if (!htmlResponse.ok) return undefined
    const html = await htmlResponse.text()
    const ogImage = extractInstagramOgImage(html)
    if (!ogImage) return undefined
    return `/api/thumbnail?src=${encodeURIComponent(ogImage)}`
  } catch {
    // Last resort: use a public avatar resolver. This keeps /home stable even if Instagram blocks server IPs.
    // (Still cached via /api/thumbnail.)
    return `/api/thumbnail?src=${encodeURIComponent(`https://unavatar.io/instagram/${encodeURIComponent(normalizedUsername)}`)}`
  }
})

async function loadPickupIds(): Promise<string[]> {
  const ids = await readJsonArray<string>(PICKUP_FILE)
  return ids
}

export async function getAllContentItems(): Promise<ContentItem[]> {
  const [blogPosts, notePosts, igBusinessPosts, igPhotoPosts, podcastEpisodes] = await Promise.all([
    loadBlogPosts(),
    loadNoteItems(),
    loadInstagramItems("ig_business", process.env.IG_BUSINESS_USERNAME ?? "kudoshu_vcook", "instagram-business.json"),
    loadInstagramItems("ig_photo", process.env.IG_PHOTO_USERNAME ?? "0n0shu", "instagram-photo.json"),
    loadPodcastEpisodes(),
  ])

  return [...blogPosts, ...notePosts, ...igBusinessPosts, ...igPhotoPosts, ...podcastEpisodes].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

export async function getPickupItems(allItems?: ContentItem[]): Promise<ContentItem[]> {
  const [ids, resolvedAllItems] = await Promise.all([loadPickupIds(), allItems ? Promise.resolve(allItems) : getAllContentItems()])
  const byId = new Map(resolvedAllItems.map((item) => [item.id, item]))
  const byUrl = new Map<string, ContentItem>()

  for (const item of resolvedAllItems) {
    const normalized = normalizeUrl(item.url)
    if (!normalized || byUrl.has(normalized)) continue
    byUrl.set(normalized, item)
  }

  const picked = ids
    .map((id, index) => {
      const item = id.startsWith("url:")
        ? byUrl.get(normalizeUrl(id.slice(4)))
        : byId.get(id)
      if (!item) return null
      return {
        ...item,
        isPickUp: true,
        pinOrder: index + 1,
      }
    })
    .filter((item): item is Exclude<typeof item, null> => item !== null)

  return picked.slice(0, 6)
}

export const getBlogStaticParams = cache(async () => {
  const posts = await loadBlogPosts()
  return posts.map((post) => ({
    year: post.year ?? "",
    month: post.month ?? "",
    day: post.day ?? "",
    slug: post.slug ?? "",
  }))
})

export async function getBlogPostByPath(params: {
  year: string
  month: string
  day: string
  slug: string
}): Promise<ContentItem | null> {
  const posts = await loadBlogPosts()
  return (
    posts.find(
      (post) =>
        post.year === params.year &&
        post.month === params.month &&
        post.day === params.day &&
        post.slug === params.slug
    ) ?? null
  )
}
