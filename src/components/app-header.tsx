"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { NAV_ITEMS } from "@/lib/constants";
import { signOut } from "@/lib/actions/onboarding";

export function AppHeader({
  initialA,
  initialB,
}: {
  initialA: string;
  initialB: string;
}) {
  const pathname = usePathname();
  const active = NAV_ITEMS.find((n) => pathname.startsWith(n.href));
  const title = active?.title ?? "Nosotros";

  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.06] px-5 pb-3.5 pt-[18px]">
      <BrandMark initialA={initialA} initialB={initialB} size={24} />
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      <div className="-mr-1.5 flex items-center">
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          title="Ajustes"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition hover:bg-white/[0.06] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-violeta"
        >
          <Settings size={18} strokeWidth={2} aria-hidden />
        </Link>
        <form action={signOut} className="flex">
          <button
            type="submit"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition hover:bg-white/[0.06] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-violeta"
          >
            <LogOut size={18} strokeWidth={2} aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}
