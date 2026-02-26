import type { Metadata } from "next"
import { ContentsFeed } from "@/components/contents-feed"
import { getAllContentItems, getPickupItems } from "@/lib/content-loader"

export const metadata: Metadata = {
  title: {
    absolute: "Kudo Shu Library (旧:そうは言っても工藤さん)",
  },
  description: "Blog, note(個人), Instagram のすべてのコンテンツ一覧。",
  openGraph: {
    title: "Kudo Shu Library (旧:そうは言っても工藤さん)",
    description: "Blog, note(個人), Instagram のすべてのコンテンツ一覧。",
    url: "/home",
    type: "website",
    images: ["/thumbnail-ksl.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kudo Shu Library (旧:そうは言っても工藤さん)",
    description: "Blog, note(個人), Instagram のすべてのコンテンツ一覧。",
    images: ["/thumbnail-ksl.png"],
  },
}

export default async function HomeTimelinePage() {
  const profileAvatarUrl = "/profile.jpg"
  const allItems = await getAllContentItems()
  const pickupItems = await getPickupItems(allItems)

  return (
    <ContentsFeed
      allItems={allItems}
      pickupItems={pickupItems}
      profileAvatarUrl={profileAvatarUrl}
    />
  )
}
