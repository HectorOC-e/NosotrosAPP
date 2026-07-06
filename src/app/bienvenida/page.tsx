import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/queries";
import { derivePartners } from "@/lib/partners";
import { WelcomeSuccess } from "@/components/auth/welcome-success";

export default async function BienvenidaPage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.couple) redirect("/login");

  const { personA, personB } = derivePartners(ctx);
  const role = ctx.profile?.partner_role === "creador" ? "creador" : "invitado";

  return (
    <div className="flex justify-center">
      <div className="app-panel">
        {role === "creador" ? (
          <WelcomeSuccess
            role="creador"
            inviteCode={ctx.couple.invite_code}
            initialA={personA.initial}
            initialB={personB.initial}
          />
        ) : (
          <WelcomeSuccess
            role="invitado"
            initialA={personA.initial}
            initialB={personB.initial}
          />
        )}
      </div>
    </div>
  );
}
