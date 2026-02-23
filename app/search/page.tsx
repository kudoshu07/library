import type { Metadata } from "next"
import { SearchResultsPage } from "@/components/search-results-page"
import { type ContentSource } from "@/lib/data"
import { getAllContentItems } from "@/lib/content-loader"

type SearchPageProps = {
  searchParams?: Promise<{
    q?: string | string[]
    tag?: string | string[]
    source?: string | string[]
  }>
}

export const metadata: Metadata = {
  title: "Search",
  description: "Kudo Shu Library のコンテンツ横断検索",
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = (await searchParams) ?? {}
  const qParam = Array.isArray(params.q) ? params.q[0] : params.q
  const tagParam = params.tag
  const sourceParam = params.source
  const initialQuery = qParam ?? ""
  const initialTags = (Array.isArray(tagParam) ? tagParam : tagParam ? [tagParam] : [])
    .map((value) => value.trim())
    .filter(Boolean)
  const validSources = new Set<ContentSource>([
    "blog",
    "note",
    "ig_business",
    "ig_photo",
    "pod_yonakoi",
    "pod_vegan",
  ])
  const initialSources = (Array.isArray(sourceParam) ? sourceParam : sourceParam ? [sourceParam] : [])
    .map((value) => value.trim())
    .filter((value): value is ContentSource => validSources.has(value as ContentSource))
  const allItems = await getAllContentItems()

  return (
    <SearchResultsPage
      allItems={allItems}
      initialQuery={initialQuery}
      initialTags={initialTags}
      initialSources={initialSources}
    />
  )
}
