import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/queries";
import { derivePartners } from "@/lib/partners";
import { toInputDate } from "@/lib/format";
import { ComunicacionClient } from "@/components/comunicacion/comunicacion-client";

export default async function ComunicacionPage() {
  const supabase = await createClient();
  const ctx = await getSessionContext();
  const { personA, personB, meSlot } = derivePartners(ctx!);

  const today = toInputDate(new Date());
  const { data: moods } = await supabase
    .from("moods")
    .select("profile_id, mood_emoji")
    .eq("mood_date", today);

  const emojiFor = (id: string | null) =>
    moods?.find((m) => m.profile_id === id)?.mood_emoji ?? null;

  const rows = [
    {
      name: personA.name,
      accent: personA.accent,
      emoji: emojiFor(personA.id),
      isMe: meSlot === "A",
    },
    {
      name: personB.name,
      accent: personB.accent,
      emoji: emojiFor(personB.id),
      isMe: meSlot === "B",
    },
  ];

  return <ComunicacionClient rows={rows} />;
}
