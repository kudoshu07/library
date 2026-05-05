#!/usr/bin/env node
// One-shot setup check for newsletter env. Safe to run repeatedly: read-only.
// Confirms: env vars present, Supabase reachable, both tables exist, Resend API key valid.

import fs from "node:fs/promises"
import path from "node:path"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const ENV_FILE = path.join(ROOT, ".env.local")

async function loadDotEnv() {
  try {
    const raw = await fs.readFile(ENV_FILE, "utf-8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      // Last write wins (matches dotenv semantics).
      process.env[key] = value
    }
  } catch (error) {
    console.error("[check] could not read .env.local:", error.message)
  }
}

await loadDotEnv()

const checks = []
function pass(name, detail = "") {
  checks.push({ name, status: "ok", detail })
}
function fail(name, detail) {
  checks.push({ name, status: "fail", detail })
}

const SUPABASE_URL = process.env.SUPABASE_URL?.trim()
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim()
const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim()
const NEWSLETTER_FROM_EMAIL = process.env.NEWSLETTER_FROM_EMAIL?.trim()

if (SUPABASE_URL && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL)) {
  pass("SUPABASE_URL", SUPABASE_URL)
} else {
  fail("SUPABASE_URL", `unexpected format: ${SUPABASE_URL ?? "(missing)"}`)
}

if (SUPABASE_SERVICE_ROLE_KEY) {
  const masked = `${SUPABASE_SERVICE_ROLE_KEY.slice(0, 10)}...${SUPABASE_SERVICE_ROLE_KEY.slice(-4)}`
  pass("SUPABASE_SERVICE_ROLE_KEY", masked)
} else {
  fail("SUPABASE_SERVICE_ROLE_KEY", "missing")
}

if (RESEND_API_KEY?.startsWith("re_")) {
  pass("RESEND_API_KEY", `${RESEND_API_KEY.slice(0, 6)}...${RESEND_API_KEY.slice(-4)}`)
} else {
  fail("RESEND_API_KEY", "missing or unexpected prefix")
}

if (NEXT_PUBLIC_SITE_URL) {
  pass("NEXT_PUBLIC_SITE_URL", NEXT_PUBLIC_SITE_URL)
} else {
  fail("NEXT_PUBLIC_SITE_URL", "missing")
}

if (NEWSLETTER_FROM_EMAIL) {
  pass("NEWSLETTER_FROM_EMAIL", NEWSLETTER_FROM_EMAIL)
} else {
  fail("NEWSLETTER_FROM_EMAIL", "missing (will fall back to onboarding@resend.dev)")
}

// Supabase: verify the tables exist by issuing HEAD count queries.
async function checkSupabaseTable(table) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return
  const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?select=id`
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    })
    const range = res.headers.get("content-range") ?? ""
    const total = range.split("/")[1] ?? "?"
    if (res.ok || res.status === 206) {
      pass(`Supabase: ${table}`, `rows=${total}`)
    } else {
      fail(`Supabase: ${table}`, `HTTP ${res.status} ${res.statusText}`)
    }
  } catch (error) {
    fail(`Supabase: ${table}`, error.message)
  }
}

await checkSupabaseTable("subscribers")
await checkSupabaseTable("notifications_log")

// Resend: verify the API key by listing domains (read-only, doesn't send anything).
if (RESEND_API_KEY) {
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    })
    if (res.ok) {
      const json = await res.json()
      const domains = (json.data ?? []).map((d) => `${d.name} (${d.status})`)
      pass(
        "Resend API",
        domains.length > 0
          ? `verified domains: ${domains.join(", ")}`
          : "key valid, no verified domains (sandbox only)"
      )
    } else {
      fail("Resend API", `HTTP ${res.status} ${res.statusText}`)
    }
  } catch (error) {
    fail("Resend API", error.message)
  }
}

let allPass = true
for (const { name, status, detail } of checks) {
  const icon = status === "ok" ? "✓" : "✗"
  if (status !== "ok") allPass = false
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`)
}
process.exit(allPass ? 0 : 1)
