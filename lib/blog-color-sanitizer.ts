// Keeps foreign text/background colours out of blog posts.
//
// Why: pasting from another app (e.g. note.com on a phone in dark mode)
// carries inline `color: rgba(255,255,255,.9)` into BlockNote. The editor
// ignores colours that aren't in its palette, so the text looks black while
// writing — but blocksToHTMLLossy exports them as `style="color: …"`, and the
// public page then renders white text on a white background.
//
// Two layers:
//  1. stripPastedColors(html) — cleans clipboard HTML before it is inserted.
//  2. sanitizeBlockColors(blocks) — drops any non-palette colour at
//     save/publish time, so older drafts are fixed too.

export const BLOCKNOTE_COLORS = new Set([
  "default",
  "gray",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
])

const COLOR_STYLE_PROPS = ["color", "background-color", "background"]

/** Removes colour-related inline styles / attributes from pasted HTML. */
export function stripPastedColors(html: string): string {
  if (typeof DOMParser === "undefined") return html
  const doc = new DOMParser().parseFromString(html, "text/html")
  doc.body.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if (el.style) {
      for (const prop of COLOR_STYLE_PROPS) el.style.removeProperty(prop)
      if (!el.getAttribute("style")?.trim()) el.removeAttribute("style")
    }
    el.removeAttribute("color") // <font color>
    el.removeAttribute("bgcolor")
    for (const attr of ["data-text-color", "data-background-color"]) {
      const v = el.getAttribute(attr)
      if (v != null && !BLOCKNOTE_COLORS.has(v)) el.removeAttribute(attr)
    }
  })
  return doc.body.innerHTML
}

/** True when the HTML carries any colour we would strip. */
export function hasForeignColors(html: string): boolean {
  return /(?:^|[\s;"'])(?:background-)?color\s*:|\bbgcolor=|<font[^>]*\scolor=|data-(?:text|background)-color="(?!(?:default|gray|brown|red|orange|yellow|green|blue|purple|pink)")/i.test(
    html,
  )
}

type AnyRecord = Record<string, unknown>

const isValid = (v: unknown) => typeof v !== "string" || BLOCKNOTE_COLORS.has(v)

function sanitizeInline(content: unknown): unknown {
  if (!Array.isArray(content)) return content
  return content.map((node) => {
    if (!node || typeof node !== "object") return node
    const n = node as AnyRecord
    let out: AnyRecord = n
    const styles = n.styles as AnyRecord | undefined
    if (styles && (!isValid(styles.textColor) || !isValid(styles.backgroundColor))) {
      const next = { ...styles }
      if (!isValid(next.textColor)) delete next.textColor
      if (!isValid(next.backgroundColor)) delete next.backgroundColor
      out = { ...out, styles: next }
    }
    if (Array.isArray(n.content)) out = { ...out, content: sanitizeInline(n.content) }
    return out
  })
}

function sanitizeContent(content: unknown): unknown {
  if (Array.isArray(content)) return sanitizeInline(content)
  if (content && typeof content === "object" && (content as AnyRecord).type === "tableContent") {
    const t = content as AnyRecord
    const rows = (t.rows as AnyRecord[] | undefined)?.map((row) => ({
      ...row,
      cells: (row.cells as unknown[]).map((cell) => {
        if (Array.isArray(cell)) return sanitizeInline(cell)
        if (cell && typeof cell === "object") {
          const c = cell as AnyRecord
          return { ...c, props: sanitizeProps(c.props), content: sanitizeInline(c.content) }
        }
        return cell
      }),
    }))
    return { ...t, rows }
  }
  return content
}

function sanitizeProps(props: unknown): unknown {
  if (!props || typeof props !== "object") return props
  const p = props as AnyRecord
  if (isValid(p.textColor) && isValid(p.backgroundColor)) return p
  return {
    ...p,
    ...(isValid(p.textColor) ? {} : { textColor: "default" }),
    ...(isValid(p.backgroundColor) ? {} : { backgroundColor: "default" }),
  }
}

/** Returns a copy of the blocks with every non-palette colour removed. */
export function sanitizeBlockColors<T>(blocks: T[]): T[] {
  return blocks.map((block) => {
    const b = block as unknown as AnyRecord
    return {
      ...b,
      props: sanitizeProps(b.props),
      content: sanitizeContent(b.content),
      children: Array.isArray(b.children) ? sanitizeBlockColors(b.children) : b.children,
    } as unknown as T
  })
}
