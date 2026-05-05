import { NextResponse } from "next/server"
import { getSiteUrl, getSupabaseClient } from "@/lib/newsletter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")?.trim()
  const site = getSiteUrl()

  if (!token) {
    return NextResponse.redirect(`${site}/subscribe/unsubscribed?status=invalid`, 303)
  }

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return NextResponse.redirect(`${site}/subscribe/unsubscribed?status=error`, 303)
  }

  const { data: row, error: selectError } = await supabase
    .from("subscribers")
    .select("id, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle()

  if (selectError) {
    console.error("supabase select error", selectError)
    return NextResponse.redirect(`${site}/subscribe/unsubscribed?status=error`, 303)
  }

  if (!row) {
    return NextResponse.redirect(`${site}/subscribe/unsubscribed?status=invalid`, 303)
  }

  if (row.unsubscribed_at) {
    return NextResponse.redirect(`${site}/subscribe/unsubscribed?status=already`, 303)
  }

  const { error: updateError } = await supabase
    .from("subscribers")
    .update({
      confirmed: false,
      unsubscribed_at: new Date().toISOString(),
    })
    .eq("id", row.id)

  if (updateError) {
    console.error("supabase update error", updateError)
    return NextResponse.redirect(`${site}/subscribe/unsubscribed?status=error`, 303)
  }

  return NextResponse.redirect(`${site}/subscribe/unsubscribed?status=ok`, 303)
}
