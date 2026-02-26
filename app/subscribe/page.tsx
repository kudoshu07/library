import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SubscribeForm } from "@/components/subscribe-form"
import { ENABLE_SUBSCRIBE_UI } from "@/lib/feature-flags"

export const metadata: Metadata = {
  title: "Subscribe",
  description: "Weekly digest を購読して、最新コンテンツを受け取りましょう。",
}

export default function SubscribePage() {
  if (!ENABLE_SUBSCRIBE_UI) {
    redirect("/home")
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 lg:px-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl text-balance">
          Subscribe
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-pretty">
          Get a weekly digest. Choose the sources you want.
        </p>
      </div>
      <SubscribeForm />
    </div>
  )
}
