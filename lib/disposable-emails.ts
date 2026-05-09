import "server-only"

import { getSupabaseClient } from "@/lib/newsletter"

// Known disposable / throwaway email domains.
// Used by the subscribe API to reject obvious bot signups (the original
// offender used `@sute.jp`). Privacy-focused alias services (Apple Hide My
// Email, SimpleLogin, DuckDuckGo, Proton) are intentionally NOT on this list —
// those addresses are stable and used by real readers.
//
// Runtime additions made via the Slack "ブロックリスト追加" button are stored
// in the public.blocked_email_domains table and merged in via isEmailBlocked.
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  // JP
  "sute.jp",
  "kerox.jp",
  "tafmail.com",
  "fuwamofu.com",
  // Common global disposable services
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.info",
  "guerrillamail.de",
  "sharklasers.com",
  "grr.la",
  "tempmail.com",
  "tempmail.net",
  "temp-mail.org",
  "temp-mail.io",
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.net",
  "dispostable.com",
  "fakeinbox.com",
  "getnada.com",
  "mintemail.com",
  "mohmal.com",
  "maildrop.cc",
  "spamgourmet.com",
  "mailnesia.com",
  "spambog.com",
  "spambox.us",
  "spam4.me",
  "mailcatch.com",
  "mailnull.com",
  "emailondeck.com",
  "moakt.com",
  "fakemailgenerator.com",
  "mvrht.net",
  "byom.de",
  "mt2015.com",
  "mt2014.com",
  "hidingmail.net",
  "gcervera.com",
])

function getDomain(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 0) return null
  const domain = email.slice(at + 1).toLowerCase().trim()
  return domain || null
}

export function isDisposableEmail(email: string): boolean {
  const domain = getDomain(email)
  if (!domain) return false
  return DISPOSABLE_DOMAINS.has(domain)
}

export async function isEmailBlocked(email: string): Promise<boolean> {
  if (isDisposableEmail(email)) return true
  const domain = getDomain(email)
  if (!domain) return false
  let supabase
  try {
    supabase = getSupabaseClient()
  } catch {
    return false
  }
  const { data, error } = await supabase
    .from("blocked_email_domains")
    .select("domain")
    .eq("domain", domain)
    .maybeSingle()
  if (error) {
    console.error("isEmailBlocked: supabase error", error)
    return false
  }
  return data != null
}
