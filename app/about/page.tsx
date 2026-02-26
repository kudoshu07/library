import type { Metadata } from "next"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "About",
  description: "Kudo Shu Library について。",
}

const links = [
  { label: "Blog", href: "https://kudoshu07.com/home" },
  { label: "note(個人)", href: "https://note.com/onoshu1127" },
  { label: "kudoshu_vcook", href: "https://www.instagram.com/kudoshu_vcook/" },
  { label: "onoshuphoto(写真)", href: "https://www.instagram.com/onoshuphoto/" },
  { label: "Prairie", href: "https://my.prairie.cards/u/kudoshu" },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 lg:px-6">
      {/* Header */}
      <div className="mb-10 flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
        <div className="flex size-24 shrink-0 items-center justify-center rounded-full bg-secondary text-2xl font-bold text-foreground">
          KS
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl text-balance">
            About
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            Web developer / Designer. Blog, note(個人), Instagram のコンテンツを横断的に集約する
            パーソナルライブラリーを運営しています。テクノロジー、デザイン、写真をテーマに発信中。
          </p>
        </div>
      </div>

      {/* External Links */}
      <section className="mb-10" aria-labelledby="links-heading">
        <h2 id="links-heading" className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Links
        </h2>
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Button key={link.label} variant="outline" size="sm" asChild>
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
                <ExternalLink className="size-3" />
              </a>
            </Button>
          ))}
        </div>
      </section>

      {/* Now Section */}
      <section aria-labelledby="now-heading">
        <h2 id="now-heading" className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Now
        </h2>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm leading-relaxed text-card-foreground">
            Next.js 16 と React 19 の新機能を活用したプロジェクトに取り組んでいます。
            最近は Cache Components と Activity API の実験に時間を費やしています。
            京都での写真撮影も計画中。
          </p>
        </div>
      </section>
    </div>
  )
}
