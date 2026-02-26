"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle2 } from "lucide-react"

const sources = [
  { id: "blog", label: "Blog" },
  { id: "note", label: "note(個人)" },
  { id: "ig_business", label: "kudoshu_vcook" },
  { id: "ig_photo", label: "onoshuphoto(写真)" },
]

export function SubscribeForm() {
  const [email, setEmail] = useState("")
  const [selected, setSelected] = useState<string[]>(["blog", "note"])
  const [submitted, setSubmitted] = useState(false)

  const toggleSource = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || selected.length === 0) return
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent/10">
          <CheckCircle2 className="size-6 text-accent" />
        </div>
        <h3 className="text-lg font-semibold text-card-foreground">Thank you!</h3>
        <p className="text-sm text-muted-foreground">
          Weekly digest will be sent to <strong className="text-foreground">{email}</strong>.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSubmitted(false)
            setEmail("")
          }}
        >
          Subscribe another email
        </Button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm md:p-8"
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
          className="h-10"
        />
      </div>

      <fieldset>
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

      <Button type="submit" className="w-full" disabled={!email.trim() || selected.length === 0}>
        Subscribe
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Weekly digest is sent every Monday. Your email address is used only for delivery and will not be shared with third parties.
      </p>
    </form>
  )
}
