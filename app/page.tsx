import { permanentRedirect } from "next/navigation"

// ルートは常に /home（ヘッダー・フッター・sitemap もすべて /home を指す）。
// redirect() の 307（一時）だと検索エンジンが / と /home を別々に扱い、
// トップページの評価が分散するため 308（恒久）で寄せる。
export default function HomePage() {
  permanentRedirect("/home")
}
