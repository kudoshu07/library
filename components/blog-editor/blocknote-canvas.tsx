"use client"

import { useEffect, useMemo, useRef } from "react"
import { BlockNoteSchema, defaultBlockSpecs, type Block, type PartialBlock } from "@blocknote/core"
import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/mantine"
import "@blocknote/core/fonts/inter.css"
import "@blocknote/mantine/style.css"

// The BlockNote editor wrapper. Owns the editor instance and forwards
// content-change events to its parent as both BlockNote JSON (for round-trip
// editing) and HTML (for MDX publication).
//
// Block schema: we use BlockNote's defaults minus a few we have no use for
// (audio, video, file) so the slash menu and rendered MDX stay aligned with
// what the public blog renderer can display today (HTML produced by
// blocksToHTMLLossy maps cleanly to the post page's CSS rules — see
// app/[year]/[month]/[day]/[slug]/page.tsx).
//
// Image uploads: when the editor receives an image, it calls `uploadFile`
// which we wire to `/api/admin/blog/upload-image`. The slug from the meta
// form drives where the file lands in the repo (public/{slug}/...). If the
// slug is empty we reject the upload with an explanatory error so the user
// goes back and fills it in before adding images.

const blogSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    quote: defaultBlockSpecs.quote,
    codeBlock: defaultBlockSpecs.codeBlock,
    image: defaultBlockSpecs.image,
    table: defaultBlockSpecs.table,
    divider: (defaultBlockSpecs as Record<string, unknown>).divider as never,
  },
})

export type BlocknoteCanvasHandle = {
  // BlockNote 0.51's `blocksToHTMLLossy` is synchronous, but we return
  // `string | Promise<string>` so the caller can always `await` it without
  // a type narrowing dance — and so we're future-proof if a later release
  // moves the implementation off the main thread.
  getHtml: () => string | Promise<string>
  getBlocks: () => Block[]
}

export function BlocknoteCanvas({
  initialBlocks,
  initialHtml,
  getSlug,
  onChange,
  handleRef,
}: {
  initialBlocks?: PartialBlock[]
  /**
   * Fallback used when initialBlocks is empty/undefined — typically when a
   * draft was just imported from a published MDX (the import API stores HTML
   * but no blocks, since the parser only runs in the browser). On mount we
   * parse the HTML into blocks once and replace the editor document.
   */
  initialHtml?: string
  getSlug: () => string
  onChange?: (blocks: Block[]) => void
  handleRef?: { current: BlocknoteCanvasHandle | null }
}) {
  // The slug can change after the editor is mounted (the user types into the
  // slug field). useRef lets us read the latest value inside the (stable)
  // uploadFile callback without re-creating the editor instance.
  const slugRef = useRef<string>(getSlug())
  useEffect(() => {
    slugRef.current = getSlug()
  })

  const editor = useCreateBlockNote({
    schema: blogSchema,
    initialContent: initialBlocks && initialBlocks.length > 0 ? initialBlocks : undefined,
    uploadFile: async (file: File) => {
      const slug = slugRef.current.trim()
      if (!slug) {
        throw new Error(
          "slugを先に入力してください。画像は public/{slug}/ に保存されます。",
        )
      }
      const fd = new FormData()
      fd.append("file", file)
      fd.append("slug", slug)
      const res = await fetch("/api/admin/blog/upload-image", {
        method: "POST",
        body: fd,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(data?.error ?? `upload failed (${res.status})`)
      }
      const data = (await res.json()) as { url: string }
      return data.url
    },
  })

  // Stable handle for the parent (Save / Publish buttons) to pull current
  // content out of the editor at the moment of save. We don't push every
  // keystroke through React state because BlockNote's onChange fires very
  // frequently and the user has explicit save anyway.
  useEffect(() => {
    if (!handleRef) return
    handleRef.current = {
      getHtml: () => editor.blocksToHTMLLossy(editor.document),
      getBlocks: () => editor.document,
    }
    return () => {
      if (handleRef) handleRef.current = null
    }
  }, [editor, handleRef])

  // One-shot HTML import for drafts that came from an existing MDX file
  // (the server stores body_html but no blocks). Re-runs only if the
  // initialHtml prop changes — which it won't during a single edit session.
  const hydrated = useRef(false)
  useEffect(() => {
    if (hydrated.current) return
    const hasInitialBlocks = initialBlocks && initialBlocks.length > 0
    const hasHtml = initialHtml && initialHtml.trim().length > 0
    if (hasInitialBlocks || !hasHtml) return
    hydrated.current = true
    try {
      const blocks = editor.tryParseHTMLToBlocks(initialHtml!)
      if (blocks.length > 0) {
        editor.replaceBlocks(editor.document, blocks)
      }
    } catch (err) {
      console.error("HTML to blocks parse failed", err)
    }
  }, [editor, initialBlocks, initialHtml])

  const handleChange = useMemo(() => {
    if (!onChange) return undefined
    return () => onChange(editor.document)
  }, [editor, onChange])

  // Stretch the editor canvas to fill (most of) the viewport even before the
  // user has typed enough to need it. BlockNote's default style auto-grows,
  // which leaves an unhelpful one-line strip when the doc is empty.
  // The `min-h-[calc(100vh-...)]` accounts for the page padding + the editor
  // header bar so the white area lines up with the visible viewport without
  // forcing scrollbars.
  return (
    <div className="ksl-blocknote-canvas rounded-md border border-border bg-white">
      <BlockNoteView editor={editor} onChange={handleChange} theme="light" />
    </div>
  )
}
