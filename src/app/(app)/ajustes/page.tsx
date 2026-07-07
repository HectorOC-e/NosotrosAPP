import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/queries";
import { derivePartners } from "@/lib/partners";
import { AI_MODELS } from "@/lib/constants";
import { fetchOpenRouterModels } from "@/lib/ai/openrouter";
import { AjustesClient } from "@/components/ajustes/ajustes-client";

export default async function AjustesPage() {
  const ctx = await getSessionContext();
  const isCreador = ctx?.profile?.partner_role === "creador";

  if (!isCreador) {
    const { personA } = derivePartners(ctx!); // A = creador
    return (
      <div className="glass rounded-[22px] px-5 py-[18px]">
        <div className="eyebrow mb-2.5">MEDIADOR IA</div>
        <p className="text-[13.5px] leading-[1.5] text-ink-secondary">
          Solo {personA.name} puede configurar el mediador ✨. Pídeselo cuando
          quieran activarlo juntos.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_settings")
    .select("model, api_key_secret_id")
    .maybeSingle();

  // Autocomplete options: live OpenRouter models, or the curated list as fallback.
  const fetched = await fetchOpenRouterModels();
  const models = fetched.length ? fetched : AI_MODELS.map((m) => m.slug);

  return (
    <AjustesClient
      initialModel={data?.model ?? ""}
      hasKey={!!data?.api_key_secret_id}
      models={models}
    />
  );
}
