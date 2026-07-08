"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addPendiente, togglePendiente } from "@/lib/actions/calendario";
import { sileo } from "sileo";

export type PendienteView = {
  id: string;
  text: string;
  done: boolean;
  iso: string;
  dateLabel: string;
  days: number;
  creador: string;
};

export function CalendarioClient({ items }: { items: PendienteView[] }) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [fecha, setFecha] = useState("");

  const next7 = items.filter((p) => !p.done && p.days >= 0 && p.days <= 7);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !fecha) return;
    startTransition(async () => {
      const r = await addPendiente({ text, fecha });
      if (r.ok) {
        setText("");
        setFecha("");
        sileo.success({ title: "Pendiente agregado", duration: 2000 });
      } else {
        sileo.error({ title: r.message });
      }
    });
  }

  return (
    <div>
      {next7.length > 0 && (
        <div className="mb-5 rounded-[20px] border border-violeta/[0.28] bg-violeta/[0.09] px-[18px] py-4">
          <div className="mb-2.5 text-[12px] tracking-[0.02em] text-violeta">
            PRÓXIMOS 7 DÍAS
          </div>
          <div className="flex flex-col gap-2">
            {next7.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-[14px] text-ink">{p.text}</span>
                <span className="tnum ml-2.5 flex-shrink-0 text-[12.5px] text-ink-secondary">
                  {p.dateLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="eyebrow mb-2.5">TODOS LOS PENDIENTES</div>
      <div className="mb-[22px] flex flex-col gap-2">
        {items.length === 0 && (
          <div className="text-[13.5px] text-ink-tertiary">
            No tienen pendientes por ahora — agreguen uno abajo 👇
          </div>
        )}
        {items.map((p) => (
          <div
            key={p.id}
            className="glass-subtle flex items-start gap-3 rounded-2xl px-4 py-3.5"
          >
            <button
              onClick={() =>
                startTransition(async () => {
                  const done = !p.done;
                  const r = await togglePendiente(p.id, done);
                  if (r.ok)
                    sileo.success({
                      title: done ? "Marcado como hecho" : "Marcado como pendiente",
                      duration: 2000,
                    });
                  else sileo.error({ title: r.message });
                })
              }
              disabled={pending}
              aria-pressed={p.done}
              aria-label={p.done ? "Marcar como pendiente" : "Marcar como hecho"}
              className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[7px] border-[1.5px] text-[13px] text-bg"
              style={{
                borderColor: p.done ? "#3ED6B5" : "rgba(255,255,255,0.25)",
                background: p.done ? "#3ED6B5" : "transparent",
              }}
            >
              {p.done ? "✓" : ""}
            </button>
            <div className="flex-1">
              <div
                className="text-[14.5px]"
                style={{
                  color: p.done ? "#6b6380" : "#F2EEF9",
                  textDecoration: p.done ? "line-through" : "none",
                }}
              >
                {p.text}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="tnum text-[12px] text-ink-secondary">
                  {p.dateLabel}
                </span>
                <span className="text-[11px] text-ink-tertiary">
                  · agregó {p.creador}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-subtle rounded-[20px] p-[18px]">
        <div className="mb-3 text-[13px] text-ink-secondary">AGREGAR PENDIENTE</div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="¿Qué tienen que hacer?"
            className="field !rounded-xl !py-3 text-[14px]"
          />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="field tnum !rounded-xl !py-3 text-[14px] [color-scheme:dark]"
          />
          <Button type="submit" variant="ghost" size="md" disabled={pending} className="py-3">
            Agregar pendiente
          </Button>
        </form>
      </div>
    </div>
  );
}
