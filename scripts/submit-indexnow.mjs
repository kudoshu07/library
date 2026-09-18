#!/usr/bin/env node

// 公開済みURLを IndexNow (Bing / Yandex / Naver / Seznam) に通知する。
// Search Console のようなアカウント登録は不要で、鍵ファイルを site root に
// 置いておけば認証される (public/<key>.txt)。Google は IndexNow 非対応なので
// そちらは Search Console からの sitemap 送信が必要。
//
//   pnpm submit:indexnow            # sitemap.xml の全URLを送信
//   pnpm submit:indexnow /2026/09/14/sowasowa   # 個別URLだけ送信

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://kudoshu07.com").replace(/\/$/, "")
const KEY = process.env.INDEXNOW_KEY?.trim() || "875de65972424168ac54816fbffbbd4b"
const HOST = new URL(SITE_URL).host

async function urlsFromSitemap() {
  const res = await fetch(`${SITE_URL}/sitemap.xml`)
  if (!res.ok) throw new Error(`sitemap.xml fetch failed: ${res.status}`)
  const xml = await res.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
}

async function main() {
  // 鍵ファイルが本番に出ていないと IndexNow は 403 を返すので先に確認する。
  const keyCheck = await fetch(`${SITE_URL}/${KEY}.txt`)
  if (!keyCheck.ok) {
    throw new Error(`key file not reachable at ${SITE_URL}/${KEY}.txt (${keyCheck.status}). デプロイ後に実行してください。`)
  }

  const args = process.argv.slice(2)
  const urlList = args.length > 0 ? args.map((p) => new URL(p, SITE_URL).toString()) : await urlsFromSitemap()

  if (urlList.length === 0) {
    console.warn("[indexnow] 送信対象URLがありません。")
    return
  }

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE_URL}/${KEY}.txt`, urlList }),
  })

  const body = await res.text()
  console.log(`[indexnow] ${urlList.length} URLs -> ${res.status} ${res.statusText} ${body}`)
  if (!res.ok) process.exitCode = 1
}

main().catch((error) => {
  console.error(`[indexnow] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
