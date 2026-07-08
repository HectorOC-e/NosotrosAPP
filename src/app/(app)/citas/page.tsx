import { createClient } from "@/lib/supabase/server";
import { parseDbDate, relLabel } from "@/lib/format";
import {
  CitasClient,
  type IdeaView,
  type PastDate,
} from "@/components/citas/citas-client";

export default async function CitasPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("date_ideas")
    .select("*")
    .order("created_at", { ascending: true });

  const ideas: IdeaView[] = (data ?? []).map((row) => ({
    id: row.id,
    text: row.text,
    tags: [row.cost, ...(row.vibe ? row.vibe.split(",") : [])]
      .map((t) => t?.trim())
      .filter((t): t is string => !!t),
    isFavorite: row.is_favorite,
  }));

  // Past dates = cita-budgets (date_idea_id set), excluding the currently active outing.
  const { data: activeRow } = await supabase
    .from("budgets")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const activeId = activeRow?.id ?? null;

  const { data: citaRows } = await supabase
    .from("budgets")
    .select("id, label, created_at")
    .not("date_idea_id", "is", null)
    .order("created_at", { ascending: false });
  const past = (citaRows ?? []).filter((b) => b.id !== activeId);

  let pastDates: PastDate[] = [];
  if (past.length) {
    const ids = past.map((b) => b.id);
    const { data: exp } = await supabase
      .from("expenses")
      .select("budget_id, amount")
      .in("budget_id", ids);
    const spentBy = new Map<string, number>();
    for (const e of exp ?? [])
      spentBy.set(e.budget_id, (spentBy.get(e.budget_id) ?? 0) + Number(e.amount));
    pastDates = past.map((b) => ({
      id: b.id,
      name: b.label,
      whenLabel: relLabel(parseDbDate(b.created_at.slice(0, 10))),
      spent: spentBy.get(b.id) ?? 0,
    }));
  }

  return <CitasClient ideas={ideas} pastDates={pastDates} />;
}
