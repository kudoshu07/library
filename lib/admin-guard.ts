import "server-only"

import { getSession, type Session } from "@/lib/auth"

/**
 * Returns the current session only if the caller is the owner
 * (matches OWNER_EMAIL). Returns null otherwise — callers should treat that
 * as "not found" rather than "forbidden" so admin routes don't reveal their
 * existence to logged-out or non-owner visitors.
 */
export async function getOwnerSession(): Promise<Session | null> {
  const session = await getSession()
  if (!session) return null
  if (!session.isOwner) return null
  if (session.banned) return null
  return session
}

export type OwnerGuardResult =
  | { ok: true; session: Session }
  | { ok: false; status: 404 | 401 }

/**
 * For API routes. Use the returned status to respond. We use 404 instead of
 * 403 for non-owners — matching the page guard, which calls notFound().
 */
export async function requireOwner(): Promise<OwnerGuardResult> {
  const session = await getSession()
  if (!session) return { ok: false, status: 401 }
  if (!session.isOwner || session.banned) return { ok: false, status: 404 }
  return { ok: true, session }
}
