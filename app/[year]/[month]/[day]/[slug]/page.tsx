import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SourceBadge } from "@/components/source-badge"
import { ContentActions } from "@/components/content-actions"
import { BlogHeroImage } from "@/components/blog-hero-image"
import { getBlogPostByPath, getBlogStaticParams } from "@/lib/content-loader"

interface BlogPostPageProps {
  params: Promise<{
    year: string
    month: string
    day: string
    slug: string
  }>
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi
const HTML_TAG_PATTERN = /(<[^>]+>)/g

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function trimTrailingUrlPunctuation(rawUrl: string): { cleanUrl: string; trailing: string } {
  let cleanUrl = rawUrl
  let trailing = ""

  while (cleanUrl.length > 0) {
    const lastChar = cleanUrl.slice(-1)
    if (/[.,!?;:'"、。]/u.test(lastChar)) {
      trailing = `${lastChar}${trailing}`
      cleanUrl = cleanUrl.slice(0, -1)
      continue
    }

    if (lastChar === ")") {
      const openCount = cleanUrl.split("(").length - 1
      const closeCount = cleanUrl.split(")").length - 1
      if (closeCount > openCount) {
        trailing = `${lastChar}${trailing}`
        cleanUrl = cleanUrl.slice(0, -1)
        continue
      }
    }

    break
  }

  return { cleanUrl, trailing }
}

function linkifyTextSegment(rawText: string): string {
  return rawText.replace(URL_PATTERN, (matchedUrl) => {
    const { cleanUrl, trailing } = trimTrailingUrlPunctuation(matchedUrl)
    if (!cleanUrl) return matchedUrl

    const normalizedUrl = decodeHtmlEntities(cleanUrl)
    const escapedUrl = escapeHtml(normalizedUrl)
    return `<a href="${escapedUrl}">${escapedUrl}</a>${escapeHtml(trailing)}`
  })
}

function linkifyHtmlContent(html: string): string {
  const segments = html.split(HTML_TAG_PATTERN)
  let insideAnchorDepth = 0

  return segments
    .map((segment) => {
      if (!segment.startsWith("<")) {
        if (insideAnchorDepth > 0) return segment
        return linkifyTextSegment(segment)
      }

      if (/^<\s*\/\s*a\b/i.test(segment)) {
        insideAnchorDepth = Math.max(0, insideAnchorDepth - 1)
        return segment
      }

      if (/^<\s*a\b/i.test(segment) && !/\/\s*>$/.test(segment)) {
        insideAnchorDepth += 1
      }

      return segment
    })
    .join("")
}

function linkifyPlainTextContent(text: string): string {
  const escaped = escapeHtml(text).replace(/\r\n?/g, "\n")
  return linkifyTextSegment(escaped).replace(/\n/g, "<br />")
}

export async function generateStaticParams() {
  return getBlogStaticParams()
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const route = await params
  const post = await getBlogPostByPath(route)

  if (!post) {
    return {
      title: "Not Found",
      description: "指定された記事は見つかりませんでした。",
    }
  }

  const description = post.summary ?? `${post.title} - Kudo Shu Library blog post.`
  const ogImage = post.thumbnail
    ? `/_next/image?url=${encodeURIComponent(post.thumbnail)}&w=1200&q=75`
    : undefined
  const images = ogImage ? [ogImage] : undefined

  return {
    title: post.title,
    description,
    alternates: {
      canonical: post.url,
    },
    openGraph: {
      title: post.title,
      description,
      type: "article",
      url: post.url,
      images,
      siteName: "Kudo Shu Library",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images,
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const route = await params
  const post = await getBlogPostByPath(route)

  if (!post) {
    notFound()
  }

  const parsedDate = new Date(post.date)
  const dateLabel = Number.isNaN(parsedDate.getTime())
    ? `${route.year}/${route.month}/${route.day}`
    : parsedDate.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
  const body = post.body ?? ""
  const hasHtmlTags = /<\s*[a-z][^>]*>/i.test(body)
  const renderedBodyHtml = hasHtmlTags ? linkifyHtmlContent(body) : linkifyPlainTextContent(body)
  const canonicalUrl = `https://kudoshu07.com${post.url}`

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
      <header className="mb-8 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <SourceBadge source="blog" />
          <time className="text-sm text-muted-foreground" dateTime={post.date}>
            {dateLabel}
          </time>
        </div>
        <h1 className="text-balance text-[22px] font-bold leading-tight tracking-tight text-foreground md:text-3xl">
          {post.title}
        </h1>
        {post.tags && post.tags.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={`/search?tag=${encodeURIComponent(tag)}`}
                  className="inline-flex rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                >
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <ContentActions
          contentId={post.id}
          title={post.title}
          canonicalUrl={canonicalUrl}
          className="pt-2"
        />
      </header>

      {post.thumbnail && <BlogHeroImage src={post.thumbnail} title={post.title} />}

      <div className="rounded-xl border border-border bg-card p-5 md:p-8">
        <div
          className="text-[15px] leading-7 text-card-foreground [overflow-wrap:anywhere] [&_p]:mb-2 [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:underline [&_a]:[overflow-wrap:anywhere] [&_a]:break-words [&_figure]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-[#264F8B]/20 [&_img]:bg-[#264F8B]/[0.03] [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-xs [&_figcaption]:leading-relaxed [&_figcaption]:text-slate-500 [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-slate-200 [&_table]:text-sm [&_thead]:bg-slate-50 [&_th]:border-b [&_th]:border-slate-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold [&_th]:text-slate-900 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:nth-child(even)]:bg-slate-50/50 [&_tbody_tr:last-child_td]:border-b-0 [&_iframe]:my-6 [&_iframe]:block [&_iframe]:w-full [&_iframe]:max-w-full [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:rounded-lg [&_iframe]:border [&_iframe]:border-slate-200 [&_iframe]:bg-slate-50"
          dangerouslySetInnerHTML={{ __html: renderedBodyHtml }}
        />
      </div>

      <ContentActions
        contentId={post.id}
        title={post.title}
        canonicalUrl={canonicalUrl}
        className="mt-6"
      />
    </article>
  )
}
