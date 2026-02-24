#!/usr/bin/env node
/**
 * Mirror referenced WordPress uploads into `public/wp-content/uploads/...`
 * and optionally rewrite MDX URLs from:
 *   https://kudoshu07.com/wp-content/uploads/... -> /wp-content/uploads/...
 *
 * Usage:
 *   node scripts/mirror-wp-uploads.cjs [--dry-run] [--rewrite] [--max=20]
 */

const fs = require("node:fs/promises")
const path = require("node:path")

const ROOT = process.cwd()
const BLOG_DIR = path.join(ROOT, "content", "blog")
const PUBLIC_DIR = path.join(ROOT, "public")

const argv = process.argv.slice(2)
const args = new Set(argv)
const DRY_RUN = args.has("--dry-run")
const REWRITE = args.has("--rewrite")
const MAX_URLS = (() => {
  const raw = argv.find((v) => v.startsWith("--max="))
  if (!raw) return null
  const n = Number.parseInt(raw.slice("--max=".length), 10)
  return Number.isFinite(n) && n > 0 ? n : null
})()

const WP_HOSTS = new Set(["kudoshu07.com", "www.kudoshu07.com"])
// Extract URLs in a few shapes to handle spaces in file names:
// - src="...uploads/... ...jpg"
// - src='...'
// - markdown/image: (...uploads/...png)
// - fallback: whitespace-delimited
const WP_IN_DOUBLE_QUOTES_RE = /"(https?:\/\/(?:www\.)?kudoshu07\.com\/wp-content\/uploads\/[^"]+)"/gi
const WP_IN_SINGLE_QUOTES_RE = /'(https?:\/\/(?:www\.)?kudoshu07\.com\/wp-content\/uploads\/[^']+)'/gi
const WP_IN_PARENS_RE = /\((https?:\/\/(?:www\.)?kudoshu07\.com\/wp-content\/uploads\/[^)]+)\)/gi
const WP_FALLBACK_RE = /https?:\/\/(?:www\.)?kudoshu07\.com\/wp-content\/uploads\/[^\s"'()<>]+/gi

function collectWpUrls(raw) {
  const urls = []
  for (const m of raw.matchAll(WP_IN_DOUBLE_QUOTES_RE)) urls.push(m[1])
  for (const m of raw.matchAll(WP_IN_SINGLE_QUOTES_RE)) urls.push(m[1])
  for (const m of raw.matchAll(WP_IN_PARENS_RE)) urls.push(m[1])
  for (const m of raw.matchAll(WP_FALLBACK_RE)) urls.push(m[0])
  return urls
}

const LOCAL_IN_DOUBLE_QUOTES_RE = /"(\/wp-content\/uploads\/[^"]+)"/gi
const LOCAL_IN_SINGLE_QUOTES_RE = /'(\/wp-content\/uploads\/[^']+)'/gi
const LOCAL_IN_PARENS_RE = /\((\/wp-content\/uploads\/[^)]+)\)/gi
const LOCAL_FALLBACK_RE = /\/wp-content\/uploads\/[^\s"'()<>]+/gi

function collectLocalUploadPaths(raw) {
  const paths = []
  for (const m of raw.matchAll(LOCAL_IN_DOUBLE_QUOTES_RE)) paths.push(m[1])
  for (const m of raw.matchAll(LOCAL_IN_SINGLE_QUOTES_RE)) paths.push(m[1])
  for (const m of raw.matchAll(LOCAL_IN_PARENS_RE)) paths.push(m[1])
  for (const m of raw.matchAll(LOCAL_FALLBACK_RE)) paths.push(m[0])
  return paths
}

function toRemoteUrlFromWebPath(webPath) {
  const trimmed = String(webPath || "").trim()
  if (!trimmed.startsWith("/wp-content/uploads/")) return null
  if (!/\.[a-z0-9]{2,5}$/i.test(trimmed.split("?")[0])) return null
  // Keep the original path characters; encodeURI will handle spaces safely.
  return encodeURI(`https://kudoshu07.com${trimmed}`)
}

function normalizeUrl(raw) {
  const trimmed = String(raw || "").trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed)
  } catch {
    try {
      return new URL(encodeURI(trimmed))
    } catch {
      return null
    }
  }
}

function toWebPath(u) {
  if (!u || !WP_HOSTS.has(u.hostname)) return null
  if (!u.pathname.startsWith("/wp-content/uploads/")) return null
  return u.pathname
}

async function listMdxFiles(dir) {
  const out = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await listMdxFiles(full)))
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      out.push(full)
    }
  }
  return out
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
}

async function fileExists(p) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

async function downloadTo(url, destFile) {
  const headers = {
    "User-Agent": "Mozilla/5.0",
    Accept: "image/*,*/*;q=0.8",
  }

  const delays = [0, 300, 900]
  let lastErr = null
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]))
    }
    try {
      const res = await fetch(url, { redirect: "follow", headers })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (!DRY_RUN) {
        await ensureDir(destFile)
        await fs.writeFile(destFile, buf)
      }
      return buf.length
    } catch (err) {
      lastErr = err
      const code = err?.cause?.code || err?.code
      if (code !== "ENOTFOUND" && code !== "EAI_AGAIN") break
    }
  }

  throw lastErr ?? new Error("Download failed")
}

async function runPool(limit, tasks) {
  const executing = new Set()
  const results = []
  for (const task of tasks) {
    const p = Promise.resolve().then(task)
    results.push(p)
    executing.add(p)
    p.finally(() => executing.delete(p))
    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }
  return Promise.all(results)
}

function rewriteContent(raw) {
  return raw.replace(/https?:\/\/(?:www\.)?kudoshu07\.com\/wp-content\/uploads\//gi, "/wp-content/uploads/")
}

async function main() {
  const mdxFiles = await listMdxFiles(BLOG_DIR)
  const webPaths = new Set()

  for (const file of mdxFiles) {
    const raw = await fs.readFile(file, "utf8")
    for (const u of collectWpUrls(raw)) {
      const parsed = normalizeUrl(u)
      const webPath = toWebPath(parsed)
      if (webPath) webPaths.add(webPath)
    }
    for (const p of collectLocalUploadPaths(raw)) {
      if (p.startsWith("/wp-content/uploads/")) webPaths.add(p)
    }
  }

  const downloads = []
  const skipped = []
  const invalid = []
  const failed = []

  const webPathList = [...webPaths]
  const limited = MAX_URLS ? webPathList.slice(0, MAX_URLS) : webPathList

  for (const webPath of limited) {
    const remoteUrl = toRemoteUrlFromWebPath(webPath)
    if (!remoteUrl) {
      invalid.push(String(webPath))
      continue
    }

    let decodedPath = webPath
    try {
      decodedPath = decodeURIComponent(webPath)
    } catch {
      decodedPath = webPath
    }
    const destFile = path.join(PUBLIC_DIR, decodedPath.replaceAll("/", path.sep))

    downloads.push(async () => {
      try {
        if (await fileExists(destFile)) {
          skipped.push(destFile)
          return { url: remoteUrl, destFile, status: "skipped" }
        }
        const size = await downloadTo(remoteUrl, destFile)
        return { url: remoteUrl, destFile, status: "downloaded", size }
      } catch (err) {
        const code = err?.cause?.code || err?.code
        failed.push({ url: remoteUrl, code: code ?? "ERR", message: String(err) })
        return { url: remoteUrl, destFile, status: "failed", code: code ?? "ERR" }
      }
    })
  }

  const results = await runPool(4, downloads)

  if (REWRITE) {
    for (const file of mdxFiles) {
      const raw = await fs.readFile(file, "utf8")
      const next = rewriteContent(raw)
      if (next !== raw && !DRY_RUN) {
        await fs.writeFile(file, next)
      }
    }
  }

  const downloaded = results.filter((r) => r.status === "downloaded").length
  const skippedCount = results.filter((r) => r.status === "skipped").length
  const failedCount = results.filter((r) => r.status === "failed").length

  console.log(
    JSON.stringify(
      {
        mdxFiles: mdxFiles.length,
        uniqueWebPaths: webPaths.size,
        selectedUrls: limited.length,
        downloaded,
        skipped: skippedCount,
        failed: failedCount,
        invalid: invalid.length,
        rewrite: REWRITE,
        dryRun: DRY_RUN,
      },
      null,
      2
    )
  )

  if (invalid.length > 0) {
    console.log("Invalid/unsupported URLs (first 10):")
    for (const u of invalid.slice(0, 10)) console.log(`- ${u}`)
  }

  if (failed.length > 0) {
    console.log("Failed downloads (first 10):")
    for (const item of failed.slice(0, 10)) console.log(`- [${item.code}] ${item.url}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
