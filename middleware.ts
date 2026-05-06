import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, getSessionCookieAttrs, touchSession } from "@/lib/auth"

export const runtime = "nodejs"

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const res = NextResponse.next()
  if (!token) return res

  const result = await touchSession(token).catch(() => null)
  if (result?.kind === "extended") {
    res.cookies.set(SESSION_COOKIE, token, getSessionCookieAttrs(result.maxAgeMs))
  }
  return res
}

export const config = {
  matcher: [
    // Skip static assets and the auth endpoints (which manage the cookie themselves).
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|map)).*)",
  ],
}
