import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AccountForm } from "@/components/account-form"
import { getSession } from "@/lib/auth"

export const metadata: Metadata = {
  title: "アカウント",
  description: "Kudo Shu Library のアカウント設定。",
}

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const session = await getSession()
  if (!session) redirect("/login?next=/account")

  return (
    <div className="mx-auto max-w-xl px-4 py-12 lg:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl text-balance">
          アカウント
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          表示名や通知設定を管理できます。
        </p>
      </div>
      <AccountForm
        email={session.email}
        initialDisplayName={session.displayName ?? ""}
        initialNotifyOnReply={session.notifyOnReply}
        initialSources={session.sources}
      />
    </div>
  )
}
