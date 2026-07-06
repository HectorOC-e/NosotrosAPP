"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

type Props =
  | { role: "creador"; inviteCode: string; initialA: string; initialB: string }
  | { role: "invitado"; initialA: string; initialB: string };

export function WelcomeSuccess(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function enterApp() {
    startTransition(() => {
      router.push("/inicio");
      router.refresh();
    });
  }

  function copyCode() {
    if (props.role !== "creador") return;
    try {
      navigator.clipboard?.writeText(props.inviteCode);
    } catch {
      /* clipboard may be unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (props.role === "creador") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-[22px] px-[22px] py-5 text-center">
        <span className="text-4xl">🎉</span>
        <h2 className="font-serif text-[26px] font-medium italic text-ink">
          ¡Su espacio está listo!
        </h2>
        <p className="m-0 max-w-[280px] text-[14.5px] leading-[1.5] text-ink-secondary">
          Comparte este código con tu pareja para que se una a &quot;Nosotros&quot;.
        </p>
        <div className="w-full rounded-[22px] border border-rosa/35 bg-rosa/10 p-[22px]">
          <div className="tnum text-[30px] font-bold tracking-[0.08em] text-rosa">
            {props.inviteCode}
          </div>
        </div>
        <Button variant="ghost" onClick={copyCode} className="w-full py-3.5 text-[14.5px]">
          {copied ? "¡Copiado! ✓" : "Copiar código"}
        </Button>
        <Button onClick={enterApp} disabled={pending} className="w-full py-4">
          Entrar a Nosotros
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[22px] px-[22px] py-5 text-center">
      <BrandMark
        initialA={props.initialA}
        initialB={props.initialB}
        size={52}
        line="solid"
      />
      <h2 className="font-serif text-[26px] font-medium italic text-ink">
        ¡Listo, ya son un espacio!
      </h2>
      <p className="m-0 max-w-[280px] text-[14.5px] leading-[1.5] text-ink-secondary">
        Desde ahora todo lo que agreguen aquí lo verán los dos.
      </p>
      <Button onClick={enterApp} disabled={pending} className="w-full py-4">
        Entrar a Nosotros
      </Button>
    </div>
  );
}
