import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

// Tiny client-side check used by the SiteHeader and BlogEditButton to decide
// whether to surface the owner-only entry points. Real authorization is
// enforced server-side on every /api/admin/blog/* write endpoint — this
// route only exists so the UI can avoid flashing buttons that wouldn't work.
//
// Cache: no-store. The cookie can change at any time (login/logout) and the
// response is per-request, so we never want a shared cache to hold a stale
// answer.
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getSession()
    return NextResponse.json(
      { isOwner: session?.isOwner === true },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json(
      { isOwner: false },
      { headers: { "Cache-Control": "no-store" } },
    )
  }
}
