"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "sent" }
  | { kind: "error"; message: string }

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "入力内容に誤りがあります。",
  invalid_email: "メールアドレスの形式が正しくありません。",
  invalid_json: "送信に失敗しました。もう一度お試しください。",
  not_subscribed: "このメールアドレスはニュースレターに登録されていません。",
  not_confirmed: "ニュースレターの登録確認が完了していません。確認メールのリンクをクリックしてください。",
  rate_limited: "ログインリンクの発行が多すぎます。1 分ほどお待ちください。",
  database_error: "データベースエラーが発生しました。時間をおいてお試しください。",
  email_send_failed: "ログインメールの送信に失敗しました。時間をおいてお試しください。",
  supabase_not_configured: "現在この機能は利用できません。",
  resend_not_configured: "現在この機能は利用できません。",
}

const STATUS_BANNERS: Record<string, string> = {
  invalid: "ログインリンクが見つかりませんでした。再度お試しください。",
  expired: "ログインリンクの有効期限が切れています。再度お試しください。",
  used: "このログインリンクは既に使用済みです。再度お試しください。",
  error: "予期せぬエラーが発生しました。再度お試しください。",
}

function explainError(payload: { error?: string }): string {
  const code = payload.error
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
  return "送信に失敗しました。時間をおいてお試しください。"
}

export function LoginForm({
  next,
  status: bannerStatus,
  embedded = false,
}: {
  next?: string
  status?: string
  embedded?: boolean
}) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus({ kind: "submitting" })
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), next }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", message: explainError(data) })
        return
      }
      setStatus({ kind: "sent" })
    } catch {
      setStatus({
        kind: "error",
        message: "ネットワークエラーが発生しました。時間をおいてお試しください。",
      })
    }
  }

  const surfaceClass = embedded
    ? "flex flex-col items-center gap-4 text-center"
    : "flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm"
  const formClass = embedded
    ? "flex flex-col gap-6"
    : "flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm md:p-8"

  if (status.kind === "sent") {
    return (
      <div className={surfaceClass}>
        <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
          <CheckCircle2 className="size-6 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-card-foreground">ログインリンクをお送りしました</h3>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{email}</strong> 宛にログインリンクを送信しました。15 分以内にリンクをクリックしてください。
        </p>
      </div>
    )
  }

  const isSubmitting = status.kind === "submitting"
  const banner = bannerStatus ? STATUS_BANNERS[bannerStatus] : null

  return (
    <form
      onSubmit={handleSubmit}
      className={formClass}
    >
      {banner ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{banner}</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <label htmlFor="login-email" className="text-sm font-medium text-card-foreground">
          メールアドレス
        </label>
        <Input
          id="login-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isSubmitting}
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">
          ニュースレター登録に使ったメールアドレスを入力してください。
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={!email.trim() || isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            送信中…
          </>
        ) : (
          "ログインリンクを送る"
        )}
      </Button>

      {status.kind === "error" ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{status.message}</span>
        </div>
      ) : null}
    </form>
  )
}
