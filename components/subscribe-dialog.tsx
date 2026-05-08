"use client"

import { useState, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SubscribeForm } from "@/components/subscribe-form"
import { useSubscriberCount } from "@/hooks/use-subscriber-count"

export function SubscribeDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const subscriberCount = useSubscriberCount()
  const title =
    subscriberCount !== null
      ? `${subscriberCount + 1}人目のニュースレター登録`
      : "ニュースレター登録"
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            新しいコンテンツが追加されたタイミングで、メールでお知らせします。
          </DialogDescription>
        </DialogHeader>
        <SubscribeForm embedded />
      </DialogContent>
    </Dialog>
  )
}
