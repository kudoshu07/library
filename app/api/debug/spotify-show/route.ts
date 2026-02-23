import { NextResponse } from "next/server"

function extractInitialState(html: string): string | undefined {
  const match = html.match(/<script[^>]+id=["']initialState["'][^>]*>([^<]+)<\/script>/i)
  return match?.[1]?.trim()
}

const SPOTIFY_WEB_USER_AGENT = "Mozilla/5.0"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const showId = (searchParams.get("id") ?? "").trim()
  if (!showId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  const showUrl = `https://open.spotify.com/show/${encodeURIComponent(showId)}`

  let status = 0
  let finalUrl = showUrl
  let html = ""
  try {
    const response = await fetch(showUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": SPOTIFY_WEB_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    })
    status = response.status
    finalUrl = response.url
    html = await response.text()
  } catch (error) {
    return NextResponse.json(
      {
        showUrl,
        error: String(error),
      },
      { status: 502 }
    )
  }

  const encoded = extractInitialState(html)
  if (!encoded) {
    return NextResponse.json({
      showUrl,
      finalUrl,
      status,
      htmlLen: html.length,
      hasInitialState: false,
      head: html.slice(0, 300),
    })
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as any
    const showKey = `spotify:show:${showId}`
    const show = parsed?.entities?.items?.[showKey]
    const items = show?.pages?.items ?? []
    const sample = items
      .slice(0, 3)
      .map((it: any) => it?.entity?.data)
      .filter(Boolean)
      .map((ep: any) => ({
        id: ep?.id,
        name: ep?.name,
        release: ep?.releaseDate?.isoString,
      }))

    return NextResponse.json({
      showUrl,
      finalUrl,
      status,
      htmlLen: html.length,
      hasInitialState: true,
      pagesItemsLen: items.length,
      totalCount: show?.pages?.totalCount,
      sample,
    })
  } catch (error) {
    return NextResponse.json({
      showUrl,
      status,
      htmlLen: html.length,
      hasInitialState: true,
      parseError: String(error),
    })
  }
}
