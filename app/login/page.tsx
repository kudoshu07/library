import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { getSession } from "@/lib/auth"

export const metadata: Metadata = {
  title: "ログイン",
  description: "Kudo Shu Library にログインしてコメント機能を利用しましょう。",
}

export const dynamic = "force-dynamic"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; status?: string }>
}) {
  const session = await getSession()
  const sp = await searchParams
  const safeNext =
    sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//")
      ? sp.next
      : undefined
  if (session) {
    redirect(safeNext ?? "/account")
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 lg:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl text-balance">
          ログイン
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          ニュースレターに登録済みのメールアドレスを入力すると、ログインリンクをお送りします。パスワードは不要です。
        </p>
      </div>
      <LoginForm next={safeNext} status={sp.status} />
    </div>
  )
}
