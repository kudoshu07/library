import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Confirmed",
  robots: { index: false, follow: false },
}

type Status = "ok" | "already" | "invalid" | "error"

function resolveStatus(value: string | undefined): Status {
  if (value === "ok" || value === "already" || value === "invalid" || value === "error") {
    return value
  }
  return "invalid"
}

const messages: Record<Status, { icon: "ok" | "warn"; title: string; body: string }> = {
  ok: {
    icon: "ok",
    title: "登録が完了しました☺️",
    body: "楽しみにしてくださる人がいること、とても励みになります。今後も、気に入った文章があればコメントなどでリアクションいただけると嬉しいです🫶 工藤柊",
  },
  already: {
    icon: "ok",
    title: "すでに登録済みです",
    body: "この URL は処理済みです。新しいコンテンツが届くのをお待ちください。",
  },
  invalid: {
    icon: "warn",
    title: "リンクが無効です",
    body: "確認リンクの有効期限が切れているか、すでに使用されています。お手数ですが再度ご登録ください。",
  },
  error: {
    icon: "warn",
    title: "処理中にエラーが発生しました",
    body: "時間をおいてもう一度お試しください。問題が続く場合は管理者までご連絡ください。",
  },
}

export default async function SubscribeConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const resolved = resolveStatus(status)
  const message = messages[resolved]
  const Icon = message.icon === "ok" ? CheckCircle2 : AlertTriangle
  const isCelebration = resolved === "ok"

  return (
    <div className="mx-auto max-w-lg px-4 py-16 lg:px-6">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        {isCelebration ? (
          <div
            className="flex size-12 items-center justify-center text-4xl leading-none"
            aria-hidden="true"
          >
            🎉
          </div>
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
            <Icon
              className={`size-6 ${message.icon === "ok" ? "text-accent" : "text-amber-600"}`}
            />
          </div>
        )}
        <h1 className="text-xl font-semibold text-card-foreground">{message.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{message.body}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/home">Back to Home</Link>
        </Button>
      </div>
    </div>
  )
}
