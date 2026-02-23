import { NextResponse } from "next/server"
import { getAllContentItems } from "@/lib/content-loader"

export async function GET() {
  const items = await getAllContentItems()
  const counts: Record<string, number> = {}

  for (const item of items) {
    counts[item.source] = (counts[item.source] ?? 0) + 1
  }

  return NextResponse.json({
    total: items.length,
    bySource: counts,
    spotifyEnv: {
      hasClientId: Boolean(process.env.SPOTIFY_CLIENT_ID?.trim()),
      hasClientSecret: Boolean(process.env.SPOTIFY_CLIENT_SECRET?.trim()),
    },
    sample: items.slice(0, 3).map((item) => ({
      id: item.id,
      source: item.source,
      title: item.title,
      date: item.date,
      url: item.url,
    })),
  })
}
