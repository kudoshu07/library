// Known disposable / throwaway email domains.
// Used by the subscribe API to reject obvious bot signups (the existing offender
// used `@sute.jp`). Privacy-focused alias services (Apple Hide My Email,
// SimpleLogin, DuckDuckGo, Proton) are intentionally NOT on this list — those
// addresses are stable and used by real readers.
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  // JP
  "sute.jp",
  "kerox.jp",
  "tafmail.com",
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

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf("@")
  if (at < 0) return false
  const domain = email.slice(at + 1).toLowerCase().trim()
  if (!domain) return false
  return DISPOSABLE_DOMAINS.has(domain)
}
