/**
 * Shared blog body rendering helpers.
 *
 * Extracted from app/[year]/[month]/[day]/[slug]/page.tsx so the admin
 * preview screen can mirror the public post layout exactly. Anything you
 * change here changes both surfaces — keep them aligned on purpose.
 */

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi
const HTML_TAG_PATTERN = /(<[^>]+>)/g
const INLINE_IMAGE_WITH_CAPTION_PATTERN = /^(\s*)(<img\b[^>]*\/?>)\s*([^\n<].*?)\s*$/gimu

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function trimTrailingUrlPunctuation(rawUrl: string): { cleanUrl: string; trailing: string } {
  let cleanUrl = rawUrl
  let trailing = ""

  while (cleanUrl.length > 0) {
    const lastChar = cleanUrl.slice(-1)
    if (/[.,!?;:'"、。]/u.test(lastChar)) {
      trailing = `${lastChar}${trailing}`
      cleanUrl = cleanUrl.slice(0, -1)
      continue
    }

    if (lastChar === ")") {
      const openCount = cleanUrl.split("(").length - 1
      const closeCount = cleanUrl.split(")").length - 1
      if (closeCount > openCount) {
        trailing = `${lastChar}${trailing}`
        cleanUrl = cleanUrl.slice(0, -1)
        continue
      }
    }

    break
  }

  return { cleanUrl, trailing }
}

function linkifyTextSegment(rawText: string): string {
  return rawText.replace(URL_PATTERN, (matchedUrl) => {
    const { cleanUrl, trailing } = trimTrailingUrlPunctuation(matchedUrl)
    if (!cleanUrl) return matchedUrl

    const normalizedUrl = decodeHtmlEntities(cleanUrl)
    const escapedUrl = escapeHtml(normalizedUrl)
    return `<a href="${escapedUrl}">${escapedUrl}</a>${escapeHtml(trailing)}`
  })
}

function promoteInlineImageCaption(html: string): string {
  return html.replace(
    INLINE_IMAGE_WITH_CAPTION_PATTERN,
    (matched, indent: string, imageTag: string, rawCaption: string) => {
      const caption = rawCaption.trim()
      if (!caption) return matched
      return `${indent}<figure>
${indent}  ${imageTag}
${indent}  <figcaption>${escapeHtml(caption)}</figcaption>
${indent}</figure>`
    },
  )
}

export function linkifyHtmlContent(html: string): string {
  const normalizedHtml = promoteInlineImageCaption(html)
  const segments = normalizedHtml.split(HTML_TAG_PATTERN)
  let insideAnchorDepth = 0

  return segments
    .map((segment) => {
      if (!segment.startsWith("<")) {
        if (insideAnchorDepth > 0) return segment
        return linkifyTextSegment(segment)
      }

      if (/^<\s*\/\s*a\b/i.test(segment)) {
        insideAnchorDepth = Math.max(0, insideAnchorDepth - 1)
        return segment
      }

      if (/^<\s*a\b/i.test(segment) && !/\/\s*>$/.test(segment)) {
        insideAnchorDepth += 1
      }

      return segment
    })
    .join("")
}

export function linkifyPlainTextContent(text: string): string {
  const escaped = escapeHtml(text).replace(/\r\n?/g, "\n")
  return linkifyTextSegment(escaped).replace(/\n/g, "<br />")
}

/**
 * Renders the editor body HTML the same way the public post page does.
 * Returns the final `__html` string ready for dangerouslySetInnerHTML.
 */
export function renderBlogBodyHtml(body: string): string {
  const hasHtmlTags = /<\s*[a-z][^>]*>/i.test(body)
  return hasHtmlTags ? linkifyHtmlContent(body) : linkifyPlainTextContent(body)
}

/**
 * The exact Tailwind class string used to style the body container on the
 * public post page. Centralized so the preview screen stays pixel-aligned.
 */
export const BLOG_BODY_CLASS_NAME =
  "text-[15px] leading-7 text-card-foreground [overflow-wrap:anywhere] [&_p]:mb-2 [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:underline [&_a]:[overflow-wrap:anywhere] [&_a]:break-words [&_figure]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:bg-[#264F8B]/[0.03] [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-xs [&_figcaption]:leading-relaxed [&_figcaption]:text-slate-500 [&_table]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-slate-200 [&_table]:text-sm [&_thead]:bg-slate-50 [&_th]:border-b [&_th]:border-slate-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold [&_th]:text-slate-900 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:text-slate-700 [&_tbody_tr:nth-child(even)]:bg-slate-50/50 [&_tbody_tr:last-child_td]:border-b-0 [&_iframe]:my-6 [&_iframe]:block [&_iframe]:w-full [&_iframe]:max-w-full [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:rounded-lg [&_iframe]:border [&_iframe]:border-slate-200 [&_iframe]:bg-slate-50 [&_blockquote]:my-4 [&_blockquote]:pl-4 [&_blockquote]:border-l-4 [&_blockquote]:border-[#d1d5db] [&_strong]:font-bold [&_strong]:underline [&_strong]:decoration-[#CEE5F9] [&_strong]:decoration-4 [&_strong]:underline-offset-2"
