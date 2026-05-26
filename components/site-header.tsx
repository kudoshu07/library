"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Menu, Plus, NotebookPen, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { SubscribeDialog } from "@/components/subscribe-dialog"
import { ENABLE_SUBSCRIBE_UI } from "@/lib/feature-flags"
import { useSubscriberCount } from "@/hooks/use-subscriber-count"
import { useIsOwner } from "@/hooks/use-is-owner"

const navLinks = [
  { href: "/home", label: "Contents" },
  { href: "/subscribe", label: "購読" },
].filter((link) => ENABLE_SUBSCRIBE_UI || link.href !== "/subscribe")

export function SiteHeader() {
  const pathname = usePathname()
  // null while loading — render nothing rather than flashing the
  // non-owner state before the cookie check completes.
  const isOwner = useIsOwner() === true
  const [mobileOpen, setMobileOpen] = useState(false)
  const isBlogPostPage = /^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/?$/.test(pathname)
  const visibleNavLinks = isBlogPostPage ? [] : navLinks
  const showBlogSubscribeLink = isBlogPostPage && ENABLE_SUBSCRIBE_UI
  const subscriberCount = useSubscriberCount(ENABLE_SUBSCRIBE_UI)
  const renderSubscribeLabel = (label: string) =>
    label === "購読" && subscriberCount !== null
      ? `${label}(${subscriberCount})`
      : label

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
        {(visibleNavLinks.length > 0 || isOwner) && (
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
                {renderSubscribeLabel(link.label)}
              </Link>
            ))}
            {isOwner && <OwnerNavLinks pathname={pathname} />}
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

        {/* Blog post page: subscribe trigger */}
        {showBlogSubscribeLink && (
          <SubscribeDialog
            trigger={
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
              >
                {subscriberCount !== null ? `購読(${subscriberCount})` : "購読"}
              </button>
            }
          />
        )}
      </div>

      {/* Mobile nav */}
      {mobileOpen && (visibleNavLinks.length > 0 || isOwner) && (
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
                {renderSubscribeLabel(link.label)}
              </Link>
            ))}
            {isOwner && (
              <>
                <Link
                  href="/admin/blog/new"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Plus className="size-4" />+ new
                </Link>
                <Link
                  href="/admin/blog/drafts"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <NotebookPen className="size-4" />📝 draft
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}

function OwnerNavLinks({ pathname }: { pathname: string }) {
  const active =
    pathname.startsWith("/admin/blog/new") ? "new" :
    pathname.startsWith("/admin/blog/drafts") ? "draft" :
    null
  return (
    <>
      <Link
        href="/admin/blog/new"
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          active === "new"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
        title="新規ブログを書く"
      >
        <Plus className="size-4" />
        new
      </Link>
      <Link
        href="/admin/blog/drafts"
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          active === "draft"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
        title="下書き一覧"
      >
        <NotebookPen className="size-4" />
        draft
      </Link>
    </>
  )
}
