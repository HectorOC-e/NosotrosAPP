import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

  const { data: recentMessages } = await supabase
    .from("ai_messages")
    .select("id, role, kind, content")
    .order("created_at", { ascending: false })
    .limit(50);
  const messages = (recentMessages ?? []).reverse();

  // Readiness is visible to BOTH partners; ai_settings SELECT is creator-only,
  // so check with the service role (server-side; only a boolean leaves this scope).
  // Degrade gracefully if the service-role key isn't configured (e.g. env var not
  // yet set in a given environment): show the mediator gate instead of erroring.
  let hasAiKey = false;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const service = createServiceClient();
      const { data: cfg } = await service
        .from("ai_settings")
        .select("api_key_secret_id")
        .eq("couple_id", ctx!.couple!.id)
        .maybeSingle();
      hasAiKey = !!cfg?.api_key_secret_id;
    } catch {
      hasAiKey = false;
    }
  }

  const emojiFor = (id: string | null) =>
    moods?.find((m) => m.profile_id === id)?.mood_emoji ?? null;

  const rows = [
    { name: personA.name, accent: personA.accent, emoji: emojiFor(personA.id), isMe: meSlot === "A" },
    { name: personB.name, accent: personB.accent, emoji: emojiFor(personB.id), isMe: meSlot === "B" },
  ];

  const isCreador = ctx!.profile?.partner_role === "creador";
  const partnerName = personA.name; // A = creador; invitee is told to ask the creator

  return (
    <ComunicacionClient
      rows={rows}
      messages={messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        kind: m.kind as "chat" | "summary",
        content: m.content,
      }))}
      hasAiKey={hasAiKey}
      isCreador={isCreador}
      partnerName={partnerName}
    />
  );
}
