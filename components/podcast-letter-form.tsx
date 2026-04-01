"use client"

import { useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export function PodcastLetterForm() {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !message.trim()) return

    setSubmitting(true)
    setErrorMessage(null)
    try {
      const res = await fetch("/api/podcast-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          message: message.trim(),
        }),
      })

      if (!res.ok) {
        const detail = await res.json().catch(() => null) as { error?: string; issues?: Array<{ message?: string }> } | null
        const issueMessage = detail?.issues?.[0]?.message
        const description = issueMessage
          ? issueMessage
          : detail?.error
            ? `Error: ${detail.error}`
            : "お手数ですが、時間をおいて再度お試しください。"
        setErrorMessage(description)
        toast({
          title: "送信に失敗しました",
          description,
          variant: "destructive",
        })
        return
      }

      setSubmitted(true)
      setName("")
      setMessage("")
      toast({
        title: "お便りを受け付けました",
        description: "ありがとうございます！ Notionに保存しました。",
      })
    } catch (error) {
      console.error(error)
      setErrorMessage("ネットワークを確認して、もう一度お試しください。")
      toast({
        title: "送信できませんでした",
        description: "ネットワークを確認して、もう一度お試しください。",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-6" />
        </div>
        <p className="text-sm font-medium text-card-foreground">お便りを受け付けました！</p>
        <p className="text-sm text-muted-foreground">
          ありがとうございました。気軽にまた送ってください。
        </p>
        <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
          もう1通送る
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="podcast-name" className="text-sm font-medium text-card-foreground">
          お名前（ニックネーム可）<span className="ml-1 text-destructive">*</span>
        </label>
        <Input
          id="podcast-name"
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例：しゅう"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="podcast-message" className="text-sm font-medium text-card-foreground">
          メッセージ<span className="ml-1 text-destructive">*</span>
        </label>
        <Textarea
          id="podcast-message"
          name="message"
          required
          maxLength={2000}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="話してほしいテーマ、感想、質問など気軽にどうぞ。"
        />
      </div>

      <Button type="submit" disabled={submitting || !name.trim() || !message.trim()}>
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            送信中...
          </>
        ) : (
          "送信する"
        )}
      </Button>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      <p className="text-xs leading-relaxed text-muted-foreground">
        送信内容はNotionのデータベースに保存されます。個人情報は返信目的以外では利用しません。
      </p>
    </form>
  )
}
