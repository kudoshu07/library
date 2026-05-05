"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "入力内容に誤りがあります。",
  invalid_json: "送信に失敗しました。もう一度お試しください。",
  display_name_required: "表示名を入力してください。",
  display_name_too_long: "表示名は30文字以内で入力してください。",
  display_name_invalid: "表示名に改行・タブは使えません。",
  no_changes: "変更がありません。",
  unauthorized: "セッションが切れました。再度ログインしてください。",
  database_error: "データベースエラーが発生しました。時間をおいてお試しください。",
  supabase_not_configured: "現在この機能は利用できません。",
}

function explainError(payload: { error?: string }): string {
  const code = payload.error
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
  return "送信に失敗しました。時間をおいてお試しください。"
}

export function AccountForm({
  email,
  initialDisplayName,
  initialNotifyOnReply,
}: {
  email: string
  initialDisplayName: string
  initialNotifyOnReply: boolean
}) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [notifyOnReply, setNotifyOnReply] = useState(initialNotifyOnReply)
  const [savedDisplayName, setSavedDisplayName] = useState(initialDisplayName)
  const [savedNotifyOnReply, setSavedNotifyOnReply] = useState(initialNotifyOnReply)
  const [saveStatus, setSaveStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved" }
    | { kind: "error"; message: string }
  >({ kind: "idle" })
  const [busyAction, setBusyAction] = useState<null | "logout" | "unsubscribe">(null)

  const isDirty =
    displayName.trim() !== savedDisplayName ||
    notifyOnReply !== savedNotifyOnReply

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isDirty || !displayName.trim()) return
    setSaveStatus({ kind: "saving" })
    const payload: Record<string, unknown> = {}
    if (displayName.trim() !== savedDisplayName) payload.displayName = displayName.trim()
    if (notifyOnReply !== savedNotifyOnReply) payload.notifyOnReply = notifyOnReply
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setSaveStatus({ kind: "error", message: explainError(data) })
        return
      }
      setSavedDisplayName(displayName.trim())
      setSavedNotifyOnReply(notifyOnReply)
      setSaveStatus({ kind: "saved" })
    } catch {
      setSaveStatus({
        kind: "error",
        message: "ネットワークエラーが発生しました。時間をおいてお試しください。",
      })
    }
  }

  const handleLogout = async () => {
    setBusyAction("logout")
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      router.push("/")
      router.refresh()
    }
  }

  const handleUnsubscribe = async () => {
    if (!confirm("メルマガを解除すると、このメールアドレスで投稿したコメントもすべて削除されます。続けてよろしいですか？")) {
      return
    }
    setBusyAction("unsubscribe")
    try {
      const res = await fetch("/api/account/unsubscribe", { method: "POST" })
      if (!res.ok) {
        setBusyAction(null)
        alert("退会処理に失敗しました。時間をおいてお試しください。")
        return
      }
      router.push("/subscribe/unsubscribed")
      router.refresh()
    } catch {
      setBusyAction(null)
      alert("ネットワークエラーが発生しました。")
    }
  }

  const isSaving = saveStatus.kind === "saving"

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-6 shadow-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          ログイン中のメールアドレス
        </span>
        <span className="text-sm text-card-foreground">{email}</span>
      </div>

      <form
        onSubmit={handleSave}
        className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm md:p-8"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="account-display-name" className="text-sm font-medium text-card-foreground">
            表示名
          </label>
          <Input
            id="account-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={30}
            disabled={isSaving}
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            ブログ記事へのコメント時に表示される名前です（30文字以内）。
          </p>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-card-foreground">返信メール通知</span>
            <p className="text-xs text-muted-foreground">
              自分のコメントに返信が付いたとき、メールで通知します。
            </p>
          </div>
          <Switch
            checked={notifyOnReply}
            onCheckedChange={setNotifyOnReply}
            disabled={isSaving}
            aria-label="返信メール通知"
          />
        </div>

        <Button type="submit" className="w-full" disabled={!isDirty || !displayName.trim() || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              保存中…
            </>
          ) : (
            "変更を保存"
          )}
        </Button>

        {saveStatus.kind === "saved" ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>保存しました。</span>
          </div>
        ) : null}
        {saveStatus.kind === "error" ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>{saveStatus.message}</span>
          </div>
        ) : null}
      </form>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <span className="text-sm font-medium text-card-foreground">セッション</span>
        <Button
          type="button"
          variant="outline"
          onClick={handleLogout}
          disabled={busyAction !== null}
        >
          {busyAction === "logout" ? "ログアウト中…" : "ログアウト"}
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <span className="text-sm font-medium text-destructive">メルマガを解除</span>
        <p className="text-xs text-muted-foreground">
          解除するとメール配信が止まり、これまで投稿したコメントもすべて削除されます。
        </p>
        <Button
          type="button"
          variant="destructive"
          onClick={handleUnsubscribe}
          disabled={busyAction !== null}
        >
          {busyAction === "unsubscribe" ? "退会処理中…" : "メルマガを解除する"}
        </Button>
      </div>
    </div>
  )
}
