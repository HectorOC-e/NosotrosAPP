import { createClient } from "@/lib/supabase/server";
import { CitasClient, type IdeaView } from "@/components/citas/citas-client";

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

  return <CitasClient ideas={ideas} />;
}
