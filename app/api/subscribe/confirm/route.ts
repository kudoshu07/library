import { NextResponse } from "next/server"
import { getSiteUrl, getSupabaseClient, sourceLabel } from "@/lib/newsletter"
import { postSlackMessage, slackEscape } from "@/lib/slack"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")?.trim()
  const site = getSiteUrl()

  if (!token) {
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=invalid`, 303)
  }

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=error`, 303)
  }

  const { data: row, error: selectError } = await supabase
    .from("subscribers")
    .select("id, email, confirmed, unsubscribed_at, display_name, sources")
    .eq("confirm_token", token)
    .maybeSingle()

  if (selectError) {
    console.error("supabase select error", selectError)
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=error`, 303)
  }

  if (!row) {
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=invalid`, 303)
  }

  if (row.confirmed && !row.unsubscribed_at) {
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=already`, 303)
  }

  const { error: updateError } = await supabase
    .from("subscribers")
    .update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
      unsubscribed_at: null,
    })
    .eq("id", row.id)

  if (updateError) {
    console.error("supabase update error", updateError)
    return NextResponse.redirect(`${site}/subscribe/confirmed?status=error`, 303)
  }

  const displayName = row.display_name?.trim() || "(名無し)"
  const sourcesArr = Array.isArray(row.sources) ? (row.sources as string[]) : []
  const labels = sourcesArr.map((s) => sourceLabel(s)).join(", ") || "(未選択)"
  const slackText = [
    "KudoShuLibraryのニュースレター新規登録🎉",
    `・${slackEscape(displayName)}`,
    `・${slackEscape(labels)}`,
  ].join("\n")
  void postSlackMessage(slackText)

  return NextResponse.redirect(`${site}/subscribe/confirmed?status=ok`, 303)
}
