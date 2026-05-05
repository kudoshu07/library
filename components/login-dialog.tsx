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
import { LoginForm } from "@/components/login-form"

export function LoginDialog({
  trigger,
  next,
}: {
  trigger: ReactNode
  next?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ログイン</DialogTitle>
          <DialogDescription>
            ニュースレターに登録済みのメールアドレスにログインリンクをお送りします。
          </DialogDescription>
        </DialogHeader>
        <LoginForm next={next} embedded />
      </DialogContent>
    </Dialog>
  )
}
