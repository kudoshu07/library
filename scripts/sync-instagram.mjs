/* eslint-disable no-console */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import dns from "node:dns/promises"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT = path.join(__dirname, "..")
const OUT_DIR = path.join(ROOT, "content", "external")

const INSTAGRAM_APP_ID = "936619743392459"
const INSTAGRAM_ASBD_ID = "129477"
const INSTAGRAM_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

const execFileAsync = promisify(execFile)

function env(name, fallback) {
  const v = process.env[name]
  return v && String(v).trim() ? String(v).trim() : fallback
}

function parseLimit(value, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, 30)
}

function normalizeUsername(value) {
  return String(value ?? "").trim().replace(/^@/, "")
}

const resolveCache = new Map()

async function resolveHost(hostname) {
  const key = String(hostname).toLowerCase()
  if (resolveCache.has(key)) return resolveCache.get(key)

  let ip
  try {
    const result = await dns.lookup(hostname)
    ip = result?.address
  } catch {
    ip = undefined
  }

  // Fallback to a public DNS-over-HTTPS resolver (useful if local DNS is flaky).
  if (!ip) {
    try {
      const res = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`,
        { headers: { "User-Agent": INSTAGRAM_UA, Accept: "application/json" } }
      )
      if (res.ok) {
        const data = await res.json()
        const answer = Array.isArray(data?.Answer) ? data.Answer : []
        const aRecords = answer.filter((a) => a?.type === 1 && typeof a?.data === "string")
        const first = aRecords[0]
        if (first?.data) ip = first.data
      }
    } catch {
      ip = undefined
    }
  }

  resolveCache.set(key, ip)
  return ip
}

async function fetchProfileInfo(username) {
  const headers = {
    "User-Agent": INSTAGRAM_UA,
    "x-ig-app-id": INSTAGRAM_APP_ID,
    "x-asbd-id": INSTAGRAM_ASBD_ID,
    Accept: "application/json",
    "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    Referer: "https://www.instagram.com/",
  }

  const urls = [
    new URL(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
    ),
    new URL(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
    ),
  ]

  for (const url of urls) {
    try {
      const curlArgsBase = [
        "-sS",
        "-L",
        "-A",
        INSTAGRAM_UA,
        "--compressed",
        "-H",
        `x-ig-app-id: ${INSTAGRAM_APP_ID}`,
        "-H",
        `x-asbd-id: ${INSTAGRAM_ASBD_ID}`,
        "-H",
        "Accept: application/json",
        "-H",
        "Accept-Language: ja,en-US;q=0.9,en;q=0.8",
        "-H",
        "Referer: https://www.instagram.com/",
      ]

      try {
        const { stdout } = await execFileAsync("curl", [...curlArgsBase, url.toString()], {
          maxBuffer: 20 * 1024 * 1024,
        })
        if (stdout && stdout.trim().startsWith("{")) return JSON.parse(stdout)
      } catch (err) {
        // If DNS fails, try again with --resolve.
        if (err && typeof err === "object" && "code" in err && err.code === 6) {
          const resolved = await resolveHost(url.hostname)
          if (resolved) {
            const { stdout } = await execFileAsync(
              "curl",
              [...curlArgsBase, "--resolve", `${url.hostname}:443:${resolved}`, url.toString()],
              { maxBuffer: 20 * 1024 * 1024 }
            )
            if (stdout && stdout.trim().startsWith("{")) return JSON.parse(stdout)
          }
        }
      }
    } catch {
      // Ignore and try next URL.
    }
  }

  throw new Error(`Failed to fetch profile info for @${username}`)
}

function toSeed(username, node) {
  const shortcode = node?.shortcode
  const takenAt = node?.taken_at_timestamp
  if (!shortcode || !takenAt) return null

  const caption =
    node?.edge_media_to_caption?.edges?.[0]?.node?.text?.trim?.() ?? ""
  const title = caption.split(/\r?\n/)[0]?.trim() || `Instagram post ${shortcode}`
  const summary = caption.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim()

  const url = `https://www.instagram.com/p/${shortcode}/`
  const date = new Date(takenAt * 1000).toISOString()
  const thumbnail = node?.thumbnail_src?.trim?.() || node?.display_url?.trim?.()

  return {
    id: `ig:${username}:${shortcode}`,
    title,
    date,
    url,
    summary: summary || undefined,
    thumbnail: thumbnail || undefined,
  }
}

async function writeJson(fileName, data) {
  const outPath = path.join(OUT_DIR, fileName)
  const json = JSON.stringify(data, null, 2) + "\n"
  await fs.writeFile(outPath, json, "utf8")
}

async function run() {
  const business = normalizeUsername(env("IG_BUSINESS_USERNAME", "kudoshu_vcook"))
  const photo = normalizeUsername(env("IG_PHOTO_USERNAME", "onoshuphoto"))
  const limit = parseLimit(env("INSTAGRAM_FETCH_LIMIT", "12"), 12)

  const targets = [
    { username: business, out: "instagram-business.json" },
    { username: photo, out: "instagram-photo.json" },
  ]

  await fs.mkdir(OUT_DIR, { recursive: true })

  for (const t of targets) {
    console.log(`[sync-instagram] Fetching @${t.username}...`)
    const data = await fetchProfileInfo(t.username)
    const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges ?? []
    const seeds = edges
      .map((e) => toSeed(t.username, e?.node))
      .filter(Boolean)
      .slice(0, limit)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    console.log(`[sync-instagram] @${t.username}: ${seeds.length} items -> ${t.out}`)
    await writeJson(t.out, seeds)
  }
}

run().catch((err) => {
  console.error("[sync-instagram] ERROR:", err?.message || err)
  process.exitCode = 1
})
