#!/usr/bin/env node

// Instagram 公式API（Instagram API with Instagram Login）で投稿を同期する。
//
// - 匿名スクレイピング(sync-instagram.sh)は 2026-08 以降 Instagram に全面ブロックされたため、こちらが本線。
// - CDN の画像URLは署名付きで数週間で失効するので、画像は縮小して public/instagram/ に保存し、
//   JSON にはローカルパスを書く（一度保存した画像は二度と切れない）。
// - 長期トークンは60日で失効する。初回は GitHub Secret のトークンを使い、以降は7日ごとに更新して
//   Supabase Storage の非公開バケットに保存したものを使う（Secret を手で更新し続けなくてよい）。
//   Secret 側を新しいトークンに差し替えた場合はそちらを優先する。
//
// env:
//   INSTAGRAM_TOKEN_BUSINESS / INSTAGRAM_TOKEN_PHOTO  各アカウントの長期アクセストークン
//   IG_BUSINESS_USERNAME / IG_PHOTO_USERNAME          表示・ID用のユーザー名
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY          トークン保管（無ければ Secret のまま使う）
//   INSTAGRAM_FETCH_LIMIT                             取得件数（既定100）

import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { createClient } from "@supabase/supabase-js"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const OUT_DIR = path.join(ROOT, "content", "external")
const IMAGE_DIR = path.join(ROOT, "public", "instagram")
const IMAGE_PUBLIC_PREFIX = "/instagram"
const GRAPH = "https://graph.instagram.com/v24.0"
const TOKEN_BUCKET = "app-secrets"
const TOKEN_OBJECT = "instagram-tokens.json"
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000
const IMAGE_WIDTH = 720

function env(name, fallback = "") {
  const value = process.env[name]?.trim()
  return value ? value : fallback
}

function normalizeUsername(value) {
  return String(value ?? "").trim().replace(/^@/, "")
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function warn(message) {
  // GitHub Actions のサマリーに出す
  console.log(`::warning::[sync-instagram-graph] ${message}`)
}

// ---- token store (Supabase Storage, private bucket) ----

function createTokenStore() {
  const url = env("SUPABASE_URL")
  const key = env("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) return null
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  return {
    async load() {
      const { data, error } = await supabase.storage.from(TOKEN_BUCKET).download(TOKEN_OBJECT)
      if (error || !data) return {}
      try {
        return JSON.parse(await data.text())
      } catch {
        return {}
      }
    },
    async save(state) {
      const { error: bucketError } = await supabase.storage.getBucket(TOKEN_BUCKET)
      if (bucketError) {
        const { error } = await supabase.storage.createBucket(TOKEN_BUCKET, { public: false })
        if (error && !/already exists/i.test(error.message)) throw error
      }
      const body = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" })
      const { error } = await supabase.storage
        .from(TOKEN_BUCKET)
        .upload(TOKEN_OBJECT, body, { upsert: true, contentType: "application/json" })
      if (error) throw error
    },
  }
}

async function graphGet(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json.error) {
    const message = json?.error?.message || `HTTP ${response.status}`
    throw new Error(message)
  }
  return json
}

async function refreshToken(token) {
  const json = await graphGet(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`
  )
  if (!json.access_token) throw new Error("refresh_access_token returned no token")
  return json.access_token
}

// Secret と保管済みトークンから使うものを決め、必要なら更新して保存する。
async function resolveToken(key, secretToken, store, state) {
  const saved = state[key]
  const secretHash = secretToken ? sha256(secretToken) : ""

  let token
  let refreshedAt
  if (saved?.token && (!secretToken || saved.seedHash === secretHash)) {
    token = saved.token
    refreshedAt = saved.refreshedAt
  } else if (secretToken) {
    token = secretToken
    refreshedAt = undefined
  } else {
    return null
  }

  const stale = !refreshedAt || Date.now() - new Date(refreshedAt).getTime() > REFRESH_AFTER_MS
  if (store && stale) {
    try {
      token = await refreshToken(token)
      state[key] = { token, seedHash: secretHash || saved?.seedHash || "", refreshedAt: new Date().toISOString() }
      await store.save(state)
      console.log(`[sync-instagram-graph] ${key}: token refreshed`)
    } catch (error) {
      // 発行から24時間未満のトークンは更新できない。期限内ならそのまま使える。
      warn(`${key}: token refresh failed (${error.message}); using current token`)
      if (!saved || saved.seedHash !== secretHash) {
        state[key] = { token, seedHash: secretHash, refreshedAt: saved?.refreshedAt ?? null }
        await store.save(state).catch(() => {})
      }
    }
  }
  return token
}

// ---- media ----

function shortcodeFromPermalink(permalink) {
  const match = String(permalink ?? "").match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|tv)\/([^/?#]+)/)
  return match?.[1] ?? null
}

function pickImageUrl(media) {
  if (media.media_type === "VIDEO") return media.thumbnail_url || null
  if (media.media_type === "CAROUSEL_ALBUM") {
    if (media.media_url) return media.media_url
    const child = media.children?.data?.[0]
    if (!child) return null
    return child.media_type === "VIDEO" ? child.thumbnail_url || null : child.media_url || null
  }
  return media.media_url || null
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function saveImage(shortcode, sourceUrl) {
  const fileName = `${shortcode}.jpg`
  const outPath = path.join(IMAGE_DIR, fileName)
  const publicPath = `${IMAGE_PUBLIC_PREFIX}/${fileName}`
  if (await fileExists(outPath)) return publicPath
  if (!sourceUrl) return undefined

  try {
    const response = await fetch(sourceUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const input = Buffer.from(await response.arrayBuffer())
    const output = await sharp(input)
      .rotate()
      .resize({ width: IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer()
    await fs.writeFile(outPath, output)
    return publicPath
  } catch (error) {
    warn(`image download failed for ${shortcode}: ${error.message}`)
    return undefined
  }
}

async function fetchMedia(token, limit) {
  const fields =
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}"
  let url = `${GRAPH}/me/media?fields=${encodeURIComponent(fields)}&limit=${Math.min(limit, 50)}&access_token=${encodeURIComponent(token)}`
  const items = []
  while (url && items.length < limit) {
    const json = await graphGet(url)
    items.push(...(json.data ?? []))
    url = json.paging?.next ?? null
  }
  return items.slice(0, limit)
}

async function toSeed(username, media) {
  const shortcode = shortcodeFromPermalink(media.permalink)
  if (!shortcode || !media.timestamp) return null

  const caption = String(media.caption ?? "").trim()
  const title = caption.split(/\r?\n/)[0]?.trim() || `Instagram post ${shortcode}`
  const summary = caption.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim()
  const thumbnail = await saveImage(shortcode, pickImageUrl(media))

  return {
    id: `ig:${username}:${shortcode}`,
    title,
    date: new Date(media.timestamp).toISOString(),
    url: `https://www.instagram.com/p/${shortcode}/`,
    summary: summary || undefined,
    thumbnail,
  }
}

async function syncAccount({ key, username, out, token, limit }) {
  const media = await fetchMedia(token, limit)
  const seeds = []
  for (const item of media) {
    const seed = await toSeed(username, item)
    if (seed) seeds.push(seed)
  }
  seeds.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (seeds.length === 0) {
    warn(`${key}: API returned no posts; keeping existing ${out}`)
    return
  }
  await fs.writeFile(path.join(OUT_DIR, out), JSON.stringify(seeds, null, 2) + "\n", "utf8")
  console.log(`[sync-instagram-graph] @${username}: ${seeds.length} items -> ${out}`)
}

async function run() {
  const limit = Math.max(1, Math.min(Number.parseInt(env("INSTAGRAM_FETCH_LIMIT", "100"), 10) || 100, 200))
  const accounts = [
    {
      key: "business",
      username: normalizeUsername(env("IG_BUSINESS_USERNAME", "kudoshu_vegan")),
      out: "instagram-business.json",
      secret: env("INSTAGRAM_TOKEN_BUSINESS"),
    },
    {
      key: "photo",
      username: normalizeUsername(env("IG_PHOTO_USERNAME", "onoshu_photo")),
      out: "instagram-photo.json",
      secret: env("INSTAGRAM_TOKEN_PHOTO"),
    },
  ]

  await fs.mkdir(IMAGE_DIR, { recursive: true })
  const store = createTokenStore()
  if (!store) warn("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set; tokens will not be auto-refreshed")
  const state = store ? await store.load() : {}

  for (const account of accounts) {
    try {
      const token = await resolveToken(account.key, account.secret, store, state)
      if (!token) {
        console.log(`[sync-instagram-graph] ${account.key}: no token configured; skipping (existing data kept)`)
        continue
      }
      await syncAccount({ ...account, token, limit })
    } catch (error) {
      warn(`${account.key} (@${account.username}) failed: ${error.message}; existing data kept`)
    }
  }
}

run().catch((error) => {
  console.error("[sync-instagram-graph] ERROR:", error?.message || error)
  process.exitCode = 1
})
