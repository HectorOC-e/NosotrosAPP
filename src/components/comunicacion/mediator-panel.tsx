"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { sendMediatorMessage, generateWeeklyReflection } from "@/lib/actions/ai";

export type MediatorMessage = {
  id: string;
  role: "user" | "assistant";
  kind: "chat" | "summary";
  content: string;
};

export function MediatorPanel({
  messages,
  hasAiKey,
  isCreador,
  partnerName,
}: {
  messages: MediatorMessage[];
  hasAiKey: boolean;
  isCreador: boolean;
  partnerName: string;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const warm = (reason?: string) =>
    reason === "sin-key"
      ? "El mediador aún no está activo."
      : "El mediador no pudo responder ahora, intenten de nuevo.";

  function onSend() {
    const t = text.trim();
    if (!t || pending) return;
    setError(null);
    setText("");
    startTransition(async () => {
      const res = await sendMediatorMessage(t);
      if (!res.ok) setError(warm(res.reason));
    });
  }

  function onReflect() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await generateWeeklyReflection();
      if (!res.ok) setError(warm(res.reason));
    });
  }

  if (!hasAiKey) {
    return (
      <div className="rounded-[22px] border border-violeta/25 bg-violeta/[0.07] p-5">
        <div className="mb-3.5 flex items-center gap-2">
          <span className="text-[18px]">✨</span>
          <span className="font-serif text-[16px] italic text-ink">Mediador IA</span>
        </div>
        {isCreador ? (
          <p className="text-[13.5px] leading-[1.5] text-ink-secondary">
            Activa el mediador en{" "}
            <Link href="/ajustes" className="text-violeta underline">
              Ajustes
            </Link>{" "}
            para empezar a conversar con él.
          </p>
        ) : (
          <p className="text-[13.5px] leading-[1.5] text-ink-secondary">
            Pídele a {partnerName} que active el mediador en Ajustes ✨
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-violeta/25 bg-violeta/[0.07] p-5">
      <div className="mb-3.5 flex items-center gap-2">
        <span className="text-[18px]">✨</span>
        <span className="font-serif text-[16px] italic text-ink">Mediador IA</span>
        <button
          onClick={onReflect}
          disabled={pending}
          className="ml-auto rounded-full bg-violeta/20 px-2.5 py-1 text-[10.5px] tracking-[0.03em] text-violeta disabled:opacity-60"
        >
          Reflexión de la semana ✨
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="text-[12.5px] text-ink-tertiary">
            Escríbanle al mediador para empezar.
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div
              key={m.id}
              className="max-w-[80%] self-end rounded-[14px_14px_4px_14px] bg-rosa/15 px-3.5 py-2.5 text-[13px] text-ink"
            >
              {m.content}
            </div>
          ) : (
            <div
              key={m.id}
              className={
                "max-w-[85%] self-start rounded-[14px_14px_14px_4px] px-3.5 py-2.5 text-[13px] text-ink " +
                (m.kind === "summary" ? "bg-violeta/15" : "bg-white/[0.08]")
              }
            >
              {m.kind === "summary" && (
                <div className="mb-1 text-[10.5px] tracking-[0.03em] text-violeta">
                  REFLEXIÓN
                </div>
              )}
              {m.content}
            </div>
          ),
        )}
        {pending && (
          <div className="max-w-[80%] self-start rounded-[14px] bg-white/[0.06] px-3.5 py-2.5 text-[13px] text-ink-tertiary">
            pensando…
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="field flex-1"
          placeholder="Escríbele al mediador…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) onSend();
          }}
          disabled={pending}
        />
        <button
          onClick={onSend}
          disabled={pending || !text.trim()}
          className="btn-primary px-4 disabled:opacity-60"
        >
          Enviar
        </button>
      </div>

      {error && (
        <div className="mt-2 text-[12.5px]" style={{ color: "#FF6B6B" }}>
          {error}
        </div>
      )}
    </div>
  );
}
