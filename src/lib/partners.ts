import { initialOf } from "@/lib/format";
import type { SessionContext } from "@/lib/queries";

export type PersonSlot = {
  id: string | null;
  name: string;
  initial: string;
  role: "creador" | "invitado";
  /** Accent hex for this partner (rosa for creador, violeta for invitado). */
  accent: string;
};

export type Partners = {
  /** Person A — the couple's creador (pink slot). */
  personA: PersonSlot;
  /** Person B — the invitado (violet slot); a placeholder until they join. */
  personB: PersonSlot;
  /** Which slot ("A" | "B") is the signed-in user. */
  meSlot: "A" | "B";
};

/**
 * Orders the two partners into their fixed design slots by role, independent of
 * who is currently signed in.
 */
export function derivePartners(ctx: SessionContext): Partners {
  const all = [ctx.profile, ctx.partner].filter(
    (p): p is NonNullable<typeof p> => p != null,
  );
  const creador = all.find((p) => p.partner_role === "creador") ?? null;
  const invitado = all.find((p) => p.partner_role === "invitado") ?? null;

  const personA: PersonSlot = {
    id: creador?.id ?? null,
    name: creador?.display_name ?? "Tu pareja",
    initial: initialOf(creador?.display_name),
    role: "creador",
    accent: "#FF6F91",
  };
  const personB: PersonSlot = {
    id: invitado?.id ?? null,
    name: invitado?.display_name ?? "Tu pareja",
    initial: initialOf(invitado?.display_name),
    role: "invitado",
    accent: "#8B7CFF",
  };

  const meSlot: "A" | "B" = ctx.userId === personA.id ? "A" : "B";
  return { personA, personB, meSlot };
}
