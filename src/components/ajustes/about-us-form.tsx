"use client";

import { useState, useTransition } from "react";
import { saveAboutUs } from "@/lib/actions/ajustes";
import { sileo } from "sileo";

export function AboutUsForm({
  initialLocation,
  initialBudget,
  initialTogetherSince,
  initialHasKids,
  initialAbout,
  partnerName,
  partnerAbout,
}: {
  initialLocation: string;
  initialBudget: string;
  initialTogetherSince: string;
  initialHasKids: boolean;
  initialAbout: string;
  partnerName: string;
  partnerAbout: string;
}) {
  const [location, setLocation] = useState(initialLocation);
  const [budget, setBudget] = useState(initialBudget);
  const [togetherSince, setTogetherSince] = useState(initialTogetherSince);
  const [hasKids, setHasKids] = useState(initialHasKids);
  const [about, setAbout] = useState(initialAbout);
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const r = await saveAboutUs({
        location,
        typicalBudget: budget,
        togetherSince,
        hasKids,
        about,
      });
      if (r.ok) sileo.success({ title: "Guardado ✨ La IA los conocerá mejor.", duration: 2600 });
      else sileo.error({ title: r.message });
    });
  }

  return (
    <div className="glass mb-4 rounded-[22px] px-5 py-[18px]">
      <div className="eyebrow mb-3.5">SOBRE NOSOTROS</div>
      <p className="mb-4 text-[12.5px] leading-[1.5] text-ink-tertiary">
        Esto ayuda a la IA a sugerir planes cercanos y afines a ustedes.
      </p>

      <label className="mb-1.5 block text-[13px] text-ink">Ubicación</label>
      <input
        className="field mb-4 w-full"
        placeholder="Ej. Marcala, La Paz, Honduras"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />

      <label className="mb-1.5 block text-[13px] text-ink">Presupuesto típico de salida (L)</label>
      <input
        className="field mb-4 w-full"
        inputMode="numeric"
        placeholder="Ej. 300"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
      />

      <label className="mb-1.5 block text-[13px] text-ink">¿Desde cuándo están juntos?</label>
      <input
        type="date"
        className="field mb-4 w-full"
        value={togetherSince}
        onChange={(e) => setTogetherSince(e.target.value)}
      />

      <label className="mb-4 flex items-center gap-2.5 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={hasKids}
          onChange={(e) => setHasKids(e.target.checked)}
        />
        Tenemos hijos
      </label>

      <label className="mb-1.5 block text-[13px] text-ink">Sobre ti</label>
      <textarea
        className="field mb-4 min-h-[72px] w-full"
        placeholder="Tus gustos, intereses, algo que la IA debería saber…"
        value={about}
        onChange={(e) => setAbout(e.target.value)}
      />

      {partnerAbout.trim() && (
        <div className="mb-4">
          <div className="mb-1.5 text-[13px] text-ink">Sobre {partnerName}</div>
          <p className="glass-subtle rounded-[14px] p-3 text-[13px] text-ink-secondary">
            {partnerAbout}
          </p>
        </div>
      )}

      <button onClick={onSave} disabled={pending} className="btn-primary w-full disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}
