"use client"

import { useEffect, useRef } from "react"

const LEAVE_MESSAGE = "保存していない変更があります。このページを離れると失われます。移動しますか？"

/**
 * Guards an editor screen against losing in-progress work. Every way out of
 * the page that we know of, and what catches it:
 *
 *  1. Hard navigation — tab/window close, reload (⌘R / pull-to-refresh),
 *     typing a URL, external links, a Back that leaves the app:
 *     `beforeunload` → the browser's native "leave site?" prompt.
 *
 *  2. Internal `<Link>` / `<a href>` clicks (header nav, 一覧へ, ...):
 *     App Router soft-navigates via the History API, so `beforeunload`
 *     never fires. We intercept anchor clicks at the document level
 *     (capture phase) and `window.confirm`. Anchors (`#x`), external URLs,
 *     `target="_blank"` and modifier-clicks pass through.
 *
 *  3. Browser Back / Forward, mouse back button, trackpad or iOS edge
 *     swipe within the app: also soft navigation (popstate) with no
 *     `beforeunload`, and popstate can't be cancelled. So once the page
 *     turns dirty we push a duplicate history entry for the current URL
 *     (a "sentinel"). Back then only pops the sentinel — same URL, Next
 *     restores the same tree, nothing visibly changes — and we get to ask.
 *     Stay → re-push the sentinel. Leave → `history.back()` for real.
 *     If the page has become clean again by the time Back is pressed, we
 *     forward the Back silently so it doesn't take two presses.
 *
 * Router calls made by the editor itself (after publish / delete) are
 * intentional and run with `dirty` already false.
 */
function pushSentinel(sentinelRef: { current: boolean }): void {
  // Copy Next's own state so its popstate handler treats the entry as a
  // normal App Router entry (a state without its marker forces a reload).
  window.history.pushState(window.history.state, "", window.location.href)
  sentinelRef.current = true
}

export function useUnsavedChangesGuard(dirty: boolean): void {
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  // Set while we deliberately navigate away (confirmed Back), so the
  // beforeunload prompt doesn't ask a second time if that Back is a hard
  // navigation out of the app.
  const leavingRef = useRef(false)
  const sentinelRef = useRef(false)

  useEffect(() => {
    if (!dirty) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leavingRef.current) return
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
        // Absolute URLs trigger a full navigation, which beforeunload
        // already catches.
        return
      }

      if (!window.confirm(LEAVE_MESSAGE)) {
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

  // Back/Forward guard (3). The listener lives for the whole mount; the
  // sentinel is pushed the first time the page turns dirty (and re-pushed
  // after a cancelled Back). `dirtyRef` decides at pop time whether to ask.
  useEffect(() => {
    const handlePopState = () => {
      if (!sentinelRef.current) return
      sentinelRef.current = false
      if (!dirtyRef.current || window.confirm(LEAVE_MESSAGE)) {
        leavingRef.current = true
        // If there's nowhere to go back to, don't leave the unload prompt
        // disabled for the rest of the session.
        window.setTimeout(() => {
          leavingRef.current = false
        }, 1000)
        window.history.back()
        return
      }
      pushSentinel(sentinelRef)
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  useEffect(() => {
    if (dirty && !sentinelRef.current) pushSentinel(sentinelRef)
  }, [dirty])
}
