import Link from "next/link"
import { ENABLE_SUBSCRIBE_UI } from "@/lib/feature-flags"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:justify-between lg:px-6">
        <p>&copy; {new Date().getFullYear()} Kudo Shu Library</p>
        <nav className="flex items-center gap-4" aria-label="Footer navigation">
          <Link href="/home" className="transition-colors hover:text-foreground">
            Contents
          </Link>
          {ENABLE_SUBSCRIBE_UI && (
            <Link href="/subscribe" className="transition-colors hover:text-foreground">
              Subscribe
            </Link>
          )}
        </nav>
      </div>
    </footer>
  )
}
