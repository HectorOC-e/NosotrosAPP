"use client";

import { useState, useTransition } from "react";
import { EMOJIS, TOPICS } from "@/lib/constants";
import { hexToRgba } from "@/lib/utils";
import { setMood } from "@/lib/actions/comunicacion";

type Row = {
  name: string;
  accent: string;
  emoji: string | null;
  isMe: boolean;
};

export function ComunicacionClient({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div>
      {/* Check-in */}
      <div className="glass mb-[18px] rounded-[22px] px-5 py-[18px]">
        <div className="eyebrow mb-3.5">CHECK-IN DE HOY</div>
        <div className="flex flex-col gap-3.5">
          {rows.map((row) => (
            <div key={row.name + (row.isMe ? "-me" : "")}>
              <div className="mb-2 text-[13px] text-ink">
                {row.name}
                {row.isMe && (
                  <span className="ml-1.5 text-[11px] text-ink-tertiary">(tú)</span>
                )}
              </div>
              <div className="flex gap-1.5">
                {EMOJIS.map((em) => {
                  const active = row.emoji === em;
                  return (
                    <button
                      key={em}
                      disabled={!row.isMe || pending}
                      onClick={() =>
                        row.isMe && startTransition(() => setMood(em))
                      }
                      className="flex-1 rounded-[14px] border py-2.5 text-[22px] transition disabled:cursor-default"
                      style={{
                        background: active
                          ? hexToRgba(row.accent, 0.18)
                          : "rgba(255,255,255,0.03)",
                        borderColor: active
                          ? hexToRgba(row.accent, 0.5)
                          : "rgba(255,255,255,0.1)",
                        opacity: !row.isMe && !active ? 0.6 : 1,
                      }}
                    >
                      {em}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversation topics */}
      <div className="eyebrow mb-2.5">PARA CONVERSAR CON SUAVIDAD</div>
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        {TOPICS.map((t) => {
          const open = !!revealed[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setRevealed((r) => ({ ...r, [t.id]: !r[t.id] }))}
              className="glass-subtle flex flex-col gap-2 rounded-[18px] p-[15px] text-left transition hover:bg-white/[0.07]"
            >
              <span className="text-[13.5px] font-semibold text-ink">{t.title}</span>
              {open ? (
                <span className="font-serif text-[14px] italic leading-[1.4] text-ink-secondary">
                  {t.question}
                </span>
              ) : (
                <span className="text-[12px] text-ink-tertiary">
                  Toca para ver la pregunta
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* AI mediator teaser (visual only) */}
      <div className="relative overflow-hidden rounded-[22px] border border-violeta/25 bg-violeta/[0.07] p-5">
        <div className="mb-3.5 flex items-center gap-2">
          <span className="text-[18px]">✨</span>
          <span className="font-serif text-[16px] italic text-ink">Mediador IA</span>
          <span className="ml-auto rounded-full bg-violeta/20 px-2.5 py-1 text-[10.5px] tracking-[0.03em] text-violeta">
            PRÓXIMAMENTE
          </span>
        </div>
        <div className="mb-4 flex flex-col gap-2 opacity-[0.55]">
          <div className="max-w-[80%] self-start rounded-[14px_14px_14px_4px] bg-white/[0.08] px-3.5 py-2.5 text-[13px] text-ink">
            Esta semana ambos mencionaron el tema de las finanzas — ¿lo hablamos
            con calma?
          </div>
          <div className="max-w-[80%] self-end rounded-[14px_14px_4px_14px] bg-rosa/15 px-3.5 py-2.5 text-[13px] text-ink">
            Sí, buena idea 💛
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-[12.5px] text-ink-secondary">
          <span>· Sugiere frases en el momento justo</span>
          <span>· Resume los patrones de su semana</span>
          <span>· Eventualmente, conversa con ustedes en tiempo real</span>
        </div>
        <div className="mt-3.5 text-center text-[12px] text-ink-tertiary">
          Aún no pueden escribirle — pero ya lo estamos construyendo para ustedes.
        </div>
      </div>
    </div>
  );
}
