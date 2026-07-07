import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/queries";
import { derivePartners } from "@/lib/partners";
import { AI_MODELS } from "@/lib/constants";
import { fetchOpenRouterModels } from "@/lib/ai/openrouter";
import { AjustesClient } from "@/components/ajustes/ajustes-client";
import { AboutUsForm } from "@/components/ajustes/about-us-form";

export default async function AjustesPage() {
  const ctx = await getSessionContext();
  const { personA } = derivePartners(ctx!); // A = creador
  const isCreador = ctx?.profile?.partner_role === "creador";

  const couple = ctx?.couple;
  const myAbout = ctx?.profile?.about ?? "";
  const partner = ctx?.partner;

  const aboutForm = (
    <AboutUsForm
      initialLocation={couple?.location ?? ""}
      initialBudget={couple?.typical_budget != null ? String(couple.typical_budget) : ""}
      initialTogetherSince={couple?.together_since ?? ""}
      initialHasKids={!!couple?.has_kids}
      initialAbout={myAbout}
      partnerName={partner?.display_name ?? "tu pareja"}
      partnerAbout={partner?.about ?? ""}
    />
  );

  if (!isCreador) {
    return (
      <>
        {aboutForm}
        <div className="glass rounded-[22px] px-5 py-[18px]">
          <div className="eyebrow mb-2.5">MEDIADOR IA</div>
          <p className="text-[13.5px] leading-[1.5] text-ink-secondary">
            Solo {personA.name} puede configurar el mediador ✨.
          </p>
        </div>
      </>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_settings")
    .select("model, api_key_secret_id")
    .maybeSingle();
  const fetched = await fetchOpenRouterModels();
  const models = fetched.length ? fetched : AI_MODELS.map((m) => m.slug);

  return (
    <>
      {aboutForm}
      <AjustesClient
        initialModel={data?.model ?? ""}
        hasKey={!!data?.api_key_secret_id}
        models={models}
      />
    </>
  );
}
