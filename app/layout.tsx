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

export const metadata: Metadata = {
  metadataBase: new URL('https://kudoshu07.com'),
  title: {
    default: 'Kudo Shu Library',
    template: '%s | Kudo Shu Library',
  },
  description: 'Blog, note(個人), Instagram -- すべてのコンテンツを一箇所に集約したパーソナルライブラリー。',
  openGraph: {
    title: 'Kudo Shu Library',
    description:
      'Blog, note(個人), Instagram -- すべてのコンテンツを一箇所に集約したパーソナルライブラリー。',
    type: 'website',
    siteName: 'Kudo Shu Library',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kudo Shu Library',
    description:
      'Blog, note(個人), Instagram -- すべてのコンテンツを一箇所に集約したパーソナルライブラリー。',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={`${inter.variable} ${notoSansJP.variable} font-sans antialiased`}>
        <LayoutShell>{children}</LayoutShell>
        <Analytics />
      </body>
    </html>
  )
}
