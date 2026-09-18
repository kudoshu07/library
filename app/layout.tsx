import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_JP } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { LayoutShell } from '@/components/layout-shell'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-noto-sans-jp',
})

// Search Console (URL prefix プロパティ https://kudoshu07.com/) の所有権確認トークン。
// 公開情報なのでベタ書きでよい。認証後も外すと所有権が失われるので消さないこと。
// public/google5537453e02b14928.html のファイル方式と二重に効かせている。
// 差し替えたい場合のみ env NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION が優先される。
const GOOGLE_SITE_VERIFICATION =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ||
  'fPMdgPpizwnJaexUm3jfMSZz4og5uCGtMgMYGUTyIOY'

export const metadata: Metadata = {
  metadataBase: new URL('https://kudoshu07.com'),
  verification: { google: GOOGLE_SITE_VERIFICATION },
  icons: {
    icon: '/favicon-ksl.png',
    shortcut: '/favicon-ksl.png',
    apple: '/favicon-ksl.png',
  },
  title: {
    default: 'Kudo Shu Library (旧:そうは言っても工藤さん)',
    template: '%s | Kudo Shu Library',
  },
  description: 'Blog, note(個人), Instagram -- すべてのコンテンツを一箇所に集約したパーソナルライブラリー。',
  openGraph: {
    title: 'Kudo Shu Library (旧:そうは言っても工藤さん)',
    description:
      'Blog, note(個人), Instagram -- すべてのコンテンツを一箇所に集約したパーソナルライブラリー。',
    type: 'website',
    siteName: 'Kudo Shu Library',
    locale: 'ja_JP',
    images: ['/thumbnail-ksl.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kudo Shu Library (旧:そうは言っても工藤さん)',
    description:
      'Blog, note(個人), Instagram -- すべてのコンテンツを一箇所に集約したパーソナルライブラリー。',
    images: ['/thumbnail-ksl.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#264F8B',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // The owner-only "+ new" / "📝 draft" entry points are gated client-side
  // (see hooks/use-is-owner.ts) so this layout doesn't touch cookies() and
  // child pages stay eligible for static generation.
  return (
    <html lang="ja">
      <body className={`${inter.variable} ${notoSansJP.variable} font-sans antialiased`}>
        <LayoutShell>{children}</LayoutShell>
        <Analytics />
      </body>
    </html>
  )
}
