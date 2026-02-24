import type { Metadata } from "next"
import { ContentsFeed } from "@/components/contents-feed"
import { getAllContentItems, getPickupItems } from "@/lib/content-loader"

export const metadata: Metadata = {
  title: "Home",
  description: "Blog, note(個人), Instagram のすべてのコンテンツ一覧。",
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
