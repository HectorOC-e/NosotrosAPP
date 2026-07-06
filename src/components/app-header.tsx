"use client";

import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { NAV_ITEMS } from "@/lib/constants";

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
      <div className="w-6" />
    </div>
  );
}
