import "server-only";
import type { SupabaseServerClient } from "@/lib/supabase/types";

/** Human duration like "~2 años" / "~8 meses" since an ISO date. */
function relativeDuration(sinceIso: string): string {
  const since = new Date(`${sinceIso}T00:00:00`);
  const months = Math.max(
    0,
    Math.round((Date.now() - since.getTime()) / (30.44 * 86_400_000)),
  );
  if (months < 1) return "menos de un mes";
  if (months < 12) return `~${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `~${years} ${years === 1 ? "año" : "años"}`;
}

/**
 * Builds a Spanish context block about the couple for AI prompts. Reads shared
 * couple fields + both partners' "about". Returns "" when there is no context.
 */
export async function buildCoupleContext(
  supabase: SupabaseServerClient,
  coupleId: string,
): Promise<string> {
  const [{ data: couple }, { data: profiles }] = await Promise.all([
    supabase
      .from("couples")
      .select("location, typical_budget, together_since, has_kids")
      .eq("id", coupleId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, about")
      .eq("couple_id", coupleId),
  ]);

  const lines: string[] = [];
  if (couple?.location?.trim())
    lines.push(
      `- Ubicación: ${couple.location.trim()}. Sugiere planes cercanos y realistas para esa zona.`,
    );
  if (couple?.typical_budget != null)
    lines.push(`- Presupuesto típico de salida: L ${Number(couple.typical_budget)}.`);
  if (couple?.together_since)
    lines.push(`- Llevan juntos: ${relativeDuration(couple.together_since)}.`);
  if (couple?.has_kids) lines.push("- Tienen hijos.");
  for (const p of profiles ?? []) {
    if (p.about?.trim()) lines.push(`- ${p.display_name}: ${p.about.trim()}`);
  }

  if (!lines.length) return "";
  return `Contexto de la pareja (tenlo muy en cuenta al sugerir):\n${lines.join("\n")}`;
}
