import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type LikeStore = Map<string, number>
type StorageMode = "kv" | "memory"

function getMemoryStore(): LikeStore {
  const g = globalThis as typeof globalThis & { __kslLikeStore?: LikeStore }
  if (!g.__kslLikeStore) g.__kslLikeStore = new Map()
  return g.__kslLikeStore
}

async function kvGet(key: string): Promise<number | null> {
  const base = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!base || !token) return null

  const res = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`KV get failed: ${res.status}`)
  const data = (await res.json()) as { result?: string | number | null }
  const raw = data.result
  if (raw == null) return 0
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10)
  return Number.isFinite(n) ? n : 0
}

async function kvIncr(key: string): Promise<number | null> {
  const base = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!base || !token) return null

  const res = await fetch(`${base}/incr/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`KV incr failed: ${res.status}`)
  const data = (await res.json()) as { result?: string | number | null }
  const raw = data.result
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10)
  return Number.isFinite(n) ? n : 0
}

function likeKey(id: string) {
  return `like:count:${id}`
}

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function getCount(id: string): Promise<{ count: number; mode: StorageMode; kvError: boolean }> {
  if (isKvConfigured()) {
    try {
      const kv = await kvGet(likeKey(id))
      if (kv !== null) return { count: kv, mode: "kv", kvError: false }
    } catch {
      // Fallback to memory to keep endpoint available even if KV is temporarily down.
      const fallbackCount = getMemoryStore().get(id) ?? 0
      return { count: fallbackCount, mode: "memory", kvError: true }
    }
  }

  return { count: getMemoryStore().get(id) ?? 0, mode: "memory", kvError: false }
}

async function incrementCount(id: string): Promise<{ count: number; mode: StorageMode; kvError: boolean }> {
  if (isKvConfigured()) {
    try {
      const kv = await kvIncr(likeKey(id))
      if (kv !== null) return { count: kv, mode: "kv", kvError: false }
    } catch {
      // Fallback to memory to keep endpoint available even if KV is temporarily down.
      const store = getMemoryStore()
      const nextFallback = (store.get(id) ?? 0) + 1
      store.set(id, nextFallback)
      return { count: nextFallback, mode: "memory", kvError: true }
    }
  }

  const store = getMemoryStore()
  const next = (store.get(id) ?? 0) + 1
  store.set(id, next)
  return { count: next, mode: "memory", kvError: false }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const ids = [
    ...url.searchParams.getAll("id"),
    ...url.searchParams
      .getAll("ids")
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter(Boolean),
  ]
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 200)

  const counts: Record<string, number> = {}
  let usedKv = false
  let usedMemory = false
  let kvErrorFallback = false
  await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const result = await getCount(id)
        counts[id] = result.count
        if (result.mode === "kv") usedKv = true
        if (result.mode === "memory") usedMemory = true
        if (result.kvError) kvErrorFallback = true
      } catch {
        counts[id] = 0
        usedMemory = true
      }
    })
  )

  const storageMode: StorageMode | "mixed" =
    usedKv && usedMemory ? "mixed" : usedKv ? "kv" : "memory"

  return NextResponse.json({
    counts,
    storageMode,
    kvConfigured: isKvConfigured(),
    kvErrorFallback,
  })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: string }
    const id = String(body?.id ?? "").trim()
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const result = await incrementCount(id)
    return NextResponse.json({
      id,
      count: result.count,
      storageMode: result.mode,
      kvConfigured: isKvConfigured(),
      kvErrorFallback: result.kvError,
    })
  } catch {
    return NextResponse.json({ error: "failed to increment like" }, { status: 500 })
  }
}
