"use client"

import { useEffect } from "react"

/**
 * Guards an editor screen against losing in-progress work via:
 *
 *  1. `beforeunload`: catches hard navigation — browser back button, tab
 *     close, refresh, address-bar entry, iOS pull-to-refresh. The browser
 *     displays its native "leave site?" prompt.
 *
 *  2. Click capture on internal links: Next.js App Router `<Link>` clicks
 *     don't fire `beforeunload` because they're soft-navigated via the
 *     History API. We intercept `<a href="...">` clicks at the document
 *     level (capture phase) and prompt with `window.confirm` if the user
 *     is leaving the editor. Anchor links (`#x`), external URLs, and
 *     `target="_blank"` links are allowed through without prompting.
 *
 * The hook is no-op when `dirty` is false, so it disables itself the
 * instant the user saves.
 */
export function useUnsavedChangesGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Older browsers required setting returnValue to a string; modern
      // ones display a generic message regardless of content but still
      // block on the truthiness check.
      e.returnValue = ""
    }

    const handleClickCapture = (e: MouseEvent) => {
      // Bail on non-primary clicks (middle/right) and modifier-held clicks
      // (cmd-click to open in new tab); let the browser handle those.
      if (e.defaultPrevented) return
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const target = e.target as HTMLElement | null
      const anchor = target?.closest("a") as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href) return
      if (anchor.target === "_blank") return
      if (href.startsWith("#")) return
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return
      if (/^https?:\/\//i.test(href)) {
        // Allow same-origin absolute URLs that point back into this site
        // to fall through (the beforeunload prompt will catch them since
        // they trigger a full navigation). External URLs likewise — once
        // they leave the origin, beforeunload handles it.
        return
      }

      if (
        !window.confirm(
          "未保存の変更があります。離脱すると失われます。続行しますか？",
        )
      ) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    // Capture phase so we intercept before Next.js's router takes over.
    document.addEventListener("click", handleClickCapture, true)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("click", handleClickCapture, true)
    }
  }, [dirty])
}
