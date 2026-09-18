import fs from "node:fs"
import path from "node:path"

const BLOG_ROOT = path.join(process.cwd(), "content", "blog")

// WordPress 時代のパーマリンクは /<slug>（postname 構造）だった。移行後は
// /<year>/<month>/<day>/<slug> になり、旧URLは 404 のまま放置されていた。
// Google のインデックスには旧URLが残っていて全部 404 を返していたため、
// 7年分の被リンクと評価を捨てていた。slug は content/blog のディレクトリ構造
// (year/month/day/slug.mdx) が持っているので、そこから 301 を組み立てる。
//
// 注意: next.config の redirects はファイルシステムルートより先に評価される。
// /home や /search などの実在ルートと同名の slug を作ると潰れるので除外する。
const RESERVED_TOP_LEVEL_PATHS = new Set([
  "home",
  "contents",
  "search",
  "login",
  "account",
  "privacy",
  "subscribe",
  "podcastform",
  "admin",
  "api",
  "sitemap.xml",
  "robots.txt",
])

function legacySlugRedirects() {
  if (!fs.existsSync(BLOG_ROOT)) return []

  const redirects = []
  const seen = new Set()

  // content/blog/<year>/<month>/<day>/<slug>.mdx
  for (const year of fs.readdirSync(BLOG_ROOT)) {
    for (const month of fs.readdirSync(path.join(BLOG_ROOT, year))) {
      for (const day of fs.readdirSync(path.join(BLOG_ROOT, year, month))) {
        const dayDir = path.join(BLOG_ROOT, year, month, day)
        for (const file of fs.readdirSync(dayDir)) {
          if (!file.endsWith(".mdx")) continue
          const slug = file.slice(0, -4)
          if (RESERVED_TOP_LEVEL_PATHS.has(slug) || seen.has(slug)) continue
          seen.add(slug)
          redirects.push({
            source: `/${slug}`,
            destination: `/${year}/${month}/${day}/${slug}`,
            permanent: true,
          })
        }
      }
    }
  }

  return redirects
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return legacySlugRedirects()
  },
  // Serverless function bundle hygiene.
  // The /api/admin/blog/* routes use process.cwd() to read MDX from
  // content/blog/, which makes Next's automatic file tracer cast a wide net
  // and pull in the entire project root — including the 260 MB+ public/
  // directory of blog images. That blows past Vercel's 250 MB unzipped
  // serverless function limit and the production build fails.
  //
  // - excludes: public/** is never needed inside a function (it's served by
  //   the CDN), and SWC/esbuild cross-platform binaries are pulled in even
  //   though only the linux build runs on Vercel.
  // - includes: be explicit about the only thing those two routes actually
  //   need from outside their own dependency graph: the MDX source files.
  outputFileTracingExcludes: {
    "*": [
      "public/**",
      ".next/cache/**",
      "node_modules/@swc/core-darwin-*",
      "node_modules/@swc/core-win32-*",
      "node_modules/@esbuild/darwin-*",
      "node_modules/@esbuild/win32-*",
    ],
  },
  outputFileTracingIncludes: {
    "/api/admin/blog/known-tags": ["./content/blog/**/*.mdx"],
    "/api/admin/blog/import-from-mdx": ["./content/blog/**/*.mdx"],
  },
}

export default nextConfig
