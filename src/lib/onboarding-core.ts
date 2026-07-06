import "server-only";
import { cookies } from "next/headers";
import { createCouple, joinCouple } from "@/lib/couple-service";
import { SEED_IDEAS } from "@/lib/constants";
import type { SupabaseServerClient as DB } from "@/lib/supabase/types";

/** Cookie that carries onboarding intent across the email-confirmation round-trip. */
export const INTENT_COOKIE = "nosotros_onboarding";

export type Intent =
  | { kind: "create"; nombre: string }
  | { kind: "join"; nombre: string; code: string };

export type CompleteResult =
  | { status: "done"; role: "creador" | "invitado" }
  | { status: "error"; error: string };

export async function setIntent(intent: Intent) {
  const store = await cookies();
  store.set(INTENT_COOKIE, JSON.stringify(intent), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60, // 1h to confirm
  });
}

/** Runs the actual couple create/join once a session exists. */
export async function complete(
  supabase: DB,
  userId: string,
  intent: Intent,
): Promise<CompleteResult> {
  try {
    if (intent.kind === "create") {
      const { coupleId } = await createCouple(supabase, userId, {
        displayName: intent.nombre,
      });
      await seedIdeas(supabase, coupleId, userId);
      return { status: "done", role: "creador" };
    }
    await joinCouple(supabase, userId, {
      code: intent.code,
      displayName: intent.nombre,
    });
    return { status: "done", role: "invitado" };
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? "";
    if (msg.includes("Código inválido"))
      return {
        status: "error",
        error:
          "Mmm, ese código no existe. ¿Seguro que está bien escrito? Pídeselo de nuevo a tu pareja.",
      };
    if (msg.includes("Ya perteneces"))
      return { status: "error", error: "Ya perteneces a un espacio. Entra directamente." };
    console.error("onboarding complete failed", e);
    return { status: "error", error: "No pudimos completar el proceso. Inténtalo de nuevo." };
  }
}

/**
 * Completes onboarding from a just-confirmed session (called by /auth/confirm).
 * Reads and clears the stashed intent. Returns the resulting role, or null.
 */
export async function completePendingOnboarding(
  supabase: DB,
  userId: string,
): Promise<"creador" | "invitado" | null> {
  const store = await cookies();
  const raw = store.get(INTENT_COOKIE)?.value;
  if (!raw) return null;
  store.delete(INTENT_COOKIE);

  let intent: Intent;
  try {
    intent = JSON.parse(raw);
  } catch {
    return null;
  }

  const res = await complete(supabase, userId, intent);
  return res.status === "done" ? res.role : null;
}

/** Seeds the 8 generic starter date ideas for a freshly created couple. */
async function seedIdeas(supabase: DB, coupleId: string, userId: string) {
  const rows = SEED_IDEAS.map((idea) => ({
    couple_id: coupleId,
    created_by: userId,
    text: idea.text,
    cost: idea.cost,
    vibe: idea.vibes.join(",") || null,
    is_favorite: !!idea.favorite,
  }));
  const { error } = await supabase.from("date_ideas").insert(rows);
  if (error) console.error("seedIdeas failed", error);
}
