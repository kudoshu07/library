import { NextResponse } from "next/server"
import { z } from "zod"
import { requestLogin } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z.object({
  email: z.string().trim().toLowerCase().email("invalid_email").max(254),
  next: z.string().optional(),
})

export async function POST(req: Request) {
  let body: z.infer<typeof schema>
  try {
    const json = await req.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "invalid_input" },
        { status: 400 },
      )
    }
    body = parsed.data
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const result = await requestLogin(body.email, body.next)
  switch (result.kind) {
    case "sent":
      return NextResponse.json({ ok: true })
    case "not_subscribed":
      return NextResponse.json({ error: "not_subscribed" }, { status: 404 })
    case "not_confirmed":
      return NextResponse.json({ error: "not_confirmed" }, { status: 403 })
    case "rate_limited":
      return NextResponse.json({ error: "rate_limited" }, { status: 429 })
    case "error":
      return NextResponse.json({ error: result.message }, { status: 500 })
  }
}
