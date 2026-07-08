/**
 * What every mutation Server Action returns. Actions never throw for expected
 * failures: a thrown error is redacted in production ("An error occurred in the
 * Server Components render"), so the client could never tell the user what went
 * wrong. `message` is warm, specific, user-facing Spanish.
 *
 * This module is deliberately NOT "use server": in such a file every export
 * becomes a client-invocable Server Action, and these are plain helpers.
 */
export type ActionResult = { ok: true } | { ok: false; message: string };

export const ok = (): ActionResult => ({ ok: true });
export const fail = (message: string): ActionResult => ({ ok: false, message });
