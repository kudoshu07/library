import { notFound } from "next/navigation"
import { getOwnerSession } from "@/lib/admin-guard"

// All /admin/blog/* routes are owner-only. We notFound() (not 403) for
// non-owners and logged-out visitors so the route's existence isn't
// disclosed. The /admin/comments route handles its own auth (with a
// login redirect) and is unaffected.
export const dynamic = "force-dynamic"

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminBlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getOwnerSession()
  if (!session) notFound()
  return <>{children}</>
}
