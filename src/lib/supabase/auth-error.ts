import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";

/**
 * True when the error means "there is no valid session" — the user must log in.
 * False when it means "we could not ask": network down, DNS failure, Supabase 5xx.
 *
 * Callers must never treat the second case as a logged-out user. That is exactly
 * how a transient blip turns into an apparent forced logout.
 *
 * A 4xx from the auth API means the token is missing, malformed, expired or
 * rejected. Anything else — including AuthRetryableFetchError, which carries
 * status 0 — means the question never got answered. 429 and 408 are the
 * exception within the 4xx range: they mean "we refuse to answer right now",
 * not "your session is invalid".
 */
export function sessionIsMissing(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  if (isAuthApiError(error) && typeof error.status === "number") {
    // 429 and 408 mean "we refuse to answer right now" — that is "we could not
    // ask", not "your session is invalid". Treating them as a missing session
    // would log out a user whose token is perfectly good.
    if (error.status === 429 || error.status === 408) return false;
    return error.status >= 400 && error.status < 500;
  }
  return false;
}
