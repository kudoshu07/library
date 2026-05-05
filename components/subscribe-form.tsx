"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"

const sources = [
  { id: "blog", label: "Blog" },
  { id: "note", label: "note(個人)" },
  { id: "ig_business", label: "kudoshu_vcook" },
  { id: "ig_photo", label: "onoshu_photo(写真)" },
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
  display_name_required: "表示名を入力してください。",
  display_name_too_long: "表示名は30文字以内で入力してください。",
  display_name_invalid: "表示名に改行・タブは使えません。",
  sources_required: "購読対象を1つ以上選択してください。",
  database_error: "データベースエラーが発生しました。時間をおいてお試しください。",
  email_send_failed: "確認メールの送信に失敗しました。時間をおいてお試しください。",
  supabase_not_configured: "現在この機能は利用できません。",
  resend_not_configured: "現在この機能は利用できません。",
}

function explainError(payload: { error?: string; issues?: Array<{ message?: string }> }): string {
  const code = payload.error
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
  const issueCode = payload.issues?.[0]?.message
  if (issueCode && ERROR_MESSAGES[issueCode]) return ERROR_MESSAGES[issueCode]
  return "送信に失敗しました。時間をおいてお試しください。"
}

export function SubscribeForm() {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [selected, setSelected] = useState<string[]>(["blog", "note"])
  const [status, setStatus] = useState<Status>({ kind: "idle" })

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
    setStatus({ kind: "submitting" })

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          sources: selected,
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

  if (status.kind === "confirmation_sent") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
          <CheckCircle2 className="size-6 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-card-foreground">確認メールをお送りしました</h3>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{email}</strong> 宛に確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。
        </p>
        <Button variant="outline" size="sm" onClick={reset}>
          別のメールアドレスを登録する
        </Button>
      </div>
    )
  }

  if (status.kind === "updated") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
          <CheckCircle2 className="size-6 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-card-foreground">設定を更新しました</h3>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{email}</strong> の購読対象を更新しました。
        </p>
        <Button variant="outline" size="sm" onClick={reset}>
          別のメールアドレスを登録する
        </Button>
      </div>
    )
  }

  const isSubmitting = status.kind === "submitting"

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm md:p-8"
    >
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
          ブログ記事へのコメント時に表示される名前です（30文字以内、後から変更できます）。
        </p>
      </div>

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
        />
      </div>

      <fieldset disabled={isSubmitting}>
        <legend className="mb-3 text-sm font-medium text-card-foreground">
          Sources
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
                aria-label={source.label}
              />
              <span className="text-sm text-card-foreground">{source.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Button
        type="submit"
        className="w-full"
        disabled={
          !email.trim() ||
          !displayName.trim() ||
          selected.length === 0 ||
          isSubmitting
        }
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            送信中…
          </>
        ) : (
          "Subscribe"
        )}
      </Button>

      {status.kind === "error" ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{status.message}</span>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        登録後に確認メールが届きます。リンクをクリックすると、新しいコンテンツが追加されたタイミングでメールをお届けします。配信停止はメール内のリンクからいつでも可能です。
      </p>
    </form>
  )
}
