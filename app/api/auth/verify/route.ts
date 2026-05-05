import { NextResponse } from "next/server"
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  consumeLoginToken,
  getSessionCookieAttrs,
} from "@/lib/auth"
import { getSiteUrl } from "@/lib/newsletter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function safeNext(value: string | null): string {
  if (!value) return "/account"
  if (!value.startsWith("/") || value.startsWith("//")) return "/account"
  return value
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")?.trim() ?? ""
  const next = safeNext(url.searchParams.get("next"))
  const site = getSiteUrl()

  if (!token) {
    return NextResponse.redirect(`${site}/login?status=invalid`, 303)
  }

  const result = await consumeLoginToken(token)
  if (!result.ok) {
    return NextResponse.redirect(`${site}/login?status=${result.reason}`, 303)
  }

  const response = NextResponse.redirect(`${site}${next}`, 303)
  response.cookies.set(
    SESSION_COOKIE,
    result.sessionToken,
    getSessionCookieAttrs(SESSION_TTL_MS),
  )
  return response
}
