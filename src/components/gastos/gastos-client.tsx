"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveOuting, addExpense, removeExpense } from "@/lib/actions/gastos";

type Person = { id: string | null; name: string; accent: string };

type Props = {
  outing: { name: string; limitInput: string } | null;
  barColor: string;
  pctLabel: string;
  pctWidth: string;
  spentLabel: string;
  limitLabel: string;
  isOver: boolean;
  overByLabel: string;
  overMensaje: string;
  expenses: { id: string; desc: string; quien: string; montoLabel: string }[];
  people: Person[];
  meId: string;
};

function tint(accent: string) {
  // "#RRGGBB" → rgba tints matching the design's per-person selected state.
  const r = parseInt(accent.slice(1, 3), 16);
  const g = parseInt(accent.slice(3, 5), 16);
  const b = parseInt(accent.slice(5, 7), 16);
  return {
    bg: `rgba(${r},${g},${b},0.15)`,
    border: `rgba(${r},${g},${b},0.4)`,
  };
}

export function GastosClient(props: Props) {
  const [pending, startTransition] = useTransition();
  const [outingName, setOutingName] = useState(props.outing?.name ?? "");
  const [outingLimit, setOutingLimit] = useState(props.outing?.limitInput ?? "");
  const [desc, setDesc] = useState("");
  const [monto, setMonto] = useState("");
  const [quienId, setQuienId] = useState(props.meId);

  function submitOuting(e: React.FormEvent) {
    e.preventDefault();
    const limit = parseFloat(outingLimit);
    if (!outingName.trim() || isNaN(limit) || limit <= 0) return;
    startTransition(() => saveOuting({ name: outingName.trim(), limit }));
  }

  function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(monto);
    if (!desc.trim() || isNaN(amount) || amount <= 0 || !quienId) return;
    startTransition(async () => {
      await addExpense({ desc: desc.trim(), monto: amount, profileId: quienId });
      setDesc("");
      setMonto("");
    });
  }

  return (
    <div>
      {/* Budget summary */}
      <div className="glass mb-4 rounded-[22px] px-5 py-[18px]">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-[16px] font-semibold text-ink">
            {props.outing?.name ?? "Aún no definen una salida"}
          </div>
          <div className="tnum text-[13px]" style={{ color: props.barColor }}>
            {props.outing ? props.pctLabel : ""}
          </div>
        </div>
        <div className="my-3 h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: props.pctWidth, background: props.barColor }}
          />
        </div>
        <div className="tnum mb-2.5 text-[13px] text-ink-secondary">
          L {props.spentLabel} de L {props.limitLabel}
        </div>
        {props.isOver && (
          <div className="rounded-[14px] border border-alert/35 bg-alert/[0.12] px-3.5 py-3 text-[13px] leading-[1.5] text-alert">
            Se pasaron por L {props.overByLabel} del límite — {props.overMensaje}.
            Nada grave, ajusten el límite juntos para la próxima 💛
          </div>
        )}
      </div>

      {/* Define active outing */}
      <div className="glass-subtle mb-4 rounded-[18px] px-[18px] py-4">
        <div className="mb-2.5 text-[12.5px] text-ink-secondary">
          DEFINIR SALIDA ACTIVA
        </div>
        <form onSubmit={submitOuting} className="flex flex-col gap-2.5">
          <input
            value={outingName}
            onChange={(e) => setOutingName(e.target.value)}
            placeholder="Nombre de la salida"
            className="field !rounded-xl !py-[11px] text-[13.5px]"
          />
          <input
            value={outingLimit}
            onChange={(e) => setOutingLimit(e.target.value)}
            inputMode="numeric"
            placeholder="Límite en L"
            className="field tnum !rounded-xl !py-[11px] text-[13.5px]"
          />
          <Button type="submit" variant="ghost" size="sm" disabled={pending} className="py-[11px]">
            Guardar salida
          </Button>
        </form>
      </div>

      {/* Registered expenses */}
      <div className="eyebrow mb-2.5">GASTOS REGISTRADOS</div>
      <div className="mb-[22px] flex flex-col gap-2">
        {props.expenses.length === 0 && (
          <div className="text-[13.5px] text-ink-tertiary">
            Aún no han registrado gastos.
          </div>
        )}
        {props.expenses.map((ex) => (
          <div
            key={ex.id}
            className="glass-subtle flex items-center gap-3 rounded-2xl px-4 py-3"
          >
            <div className="flex-1">
              <div className="text-[14px] text-ink">{ex.desc}</div>
              <div className="mt-0.5 text-[11.5px] text-ink-tertiary">{ex.quien}</div>
            </div>
            <div className="tnum text-[14px] text-ink">L {ex.montoLabel}</div>
            <button
              onClick={() => startTransition(() => removeExpense(ex.id))}
              disabled={pending}
              aria-label="Eliminar gasto"
              className="p-1 text-[13px] text-ink-secondary transition hover:text-alert"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Register expense */}
      <div className="glass-subtle rounded-[20px] p-[18px]">
        <div className="mb-3 text-[13px] text-ink-secondary">REGISTRAR GASTO</div>
        <form onSubmit={submitExpense} className="flex flex-col gap-3">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="¿En qué gastaron?"
            className="field !rounded-xl !py-3 text-[14px]"
          />
          <input
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            inputMode="numeric"
            placeholder="Monto en L"
            className="field tnum !rounded-xl !py-3 text-[14px]"
          />
          <div className="flex gap-2">
            {props.people.map((person, i) => {
              const selected = quienId === person.id;
              const t = tint(person.accent);
              return (
                <button
                  key={person.id ?? `slot-${i}`}
                  type="button"
                  disabled={!person.id}
                  onClick={() => person.id && setQuienId(person.id)}
                  className="flex-1 rounded-full border p-[11px] text-[13px] transition disabled:opacity-50"
                  style={{
                    background: selected ? t.bg : "rgba(255,255,255,0.03)",
                    color: selected ? person.accent : "#A79FBD",
                    borderColor: selected ? t.border : "rgba(255,255,255,0.1)",
                  }}
                >
                  {person.name}
                </button>
              );
            })}
          </div>
          <Button type="submit" variant="ghost" size="md" disabled={pending} className="py-3">
            Agregar gasto
          </Button>
        </form>
      </div>
    </div>
  );
}
