import { redirect } from "next/navigation";
import { AuthFlow } from "@/components/auth/auth-flow";
import { getSessionContext } from "@/lib/queries";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already onboarded → straight into the app.
  const ctx = await getSessionContext();
  if (ctx?.couple) redirect("/inicio");

  const { error } = await searchParams;

  return (
    <div className="flex justify-center">
      <div className="app-panel">
        <AuthFlow linkError={error === "enlace" || error === "sesion"} />
      </div>
    </div>
  );
}
