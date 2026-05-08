import { NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/newsletter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  let count = 0
  try {
    const supabase = getSupabaseClient()
    const { count: c, error } = await supabase
      .from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("confirmed", true)
      .is("unsubscribed_at", null)

    if (error) {
      console.error("subscriber count error", error)
    } else {
      count = c ?? 0
    }
  } catch (err) {
    console.error("subscriber count failed", err)
  }

  return NextResponse.json(
    { count },
    {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
      },
    },
  )
}
