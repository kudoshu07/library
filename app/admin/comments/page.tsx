import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { listBannedSubscribers, listRecentComments } from "@/lib/moderation"
import { AdminCommentsClient } from "@/components/admin/admin-comments"

export const metadata: Metadata = {
  title: "コメント管理",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function AdminCommentsPage() {
  const session = await getSession()
  if (!session) {
    redirect("/login?next=/admin/comments")
  }
  if (!session.isOwner) {
    notFound()
  }

  const [comments, banned] = await Promise.all([
    listRecentComments(100),
    listBannedSubscribers(),
  ])

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 lg:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl text-balance">
          コメント管理
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          直近のコメントを確認・削除し、不適切なユーザーを BAN できます。
        </p>
      </header>
      <AdminCommentsClient initialComments={comments} initialBanned={banned} />
    </div>
  )
}
