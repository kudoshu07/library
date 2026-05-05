import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { SESSION_COOKIE, destroySession, getSession } from "@/lib/auth"
import { getSupabaseClient } from "@/lib/newsletter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 })
  }

  const { error } = await supabase
    .from("subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", session.subscriberId)
  if (error) {
    console.error("supabase update error", error)
    return NextResponse.json({ error: "database_error" }, { status: 500 })
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) await destroySession(token)

  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
