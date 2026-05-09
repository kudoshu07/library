// Reject text containing scripts that almost never appear in legitimate
// comments on a Japanese blog. Allowed implicitly: Latin, Hiragana, Katakana,
// CJK ideographs, Hangul, digits, punctuation, emoji, whitespace.
//
// The 2026-05-09 spam wave was Armenian-script comments from a throwaway
// fuwamofu.com address — the disposable-domain check missed the provider, so
// this is a defense-in-depth check on the message text itself.

const DISALLOWED_RANGES: Array<[number, number]> = [
  [0x0370, 0x03ff], // Greek and Coptic
  [0x0400, 0x052f], // Cyrillic + Cyrillic Supplement
  [0x0530, 0x058f], // Armenian
  [0x0590, 0x05ff], // Hebrew
  [0x0600, 0x06ff], // Arabic
  [0x0700, 0x074f], // Syriac
  [0x0750, 0x077f], // Arabic Supplement
  [0x0780, 0x07bf], // Thaana
  [0x07c0, 0x07ff], // NKo
  [0x0800, 0x083f], // Samaritan
  [0x0840, 0x085f], // Mandaic
  [0x08a0, 0x08ff], // Arabic Extended-A
  [0x0900, 0x097f], // Devanagari
  [0x0980, 0x09ff], // Bengali
  [0x0a00, 0x0a7f], // Gurmukhi
  [0x0a80, 0x0aff], // Gujarati
  [0x0b00, 0x0b7f], // Oriya
  [0x0b80, 0x0bff], // Tamil
  [0x0c00, 0x0c7f], // Telugu
  [0x0c80, 0x0cff], // Kannada
  [0x0d00, 0x0d7f], // Malayalam
  [0x0d80, 0x0dff], // Sinhala
  [0x0e00, 0x0e7f], // Thai
  [0x0e80, 0x0eff], // Lao
  [0x0f00, 0x0fff], // Tibetan
  [0x1000, 0x109f], // Myanmar
  [0x10a0, 0x10ff], // Georgian
  [0x1200, 0x137f], // Ethiopic
  [0x1780, 0x17ff], // Khmer
  [0x1800, 0x18af], // Mongolian
  [0x1f00, 0x1fff], // Greek Extended
  [0xfb1d, 0xfdff], // Hebrew + Arabic presentation forms A
  [0xfe70, 0xfeff], // Arabic presentation forms B
]

export function containsDisallowedScript(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    for (const [lo, hi] of DISALLOWED_RANGES) {
      if (code >= lo && code <= hi) return true
      if (code < lo) break // ranges are sorted; can short-circuit
    }
  }
  return false
}
