import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/queries";
import { derivePartners } from "@/lib/partners";
import { parseDbDate, fmtDateShort, daysUntil } from "@/lib/format";
import {
  CalendarioClient,
  type PendienteView,
} from "@/components/calendario/calendario-client";

export default async function CalendarioPage() {
  const supabase = await createClient();
  const ctx = await getSessionContext();
  const { personA, personB } = derivePartners(ctx!);

  const nameById = (id: string | null) =>
    id === personA.id ? personA.name : id === personB.id ? personB.name : "Alguien";

  const { data } = await supabase.from("events").select("*");

  const items: PendienteView[] = (data ?? [])
    .filter((e) => e.event_date)
    .map((e) => {
      const d = parseDbDate(e.event_date as string);
      return {
        id: e.id,
        text: e.title,
        done: e.done,
        iso: e.event_date as string,
        dateLabel: fmtDateShort(d),
        days: daysUntil(d),
        creador: nameById(e.created_by),
      };
    })
    .sort((a, b) => a.iso.localeCompare(b.iso));

  return <CalendarioClient items={items} />;
}
