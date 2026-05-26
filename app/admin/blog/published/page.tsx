import Link from "next/link"
import { ExternalLink, Github, NotebookPen } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "公開しました | KSL Admin",
  robots: { index: false, follow: false },
}

type PageProps = {
  searchParams: Promise<{ url?: string; commit?: string }>
}

export default async function PublishedPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const url = sp.url ? decodeURIComponent(sp.url) : "/"
  const commitUrl = sp.commit ? decodeURIComponent(sp.commit) : null

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 lg:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        🎉 公開しました
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        GitHub にコミットしました。Vercel の再デプロイが完了するまで1〜2分かかります。
        その間は、サイト上では旧バージョンが表示されているかもしれません。
      </p>

      <div className="mt-6 space-y-3 rounded-md border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted-foreground">公開URL</span>
          <Link
            href={url}
            className="inline-flex items-center gap-1 text-sm text-[#264F8B] hover:underline"
          >
            {url}
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
        {commitUrl && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-muted-foreground">
              GitHub コミット
            </span>
            <a
              href={commitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[#264F8B] hover:underline"
            >
              詳細を見る
              <Github className="size-3.5" />
            </a>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/admin/blog/drafts"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-secondary"
        >
          <NotebookPen className="size-4" />
          下書き一覧へ
        </Link>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#264F8B] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1f4376]"
        >
          続けて新規執筆
        </Link>
      </div>
    </div>
  )
}
