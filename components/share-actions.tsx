"use client"

import { useEffect, useState } from "react"
import { Link2, Share2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

async function copyTextToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "absolute"
  textarea.style.left = "-9999px"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}

export function ShareActions({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const handleNativeShare = async () => {
    if (!canNativeShare || typeof navigator === "undefined") return
    try {
      await navigator.share({
        title,
        text: title,
        url,
      })
    } catch {
      // User dismissed or device blocked sharing.
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs transition-colors hover:text-sky-600"
          aria-label="Share options"
        >
          <Share2 className="size-4" />
          <span>Share</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 rounded-2xl p-2">
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void handleCopy()
          }}
          className="rounded-xl px-3 py-3 text-base font-semibold"
        >
          <Link2 className="size-5" />
          <span>{copied ? "リンクをコピーしました" : "リンクをコピー"}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void handleNativeShare()
          }}
          disabled={!canNativeShare}
          className="rounded-xl px-3 py-3 text-base font-semibold"
        >
          <Share2 className="size-5" />
          <span>その他の方法で共有</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

