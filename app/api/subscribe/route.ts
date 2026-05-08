import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { z } from "zod"
import {
  SUBSCRIBABLE_SOURCES,
  getFromAddress,
  getReplyTo,
  getResendClient,
  getSiteUrl,
  getSupabaseClient,
  isSubscribableSource,
  renderConfirmEmail,
} from "@/lib/newsletter"
import { isDisposableEmail } from "@/lib/disposable-emails"
import { getRemoteIp, verifyTurnstileToken } from "@/lib/turnstile"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const payloadSchema = z.object({
  email: z.string().trim().toLowerCase().email("invalid_email").max(254),
  displayName: z
    .string()
    .trim()
    .min(1, "display_name_required")
    .max(30, "display_name_too_long")
    .refine((v) => !/[\r\n\t]/.test(v), { message: "display_name_invalid" }),
  sources: z
    .array(z.string())
    .min(1, "sources_required")
    .max(SUBSCRIBABLE_SOURCES.length)
    .refine((arr) => arr.every(isSubscribableSource), { message: "invalid_source" }),
  turnstileToken: z.string().optional(),
})

function newToken(): string {
  return randomBytes(24).toString("base64url")
}

export async function POST(req: Request) {
  let parsed: z.infer<typeof payloadSchema>
  try {
    const json = await req.json()
    const result = payloadSchema.safeParse(json)
    if (!result.success) {
      return NextResponse.json(
        { error: "invalid_input", issues: result.error.issues },
        { status: 400 }
      )
    }
    parsed = result.data
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (isDisposableEmail(parsed.email)) {
    return NextResponse.json({ error: "disposable_email" }, { status: 400 })
  }

  const turnstileOk = await verifyTurnstileToken(
    parsed.turnstileToken,
    getRemoteIp(req),
  )
  if (!turnstileOk) {
    return NextResponse.json({ error: "turnstile_failed" }, { status: 400 })
  }

  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 })
  }

  // Deduplicate sources, drop unknown values defensively (already validated above).
  const sources = Array.from(new Set(parsed.sources))

  const { data: existing, error: selectError } = await supabase
    .from("subscribers")
    .select("id, email, confirmed, confirm_token, unsubscribed_at")
    .eq("email", parsed.email)
    .maybeSingle()

  const displayName = parsed.displayName

  if (selectError) {
    console.error("supabase select error", selectError)
    return NextResponse.json({ error: "database_error" }, { status: 500 })
  }

  let confirmToken: string
  let alreadyConfirmed = false

  if (existing) {
    if (existing.confirmed && !existing.unsubscribed_at) {
      // Already an active subscriber — just update the source preferences and display name.
      const { error: updateError } = await supabase
        .from("subscribers")
        .update({ sources, display_name: displayName })
        .eq("id", existing.id)
      if (updateError) {
        console.error("supabase update error", updateError)
        return NextResponse.json({ error: "database_error" }, { status: 500 })
      }
      alreadyConfirmed = true
      confirmToken = existing.confirm_token
    } else {
      // Re-issue a fresh confirm token (so old emailed links no longer work).
      confirmToken = newToken()
      const { error: updateError } = await supabase
        .from("subscribers")
        .update({
          sources,
          display_name: displayName,
          confirm_token: confirmToken,
          confirm_token_issued_at: new Date().toISOString(),
          confirmed: false,
          confirmed_at: null,
          unsubscribed_at: null,
        })
        .eq("id", existing.id)
      if (updateError) {
        console.error("supabase update error", updateError)
        return NextResponse.json({ error: "database_error" }, { status: 500 })
      }
    }
  } else {
    confirmToken = newToken()
    const { error: insertError } = await supabase.from("subscribers").insert({
      email: parsed.email,
      display_name: displayName,
      sources,
      confirm_token: confirmToken,
      confirm_token_issued_at: new Date().toISOString(),
      unsubscribe_token: newToken(),
    })
    if (insertError) {
      console.error("supabase insert error", insertError)
      return NextResponse.json({ error: "database_error" }, { status: 500 })
    }
  }

  if (alreadyConfirmed) {
    return NextResponse.json({ ok: true, status: "updated" })
  }

  let resend
  try {
    resend = getResendClient()
  } catch {
    return NextResponse.json({ error: "resend_not_configured" }, { status: 500 })
  }

  const confirmUrl = `${getSiteUrl()}/api/subscribe/confirm?token=${encodeURIComponent(confirmToken)}`
  const email = renderConfirmEmail({
    email: parsed.email,
    displayName,
    sources,
    confirmUrl,
  })

  const sendResult = await resend.emails.send({
    from: getFromAddress(),
    to: parsed.email,
    replyTo: getReplyTo(),
    subject: email.subject,
    html: email.html,
    text: email.text,
  })

  if (sendResult.error) {
    console.error("resend send error", sendResult.error)
    return NextResponse.json({ error: "email_send_failed" }, { status: 502 })
  }

  return NextResponse.json({ ok: true, status: "confirmation_sent" })
}
