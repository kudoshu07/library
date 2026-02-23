"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { cn } from "@/lib/utils"

export function LayoutShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isTimeline = pathname === "/home" || pathname === "/contents" || pathname === "/"
  const isSearchPage = pathname === "/search"
  const isShellless = isTimeline || isSearchPage

  useEffect(() => {
    const html = document.documentElement
    const body = document.body

    const previousHtmlOverflow = html.style.overflow
    const previousHtmlOverscroll = html.style.overscrollBehavior
    const previousBodyOverflow = body.style.overflow
    const previousBodyOverscroll = body.style.overscrollBehavior

    const mediaQuery = window.matchMedia("(min-width: 800px)")
    let wasLocked = false
    let delayedResetTimer: number | null = null

    const resetPageScrollTop = () => {
      window.scrollTo(0, 0)
      html.scrollTop = 0
      body.scrollTop = 0
      document.scrollingElement?.scrollTo(0, 0)
    }

    const applyLock = () => {
      const shouldLock = isTimeline && mediaQuery.matches
      if (shouldLock && !wasLocked) {
        resetPageScrollTop()
        window.requestAnimationFrame(() => {
          resetPageScrollTop()
        })
        if (delayedResetTimer !== null) {
          window.clearTimeout(delayedResetTimer)
        }
        delayedResetTimer = window.setTimeout(() => {
          resetPageScrollTop()
          delayedResetTimer = null
        }, 120)
      }
      html.style.overflow = shouldLock ? "hidden" : previousHtmlOverflow
      html.style.overscrollBehavior = shouldLock ? "none" : previousHtmlOverscroll
      body.style.overflow = shouldLock ? "hidden" : previousBodyOverflow
      body.style.overscrollBehavior = shouldLock ? "none" : previousBodyOverscroll
      wasLocked = shouldLock
    }

    applyLock()
    mediaQuery.addEventListener("change", applyLock)
    window.addEventListener("resize", applyLock, { passive: true })

    return () => {
      mediaQuery.removeEventListener("change", applyLock)
      window.removeEventListener("resize", applyLock)
      if (delayedResetTimer !== null) {
        window.clearTimeout(delayedResetTimer)
      }
      html.style.overflow = previousHtmlOverflow
      html.style.overscrollBehavior = previousHtmlOverscroll
      body.style.overflow = previousBodyOverflow
      body.style.overscrollBehavior = previousBodyOverscroll
    }
  }, [isTimeline])

  return (
    <div
      className={cn(
        "flex min-h-svh flex-col",
        isTimeline && "min-[800px]:h-svh min-[800px]:overflow-hidden min-[800px]:overscroll-none"
      )}
    >
      {!isShellless && <SiteHeader />}
      <main
        className={cn(
          "flex-1 min-h-0",
          isTimeline && "min-[800px]:min-h-0 min-[800px]:overflow-hidden min-[800px]:overscroll-none"
        )}
      >
        {children}
      </main>
      {!isShellless && <SiteFooter />}
    </div>
  )
}
