import { NextRequest, NextResponse } from "next/server"

const ALLOWED_SUFFIXES = [
  ".cdninstagram.com",
  ".fbcdn.net",
  ".st-note.com",
  ".note.com",
  ".scdn.co",
  ".spotifycdn.com",
  "unavatar.io",
]

function isAllowedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return ALLOWED_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
}

function pickHeader(source: Headers, key: string): string | null {
  const value = source.get(key)
  return value && value.trim() ? value : null
}

function fallbackImageResponse() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#e5e7eb"/><rect x="72" y="72" width="96" height="96" rx="12" fill="#d1d5db"/><path d="M86 152l24-24 16 16 24-30 20 38H86z" fill="#9ca3af"/></svg>`
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src")
  if (!src) {
    return new NextResponse("Missing src", { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(src)
  } catch {
    return new NextResponse("Invalid src", { status: 400 })
  }

  if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
    return new NextResponse("Forbidden src", { status: 403 })
  }

  let upstream: Response
  try {
    const needsInstagramReferer =
      parsed.hostname.toLowerCase().endsWith(".cdninstagram.com") ||
      parsed.hostname.toLowerCase().endsWith(".fbcdn.net")

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    }

    if (needsInstagramReferer) {
      headers.Referer = "https://www.instagram.com/"
    }

    upstream = await fetch(parsed.toString(), {
      headers,
      next: { revalidate: 3600 },
    })
  } catch {
    return fallbackImageResponse()
  }

  if (!upstream.ok || !upstream.body) {
    return fallbackImageResponse()
  }

  const headers = new Headers()
  const contentType = pickHeader(upstream.headers, "content-type") ?? "image/jpeg"
  // Instagram sometimes returns HTML (challenge/blocked) with 200 OK.
  // Do not pass it through as an "image" response; show a safe placeholder instead.
  if (!contentType.toLowerCase().startsWith("image/")) {
    return fallbackImageResponse()
  }
  headers.set("Content-Type", contentType)
  headers.set("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400")

  const etag = pickHeader(upstream.headers, "etag")
  if (etag) headers.set("ETag", etag)

  const lastModified = pickHeader(upstream.headers, "last-modified")
  if (lastModified) headers.set("Last-Modified", lastModified)

  return new NextResponse(upstream.body, {
    status: 200,
    headers,
  })
}
