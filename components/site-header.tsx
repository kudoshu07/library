"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Menu, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ENABLE_SUBSCRIBE_UI } from "@/lib/feature-flags"

const navLinks = [
  { href: "/home", label: "Contents" },
  { href: "/subscribe", label: "Subscribe" },
].filter((link) => ENABLE_SUBSCRIBE_UI || link.href !== "/subscribe")

export function SiteHeader() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const isBlogPostPage = /^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/.test(pathname)
  const visibleNavLinks = isBlogPostPage ? [] : navLinks

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 lg:px-6">
        <Link
          href="/home"
          className="text-lg font-bold tracking-tight text-foreground transition-opacity hover:opacity-70"
        >
          Kudo Shu Library
        </Link>

        {/* Desktop nav */}
        {visibleNavLinks.length > 0 && (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  pathname === link.href ||
                    (link.href === "/home" && (pathname === "/" || pathname === "/contents"))
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        {/* Mobile menu button */}
        {visibleNavLinks.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        )}
      </div>

      {/* Mobile nav */}
      {mobileOpen && visibleNavLinks.length > 0 && (
        <nav className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden" aria-label="Mobile navigation">
          <div className="flex flex-col gap-1">
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === link.href ||
                    (link.href === "/home" && (pathname === "/" || pathname === "/contents"))
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
