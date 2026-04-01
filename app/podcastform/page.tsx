import type { Metadata } from "next"
import { PodcastLetterForm } from "@/components/podcast-letter-form"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"

export const metadata: Metadata = {
  title: "Podcastお便りフォーム",
  description: "Podcast「工藤柊のオチのない話」へのお便りを送るフォームです。",
  alternates: {
    canonical: `${SITE_URL}/podcastform`,
  },
}

export default function PodcastFormPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12 lg:px-6">
      <header className="mb-6 space-y-2">
        <p className="text-sm font-semibold text-foreground">Podcast「工藤柊のオチのない話」</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          お便りフォーム
        </h1>
        <p className="text-sm text-muted-foreground">
          感想・質問・話してほしいテーマなど、気軽に送ってください。Notionに届き次第、次回以降の収録で取り上げます。
        </p>
      </header>

      <PodcastLetterForm />
    </div>
  )
}
