import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/queries";
import { derivePartners } from "@/lib/partners";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { Toaster } from "sileo";
import "sileo/styles.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.couple) redirect("/login"); // authenticated but not paired yet

  const { personA, personB } = derivePartners(ctx);

  return (
    <div className="flex justify-center">
      <div className="app-panel">
        <AppHeader initialA={personA.initial} initialB={personB.initial} />
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-5">{children}</div>
        <BottomNav />
      </div>
      {/* offset clears the AppHeader; tuned against the browser, not by eye. */}
      <Toaster theme="dark" position="top-center" offset={{ top: 72 }} />
    </div>
  );
}
