import { redirect } from "next/navigation"
import { getOwnerSession } from "@/lib/admin-guard"
import { createDraft } from "@/lib/blog-drafts"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "新規ブログ | KSL Admin",
  robots: { index: false, follow: false },
}

// "+ new" entry point — creates an empty draft and immediately redirects to
// the editor. Having this as a page (not just a button + API call) keeps the
// flow refresh-safe: revisiting /admin/blog/new always starts a fresh draft
// rather than reopening an old one.
export default async function NewBlogPage() {
  const session = await getOwnerSession()
  if (!session) {
    // The parent /admin/blog layout already 404s for non-owners, but defend
    // here too in case routing wraps change in the future.
    return null
  }
  const draft = await createDraft({
    ownerSubscriberId: session.subscriberId,
    publishDate: new Date().toISOString(),
  })
  redirect(`/admin/blog/drafts/${draft.id}`)
}
