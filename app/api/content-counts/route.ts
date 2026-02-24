import { NextResponse } from "next/server"
import { getAllContentItems } from "@/lib/content-loader"

export async function GET() {
  const items = await getAllContentItems()
  const bySource: Record<string, number> = {}

  for (const item of items) {
    bySource[item.source] = (bySource[item.source] ?? 0) + 1
  }

  return NextResponse.json(
    {
      total: items.length,
      bySource,
    },
    {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
      },
    }
  )
}

