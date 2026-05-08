import "server-only"

// Cloudflare Turnstile server-side verification.
//
// If TURNSTILE_SECRET_KEY is not configured, verification is skipped and any
// token (including missing) is accepted. This lets the code ship before the
// keys are provisioned; once both NEXT_PUBLIC_TURNSTILE_SITE_KEY and
// TURNSTILE_SECRET_KEY are set, verification kicks in automatically.

const VERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export function isTurnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY?.trim()
}

type SiteVerifyResponse = {
  success: boolean
  "error-codes"?: string[]
  hostname?: string
  challenge_ts?: string
  action?: string
  cdata?: string
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return true
  if (!token || typeof token !== "string") return false

  const form = new URLSearchParams()
  form.set("secret", secret)
  form.set("response", token)
  if (remoteIp) form.set("remoteip", remoteIp)

  try {
    const res = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    })
    if (!res.ok) {
      console.error("turnstile verify HTTP error", res.status)
      return false
    }
    const data = (await res.json()) as SiteVerifyResponse
    if (!data.success) {
      console.warn("turnstile verify failed", data["error-codes"])
    }
    return !!data.success
  } catch (err) {
    console.error("turnstile verify error", err)
    return false
  }
}

export function getRemoteIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0]?.trim() ?? null
  return req.headers.get("x-real-ip")
}
