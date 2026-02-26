import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { SourceBadge } from "@/components/source-badge"
import { ContentActions } from "@/components/content-actions"
import { BlogHeroImage } from "@/components/blog-hero-image"
import { Button } from "@/components/ui/button"
import { getBlogPostByPath, getBlogStaticParams } from "@/lib/content-loader"

interface BlogPostPageProps {
  params: Promise<{
    year: string
    month: string
    day: string
    slug: string
  }>
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
  const images = post.thumbnail ? [post.thumbnail] : undefined

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
  const canonicalUrl = `https://kudoshu07.com${post.url}`

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
      <Button variant="ghost" size="sm" asChild className="mb-8 -ml-2 text-muted-foreground">
        <Link href="/home">
          <ArrowLeft className="size-4" />
          Back to Contents
        </Link>
      </Button>

	      <header className="mb-8 flex flex-col gap-3">
	        <div className="flex items-center gap-3">
	          <SourceBadge source="blog" />
	          <time className="text-sm text-muted-foreground" dateTime={post.date}>
	            {dateLabel}
	          </time>
	        </div>
	        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground md:text-3xl text-balance">
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
	        {hasHtmlTags ? (
	          <div
	            className="text-[15px] leading-8 text-card-foreground [&_p]:mb-5 [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:underline [&_figure]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg"
	            dangerouslySetInnerHTML={{ __html: body }}
	          />
	        ) : (
	          <div className="whitespace-pre-wrap text-[15px] leading-8 text-card-foreground">{body}</div>
	        )}
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
