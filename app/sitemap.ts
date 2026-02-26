import type { MetadataRoute } from "next"
import { getBlogStaticParams, getBlogPostByPath } from "@/lib/content-loader"
import { type ContentItem } from "@/lib/data"
import { ENABLE_SUBSCRIBE_UI } from "@/lib/feature-flags"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kudoshu07.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/home`, changeFrequency: "daily", priority: 1 },
    ...(ENABLE_SUBSCRIBE_UI
      ? ([{ url: `${SITE_URL}/subscribe`, changeFrequency: "weekly", priority: 0.6 }] satisfies MetadataRoute.Sitemap)
      : []),
  ]

  const params = await getBlogStaticParams()
  const posts = await Promise.all(params.map((p) => getBlogPostByPath(p)))

  const blogPages: MetadataRoute.Sitemap = posts
    .filter((post): post is ContentItem => post !== null)
    .map((post) => ({
      url: new URL(post.url, SITE_URL).toString(),
      lastModified: post.date,
      changeFrequency: "monthly",
      priority: 0.7,
    }))

  return [...staticPages, ...blogPages]
}
