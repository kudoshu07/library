import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Eye } from "lucide-react"
import { SourceBadge } from "@/components/source-badge"
import { BlogHeroImage } from "@/components/blog-hero-image"
import { getOwnerSession } from "@/lib/admin-guard"
import { getDraftForOwner } from "@/lib/blog-drafts"
import { BLOG_BODY_CLASS_NAME, renderBlogBodyHtml } from "@/lib/blog-render"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "プレビュー | KSL Admin",
  robots: { index: false, follow: false },
}

type PageProps = { params: Promise<{ id: string }> }

export default async function PreviewPage({ params }: PageProps) {
  const session = await getOwnerSession()
  if (!session) return null

  const { id } = await params
  const draft = await getDraftForOwner(session.subscriberId, id)
  if (!draft) notFound()

  const dateLabel = draft.publish_date
    ? new Date(draft.publish_date).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "（公開日未設定）"

  const renderedBodyHtml = renderBlogBodyHtml(draft.body_html)
  const thumbnail = draft.thumbnail_url?.trim()

  return (
    <>
      {/* Floating preview-mode bar so it's obvious this isn't the live page. */}
      <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs text-amber-900">
        <span className="inline-flex items-center gap-1.5">
          <Eye className="size-3.5" />
          プレビューモード（最新の下書き状態）
        </span>
        <Link
          href={`/admin/blog/drafts/${draft.id}`}
          className="inline-flex items-center gap-1 rounded-md bg-amber-200 px-2 py-0.5 hover:bg-amber-300"
        >
          <ArrowLeft className="size-3" />
          編集に戻る
        </Link>
      </div>

      <article className="mx-auto max-w-xl px-4 py-12 lg:px-6">
        <header className="mb-8 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <SourceBadge source="blog" />
            <time className="text-sm text-muted-foreground" dateTime={draft.publish_date ?? undefined}>
              {dateLabel}
            </time>
          </div>
          <h1 className="text-balance text-[22px] font-bold leading-tight tracking-tight text-foreground md:text-3xl">
            {draft.title || "（無題）"}
          </h1>
          {draft.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2 pt-1">
              {draft.tags.map((tag) => (
                <li key={tag}>
                  <span className="inline-flex rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                    #{tag}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </header>

        {thumbnail && <BlogHeroImage src={thumbnail} title={draft.title} />}

        <div className="rounded-xl border border-border bg-card p-5 md:p-8">
          {renderedBodyHtml.trim() ? (
            <div
              className={BLOG_BODY_CLASS_NAME}
              dangerouslySetInnerHTML={{ __html: renderedBodyHtml }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              本文がまだありません。エディタに戻って書き始めてください。
            </p>
          )}
        </div>

        {draft.summary && (
          <p className="mt-6 rounded-md border border-dashed border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold">説明文:</span> {draft.summary}
          </p>
        )}
      </article>
    </>
  )
}
