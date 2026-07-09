"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import { SourceInlineLabel } from "@/components/source-ui"
import {
  TurnstileWidget,
  isTurnstileConfigured,
} from "@/components/turnstile-widget"
import type { ContentSource } from "@/lib/data"

const sources: { id: ContentSource }[] = [
  { id: "blog" },
  { id: "note" },
  { id: "ig_business" },
  { id: "ig_photo" },
  { id: "pod_ochinashi" },
  { id: "pod_yonakoi" },
  { id: "pod_vegan" },
]

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "confirmation_sent" }
  | { kind: "updated" }
  | { kind: "error"; message: string }

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "入力内容に誤りがあります。",
  invalid_json: "送信に失敗しました。もう一度お試しください。",
  invalid_email: "メールアドレスの形式が正しくありません。",
  disposable_email: "このメールアドレスは利用できません。別のアドレスでお試しください。",
  display_name_required: "表示名を入力してください。",
  display_name_too_long: "表示名は30文字以内で入力してください。",
  display_name_invalid: "表示名に改行・タブは使えません。",
  sources_required: "購読対象を1つ以上選択してください。",
  database_error: "データベースエラーが発生しました。時間をおいてお試しください。",
  email_send_failed: "確認メールの送信に失敗しました。時間をおいてお試しください。",
  supabase_not_configured: "現在この機能は利用できません。",
  resend_not_configured: "現在この機能は利用できません。",
  turnstile_failed: "ボット検証に失敗しました。ページを再読み込みしてもう一度お試しください。",
}

function explainError(payload: { error?: string; issues?: Array<{ message?: string }> }): string {
  const code = payload.error
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
  const issueCode = payload.issues?.[0]?.message
  if (issueCode && ERROR_MESSAGES[issueCode]) return ERROR_MESSAGES[issueCode]
  return "送信に失敗しました。時間をおいてお試しください。"
}

export type SubscribeFormStatusKind = Status["kind"]

export function SubscribeForm({
  embedded = false,
  onStatusChange,
  returnTo,
}: {
  embedded?: boolean
  onStatusChange?: (status: SubscribeFormStatusKind) => void
  returnTo?: string
} = {}) {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [selected, setSelected] = useState<string[]>(["blog", "note"])
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileEnabled = isTurnstileConfigured()

  useEffect(() => {
    onStatusChange?.(status.kind)
  }, [status.kind, onStatusChange])

  const toggleSource = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const reset = () => {
    setStatus({ kind: "idle" })
    setEmail("")
    setDisplayName("")
    setSelected(["blog", "note"])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !displayName.trim() || selected.length === 0) return
    if (turnstileEnabled && !turnstileToken) {
      setStatus({
        kind: "error",
        message: "ボット検証を完了してください。",
      })
      return
    }
    setStatus({ kind: "submitting" })

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          sources: selected,
          turnstileToken: turnstileToken ?? undefined,
          returnTo,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        status?: string
        error?: string
        issues?: Array<{ message?: string }>
      }

      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", message: explainError(data) })
        return
      }

      if (data.status === "updated") {
        setStatus({ kind: "updated" })
      } else {
        setStatus({ kind: "confirmation_sent" })
      }
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

  if (status.kind === "confirmation_sent") {
    return (
      <div className={surfaceClass}>
        <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
          <CheckCircle2 className="size-6 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-card-foreground">確認メールを確認してください👀</h3>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{email}</strong> 宛に確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。
        </p>
      </div>
    )
  }

  if (status.kind === "updated") {
    return (
      <div className={surfaceClass}>
        <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
          <CheckCircle2 className="size-6 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-card-foreground">設定を更新しました</h3>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{email}</strong> の購読対象を更新しました。
        </p>
      </div>
    )
  }

  const isSubmitting = status.kind === "submitting"

  return (
    <form
      onSubmit={handleSubmit}
      className={formClass}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="subscribe-email" className="text-sm font-medium text-card-foreground">
          Email
        </label>
        <Input
          id="subscribe-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isSubmitting}
          className="h-10"
          aria-describedby="subscribe-email-help"
        />
        <p id="subscribe-email-help" className="text-xs text-muted-foreground">
          購読のメール通知にのみ使用します👌
        </p>
      </div>

      {email.trim().length > 0 ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="subscribe-display-name" className="text-sm font-medium text-card-foreground">
            表示名
          </label>
          <Input
            id="subscribe-display-name"
            type="text"
            placeholder="工藤 柊"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={30}
            disabled={isSubmitting}
            className="h-10"
            aria-describedby="subscribe-display-name-help"
          />
          <p id="subscribe-display-name-help" className="text-xs text-muted-foreground">
            ブログへのコメントなどに表示されます
          </p>
        </div>
      ) : null}

      {displayName.trim().length > 0 && email.trim().length > 0 ? (
        <fieldset disabled={isSubmitting}>
          <legend className="mb-3 text-sm font-medium text-card-foreground">
            通知対象
          </legend>
          <div className="flex flex-col gap-3">
            {sources.map((source) => (
              <label
                key={source.id}
                className="flex cursor-pointer items-center gap-3"
              >
                <Checkbox
                  checked={selected.includes(source.id)}
                  onCheckedChange={() => toggleSource(source.id)}
                  aria-label={source.id}
                />
                <SourceInlineLabel
                  source={source.id}
                  className="text-sm text-card-foreground"
                  iconClassName="size-4"
                />
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {turnstileEnabled &&
      email.trim().length > 0 &&
      displayName.trim().length > 0 ? (
        <TurnstileWidget
          action="subscribe"
          onToken={setTurnstileToken}
          className="flex justify-center"
        />
      ) : null}

      <div className="flex flex-col items-center gap-2">
        <Button
          type="submit"
          className="w-full"
          disabled={
            !email.trim() ||
            !displayName.trim() ||
            selected.length === 0 ||
            isSubmitting ||
            (turnstileEnabled && !turnstileToken)
          }
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              送信中…
            </>
          ) : (
            "購読"
          )}
        </Button>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          プライバシーポリシー
        </a>
      </div>

      {status.kind === "error" ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{status.message}</span>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        確認メールのリンクをクリックして登録完了します。配信停止はメール内のリンクからいつでもできます。
      </p>
    </form>
  )
}
