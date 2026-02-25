import { NextResponse } from "next/server"
import { getAllContentItems } from "@/lib/content-loader"
import type { ContentItem } from "@/lib/data"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const source = (url.searchParams.get("source") ?? "").trim()

  const allItems = await getAllContentItems()
  const items = allItems.filter((item: ContentItem) => item.source === source)

  return NextResponse.json({
    source,
    count: items.length,
    sample: items.slice(0, 3).map((item: ContentItem) => ({
      id: item.id,
      title: item.title,
      date: item.date,
      url: item.url,
      thumbnail: item.thumbnail,
    })),
  })
}
