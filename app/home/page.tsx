import type { Metadata } from "next"
import { ContentsFeed } from "@/components/contents-feed"
import { getAllContentItems, getInstagramProfileAvatar, getPickupItems } from "@/lib/content-loader"

export const metadata: Metadata = {
  title: "Home",
  description: "Blog, note(個人), Instagram のすべてのコンテンツ一覧。",
}

export default async function HomeTimelinePage() {
  const [allItems, profileAvatarUrl] = await Promise.all([
    getAllContentItems(),
    getInstagramProfileAvatar(process.env.IG_BUSINESS_USERNAME ?? "kudoshu_vcook"),
  ])
  const pickupItems = await getPickupItems(allItems)

  return (
    <ContentsFeed
      allItems={allItems}
      pickupItems={pickupItems}
      profileAvatarUrl={profileAvatarUrl}
    />
  )
}
