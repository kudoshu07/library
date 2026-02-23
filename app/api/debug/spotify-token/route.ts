import { NextResponse } from "next/server"

const SPOTIFY_WEB_USER_AGENT = "Mozilla/5.0"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim() ?? ""
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim() ?? ""

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      ok: false,
      reason: "missing_env",
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
    })
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      cache: "no-store",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "User-Agent": SPOTIFY_WEB_USER_AGENT,
      },
      body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    })

    const text = await response.text()
    let json: unknown = null
    try {
      json = JSON.parse(text)
    } catch {
      json = text.slice(0, 200)
    }

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        reason: "token_request_failed",
        status: response.status,
        body: json,
      })
    }

    const token = typeof (json as any)?.access_token === "string" ? ((json as any).access_token as string) : ""

    return NextResponse.json({
      ok: Boolean(token),
      status: response.status,
      tokenType: typeof (json as any)?.token_type === "string" ? (json as any).token_type : undefined,
      expiresIn: typeof (json as any)?.expires_in === "number" ? (json as any).expires_in : undefined,
      tokenLen: token.length,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        reason: "exception",
        error: String(error),
      },
      { status: 502 }
    )
  }
}
