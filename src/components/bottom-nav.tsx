"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-shrink-0 border-t border-white/[0.07] px-1.5 py-2 backdrop-blur-[20px]"
      style={{
        background: "rgba(18,15,23,0.85)",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
      }}
    >
      {NAV_ITEMS.map((n) => {
        const active = pathname.startsWith(n.href);
        return (
          <Link
            key={n.key}
            href={n.href}
            className="flex min-h-[48px] flex-1 flex-col items-center gap-1 px-0.5 py-2 focus-visible:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violeta"
            style={{ color: active ? "#FF6F91" : "#A79FBD" }}
          >
            <span className="text-[19px] leading-none">{n.icon}</span>
            <span className="text-[10.5px] font-semibold">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
