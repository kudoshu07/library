import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { getSupabaseClient } from "@/lib/newsletter"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const schema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "display_name_required")
      .max(30, "display_name_too_long")
      .refine((v) => !/[\r\n\t]/.test(v), { message: "display_name_invalid" })
      .optional(),
    notifyOnReply: z.boolean().optional(),
  })
  .refine(
    (v) => v.displayName !== undefined || v.notifyOnReply !== undefined,
    { message: "no_changes" },
  )

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

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

  const update: Record<string, unknown> = {}
  if (body.displayName !== undefined) update.display_name = body.displayName
  if (body.notifyOnReply !== undefined) update.notify_on_reply = body.notifyOnReply

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 })
  }

  const { error } = await supabase
    .from("subscribers")
    .update(update)
    .eq("id", session.subscriberId)

  if (error) {
    console.error("supabase update error", error)
    return NextResponse.json({ error: "database_error" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
