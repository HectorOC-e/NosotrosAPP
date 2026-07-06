import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/queries";
import { derivePartners } from "@/lib/partners";
import { money } from "@/lib/format";
import { budgetColor } from "@/lib/constants";
import { GastosClient } from "@/components/gastos/gastos-client";

export default async function GastosPage() {
  const supabase = await createClient();
  const ctx = await getSessionContext();
  const { personA, personB, meSlot } = derivePartners(ctx!);

  const { data: budget } = await supabase
    .from("budgets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const expenseRows = budget
    ? (
        await supabase
          .from("expenses")
          .select("*")
          .eq("budget_id", budget.id)
          .order("created_at", { ascending: true })
      ).data ?? []
    : [];

  const nameById = (id: string | null) =>
    id === personA.id ? personA.name : id === personB.id ? personB.name : "Alguien";

  const totalSpent = expenseRows.reduce((s, e) => s + Number(e.amount), 0);
  const limit = budget ? Number(budget.limit_amount) : 0;
  const pct = limit > 0 ? (totalSpent / limit) * 100 : 0;
  const isOver = limit > 0 && totalSpent > limit;

  // Who contributed most (for the warm over-budget context line).
  const byPerson = new Map<string, number>();
  for (const e of expenseRows ?? []) {
    const n = nameById(e.profile_id);
    byPerson.set(n, (byPerson.get(n) ?? 0) + Number(e.amount));
  }
  const topSpender =
    [...byPerson.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? personA.name;

  const expenses = (expenseRows ?? [])
    .slice()
    .reverse()
    .map((e) => ({
      id: e.id,
      desc: e.description,
      quien: nameById(e.profile_id),
      montoLabel: money(Number(e.amount)),
    }));

  return (
    <GastosClient
      outing={budget ? { name: budget.label, limitInput: String(limit) } : null}
      barColor={budgetColor(pct)}
      pctLabel={`${Math.round(pct)}%`}
      pctWidth={`${Math.min(100, pct)}%`}
      spentLabel={money(totalSpent)}
      limitLabel={money(limit)}
      isOver={isOver}
      overByLabel={money(Math.max(0, totalSpent - limit))}
      overMensaje={`la mayoría fue de gastos de ${topSpender}`}
      expenses={expenses}
      people={[
        { id: personA.id, name: personA.name, accent: personA.accent },
        { id: personB.id, name: personB.name, accent: personB.accent },
      ]}
      meId={(meSlot === "A" ? personA.id : personB.id) ?? ""}
    />
  );
}
