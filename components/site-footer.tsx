import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:justify-between lg:px-6">
        <p>&copy; {new Date().getFullYear()} Kudo Shu Library</p>
        <nav className="flex items-center gap-4" aria-label="Footer navigation">
          <Link href="/home" className="transition-colors hover:text-foreground">
            Contents
          </Link>
          <Link href="/subscribe" className="transition-colors hover:text-foreground">
            Subscribe
          </Link>
          <Link href="/about" className="transition-colors hover:text-foreground">
            About
          </Link>
        </nav>
      </div>
    </footer>
  )
}
