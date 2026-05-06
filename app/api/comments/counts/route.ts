import { NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/newsletter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function safePostId(value: string): string | null {
  if (!value) return null
  if (!value.startsWith("/") || value.startsWith("//")) return null
  if (value.length > 200) return null
  return value
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const rawIds = [
    ...url.searchParams.getAll("post_id"),
    ...url.searchParams
      .getAll("post_ids")
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter(Boolean),
  ]
  const uniqueIds = Array.from(
    new Set(rawIds.map(safePostId).filter((v): v is string => v !== null)),
  ).slice(0, 200)

  const counts: Record<string, number> = {}
  for (const id of uniqueIds) counts[id] = 0

  if (uniqueIds.length === 0) {
    return NextResponse.json({ counts })
  }

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return NextResponse.json({ counts })
  }

  const { data, error } = await supabase
    .from("comments")
    .select("post_id")
    .in("post_id", uniqueIds)

  if (error) {
    console.error("comment counts error", error)
    return NextResponse.json({ counts })
  }

  for (const row of data ?? []) {
    const pid = (row as { post_id?: string }).post_id
    if (!pid) continue
    counts[pid] = (counts[pid] ?? 0) + 1
  }

  return NextResponse.json({ counts })
}
