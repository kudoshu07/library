const DEFAULT_SITE_URL = "https://kudoshu07.com"

function normalizeSiteUrl(rawSiteUrl?: string): string {
  const trimmed = String(rawSiteUrl ?? "").trim()
  if (!trimmed) return DEFAULT_SITE_URL

  try {
    const parsed = new URL(trimmed)
    return parsed.toString()
  } catch {
    return DEFAULT_SITE_URL
  }
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "https:" || url.protocol === "http:"
}

export function getSiteUrl(): string {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
}

export function toAbsoluteUrl(rawUrl: string, siteUrl = getSiteUrl()): string {
  return new URL(rawUrl, siteUrl).toString()
}

function unwrapNextImageUrl(url: URL, siteUrl: string): URL {
  if (url.pathname !== "/_next/image") return url

  const source = url.searchParams.get("url")
  if (!source) return url

  try {
    const unwrapped = new URL(source, siteUrl)
    if (!isHttpUrl(unwrapped)) return url
    return unwrapped
  } catch {
    return url
  }
}

export function resolveSocialImageUrl(rawImageUrl: string | undefined | null, siteUrl = getSiteUrl()): string | null {
  const trimmed = String(rawImageUrl ?? "").trim()
  if (!trimmed) return null

  try {
    const absolute = new URL(trimmed, siteUrl)
    const resolved = unwrapNextImageUrl(absolute, siteUrl)
    if (!isHttpUrl(resolved)) return null
    return resolved.toString()
  } catch {
    return null
  }
}

export function resolveSocialImageUrls(
  rawImageUrls: Array<string | undefined | null>,
  siteUrl = getSiteUrl()
): string[] | undefined {
  const deduped = new Set<string>()
  const results: string[] = []

  for (const rawImageUrl of rawImageUrls) {
    const resolved = resolveSocialImageUrl(rawImageUrl, siteUrl)
    if (!resolved || deduped.has(resolved)) continue
    deduped.add(resolved)
    results.push(resolved)
  }

  return results.length > 0 ? results : undefined
}
