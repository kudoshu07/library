import type { Metadata } from "next"
import { ContentsFeed } from "@/components/contents-feed"
import { getAllContentItems, getPickupItems } from "@/lib/content-loader"
import { getSession } from "@/lib/auth"
import { getSupabaseClient } from "@/lib/newsletter"

async function getSubscriberOrdinal(subscriberId: string): Promise<number | null> {
  try {
    const supabase = getSupabaseClient()
    const { data: me } = await supabase
      .from("subscribers")
      .select("created_at")
      .eq("id", subscriberId)
      .maybeSingle()
    if (!me?.created_at) return null
    const { count } = await supabase
      .from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("confirmed", true)
      .is("unsubscribed_at", null)
      .lte("created_at", me.created_at)
    return typeof count === "number" ? count : null
  } catch {
    return null
  }
}

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

export const dynamic = "force-dynamic"

export default async function HomeTimelinePage() {
  const profileAvatarUrl = "/profile.jpg"
  const [allItems, session] = await Promise.all([getAllContentItems(), getSession()])
  const pickupItems = await getPickupItems(allItems)

  const ordinal = session ? await getSubscriberOrdinal(session.subscriberId) : null

  const sessionInfo = session
    ? {
        email: session.email,
        displayName: session.displayName ?? "",
        notifyOnReply: session.notifyOnReply,
        sources: session.sources,
        ordinal,
      }
    : null

  return (
    <ContentsFeed
      allItems={allItems}
      pickupItems={pickupItems}
      profileAvatarUrl={profileAvatarUrl}
      sessionInfo={sessionInfo}
    />
  )
}
