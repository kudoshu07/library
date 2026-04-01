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
    <div className="relative overflow-hidden bg-gradient-to-b from-[#E7F0FF] via-[#F1F6FF] to-white">
      <div className="pointer-events-none absolute -left-20 -top-24 size-64 rounded-full bg-[#4F7BFF]/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-6 size-72 rounded-full bg-[#7EC8FF]/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-2/3 rotate-3 bg-[#DDE9FF]/60 blur-2xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col px-4 py-14 lg:px-10">
        <header className="mb-8 space-y-3 text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#5E4AE3] shadow-sm ring-1 ring-[#5E4AE3]/10">
            <span>🎙️ Podcast</span>
            <span className="text-[#5E4AE3]">「工藤柊のオチのない話」</span>
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-[#1D1B3A] md:text-4xl">
            お便りフォーム
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[#3F3D56]/80 md:text-base">
            感想・質問・話してほしいテーマを気軽に送ってください🫶 ちょっとした「思いつき」でも大歓迎です！
          </p>
        </header>

        <div className="relative">
          <PodcastLetterForm />
        </div>
      </div>
    </div>
  )
}
