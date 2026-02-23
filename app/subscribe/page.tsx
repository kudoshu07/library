import type { Metadata } from "next"
import { SubscribeForm } from "@/components/subscribe-form"

export const metadata: Metadata = {
  title: "Subscribe",
  description: "Weekly digest を購読して、最新コンテンツを受け取りましょう。",
}

export default function SubscribePage() {
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
