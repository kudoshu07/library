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

export function SubscribeDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ニュースレター登録</DialogTitle>
          <DialogDescription>
            新しいコンテンツが追加されたタイミングで、メールでお知らせします。
          </DialogDescription>
        </DialogHeader>
        <SubscribeForm embedded />
      </DialogContent>
    </Dialog>
  )
}
