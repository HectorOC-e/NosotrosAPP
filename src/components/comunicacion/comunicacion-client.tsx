"use client";

import { useState, useTransition } from "react";
import { EMOJIS, TOPICS } from "@/lib/constants";
import { hexToRgba } from "@/lib/utils";
import { setMood } from "@/lib/actions/comunicacion";
import { generateGuidingQuestion } from "@/lib/actions/ai";
import { aiReasonMessage } from "@/lib/ai/reason-messages";
import { MediatorPanel, type MediatorMessage } from "@/components/comunicacion/mediator-panel";

type Row = {
  name: string;
  accent: string;
  emoji: string | null;
  isMe: boolean;
};

export function ComunicacionClient({
  rows,
  messages,
  hasAiKey,
  isCreador,
  partnerName,
}: {
  rows: Row[];
  messages: MediatorMessage[];
  hasAiKey: boolean;
  isCreador: boolean;
  partnerName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [aiQuestion, setAiQuestion] = useState<string | null>(null);
  const [aiTopic, setAiTopic] = useState<string | null>(null);
  const [aiQPending, setAiQPending] = useState(false);
  const [aiQError, setAiQError] = useState<string | null>(null);

  function newQuestion() {
    setAiQError(null);
    setAiQPending(true);
    startTransition(async () => {
      try {
        const r = await generateGuidingQuestion();
        if (r.ok && r.question) {
          setAiQuestion(r.question);
          setAiTopic(r.topic ?? null);
        } else setAiQError(aiReasonMessage(r.reason));
      } catch {
        setAiQError(aiReasonMessage("fallo"));
      } finally {
        setAiQPending(false);
      }
    });
  }

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

      {/* AI guiding question */}
      <div className="glass-subtle mb-5 rounded-[18px] p-[15px]">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex-1 text-[13px] font-semibold text-ink">
            Pregunta guía con IA
          </span>
          <button
            onClick={newQuestion}
            disabled={pending}
            className="rounded-full bg-violeta/20 px-2.5 py-1 text-[11px] text-violeta disabled:opacity-60"
          >
            {aiQuestion ? "Otra ✨" : "Nueva pregunta ✨"}
          </button>
        </div>
        {aiQPending ? (
          <span className="text-[12px] text-ink-tertiary">Pensando… ✨</span>
        ) : aiQuestion ? (
          <>
            {aiTopic && (
              <div className="mb-1 text-[11px] tracking-[0.03em] text-violeta">
                Sobre {aiTopic}
              </div>
            )}
            <span className="font-serif text-[14px] italic leading-[1.4] text-ink-secondary">
              {aiQuestion}
            </span>
          </>
        ) : (
          <span className="text-[12px] text-ink-tertiary">
            Toca para que la IA les proponga una pregunta.
          </span>
        )}
        {aiQError && (
          <div className="mt-2 text-[12.5px]" style={{ color: "#FF6B6B" }}>
            {aiQError}
          </div>
        )}
      </div>

      <MediatorPanel
        messages={messages}
        hasAiKey={hasAiKey}
        isCreador={isCreador}
        partnerName={partnerName}
      />
    </div>
  );
}
