"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  FILTER_CATS,
  COST_CATS,
  COST_COLOR,
  type CostCat,
} from "@/lib/constants";
import { addIdea, setFavorite, startDate, saveGeneratedIdea } from "@/lib/actions/citas";
import { generateDateIdea } from "@/lib/actions/ai";
import { aiReasonMessage } from "@/lib/ai/reason-messages";

export type IdeaView = {
  id: string;
  text: string;
  tags: string[];
  isFavorite: boolean;
};

export function CitasClient({ ideas }: { ideas: IdeaView[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(ideas[0]?.id ?? null);
  const [newIdeaText, setNewIdeaText] = useState("");
  const [newIdeaCost, setNewIdeaCost] = useState<CostCat>("Gratis");

  const filtered = useMemo(() => {
    if (!selectedFilters.length) return ideas;
    return ideas.filter((i) => i.tags.some((t) => selectedFilters.includes(t)));
  }, [ideas, selectedFilters]);

  const displayIdea =
    filtered.find((i) => i.id === currentId) ?? filtered[0] ?? null;
  const favorites = ideas.filter((i) => i.isFavorite);

  function toggleFilter(cat: string) {
    setSelectedFilters((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  function surprise() {
    if (!filtered.length) return;
    let pick = filtered[Math.floor(Math.random() * filtered.length)];
    if (filtered.length > 1) {
      let tries = 0;
      while (pick.id === displayIdea?.id && tries < 8) {
        pick = filtered[Math.floor(Math.random() * filtered.length)];
        tries++;
      }
    }
    setCurrentId(pick.id);
  }

  function toggleFavorite() {
    if (!displayIdea) return;
    const target = displayIdea;
    startTransition(() => setFavorite(target.id, !target.isFavorite));
  }

  function beginDate(id: string) {
    startTransition(async () => {
      const r = await startDate(id);
      if (r.ok) router.push("/gastos");
    });
  }

  const [aiIdea, setAiIdea] = useState<{ text: string; cost: CostCat; vibes: string[] } | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  function generateAi() {
    setAiError(null);
    setAiGenerating(true);
    startTransition(async () => {
      try {
        const r = await generateDateIdea({ filters: selectedFilters });
        if (r.ok && r.idea) setAiIdea(r.idea);
        else if (r.reason === "sin-key") surprise();
        else setAiError(aiReasonMessage(r.reason));
      } catch {
        setAiError(aiReasonMessage("fallo"));
      } finally {
        setAiGenerating(false);
      }
    });
  }

  function saveAi() {
    if (!aiIdea) return;
    const idea = aiIdea;
    startTransition(async () => {
      try {
        await saveGeneratedIdea(idea);
        setAiIdea(null);
      } catch {
        setAiError(aiReasonMessage("fallo"));
      }
    });
  }

  function backToPool() {
    setAiIdea(null);
    setAiError(null);
  }

  function submitIdea(e: React.FormEvent) {
    e.preventDefault();
    const text = newIdeaText.trim();
    if (!text) return;
    startTransition(async () => {
      await addIdea({ text, cost: newIdeaCost });
      setNewIdeaText("");
    });
  }

  return (
    <div>
      {/* Filter chips */}
      <div className="mb-[18px] flex flex-wrap gap-2">
        {FILTER_CATS.map((cat) => {
          const active = selectedFilters.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggleFilter(cat)}
              aria-pressed={active}
              className="rounded-full border px-3.5 py-2 text-[13px] transition"
              style={
                active
                  ? {
                      // Active = inverted fill with the pink accent.
                      background: "#FF6F91",
                      borderColor: "#FF6F91",
                      color: "#120F17",
                      fontWeight: 600,
                    }
                  : {
                      background: "rgba(255,255,255,0.04)",
                      borderColor: "rgba(255,255,255,0.12)",
                      color: "#A79FBD",
                    }
              }
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Central idea card */}
      <div className="glass mb-4 flex min-h-[150px] flex-col justify-center rounded-[26px] p-[26px_22px]">
        {aiGenerating ? (
          <div className="text-center text-[14.5px] text-ink-secondary">
            Pensando una idea… ✨
          </div>
        ) : aiIdea ? (
          <>
            <div className="mb-3.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-violeta/20 px-2.5 py-1 text-[11px] text-violeta">
                ✨ Sugerencia de IA · sin guardar
              </span>
              <span className="rounded-full bg-violeta/15 px-2.5 py-1 text-[11px] text-violeta">
                {aiIdea.cost}
              </span>
              {aiIdea.vibes.map((v) => (
                <span key={v} className="rounded-full bg-violeta/15 px-2.5 py-1 text-[11px] text-violeta">
                  {v}
                </span>
              ))}
            </div>
            <div className="mb-5 font-serif text-[21px] font-medium italic leading-[1.4] text-ink">
              {aiIdea.text}
            </div>
            <div className="flex gap-2.5">
              <Button size="md" onClick={saveAi} disabled={pending} className="flex-1 py-[13px]">
                ♡ Guardar
              </Button>
              <Button variant="ghost" size="md" onClick={generateAi} disabled={pending} className="px-4 py-[13px]">
                Otra ✨
              </Button>
              <Button variant="ghost" size="md" onClick={backToPool} disabled={pending} className="px-4 py-[13px]">
                Volver
              </Button>
            </div>
          </>
        ) : displayIdea ? (
          <>
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {displayIdea.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-violeta/15 px-2.5 py-1 text-[11px] text-violeta"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="mb-5 font-serif text-[21px] font-medium italic leading-[1.4] text-ink">
              {displayIdea.text}
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex gap-2.5">
                <Button size="md" onClick={generateAi} disabled={pending} className="flex-1 py-[13px]">
                  Sorpréndenos
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={toggleFavorite}
                  disabled={pending}
                  className="px-4 py-[13px]"
                >
                  {displayIdea.isFavorite ? "Guardada ✓" : "Guardar como favorita"}
                </Button>
              </div>
              <Button
                size="md"
                onClick={() => beginDate(displayIdea.id)}
                disabled={pending}
                className="w-full py-[13px]"
              >
                Empezar esta cita →
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center text-[14.5px] text-ink-secondary">
              No hay ideas con esos filtros — agreguen una abajo 👇
            </div>
            <Button size="md" onClick={generateAi} disabled={pending} className="w-full py-[13px]">
              Sorpréndenos
            </Button>
          </div>
        )}
        {aiError && (
          <div className="mt-3 text-center text-[13px]" style={{ color: "#FF6B6B" }}>
            {aiError}
          </div>
        )}
      </div>

      {/* Favorites */}
      <div className="mb-[22px]">
        <div className="eyebrow mb-2.5">FAVORITAS GUARDADAS</div>
        {favorites.length ? (
          <div className="flex flex-col gap-2">
            {favorites.map((fav) => (
              <div
                key={fav.id}
                className="glass-subtle flex items-center gap-2.5 rounded-2xl px-3.5 py-3"
              >
                <span className="flex-1 text-[14px] text-ink">{fav.text}</span>
                <button
                  onClick={() => beginDate(fav.id)}
                  disabled={pending}
                  className="p-1 text-[13px] text-rosa transition hover:brightness-110"
                >
                  Empezar
                </button>
                <button
                  onClick={() => startTransition(() => setFavorite(fav.id, false))}
                  disabled={pending}
                  className="p-1 text-[13px] text-ink-secondary transition hover:text-alert"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[13.5px] text-ink-tertiary">
            Aún no han guardado ninguna favorita.
          </div>
        )}
      </div>

      {/* Add your own idea */}
      <div className="glass-subtle rounded-[20px] p-[18px]">
        <div className="mb-3 text-[13px] text-ink-secondary">
          AGREGAR SU PROPIA IDEA
        </div>
        <form onSubmit={submitIdea} className="flex flex-col gap-3">
          <input
            value={newIdeaText}
            onChange={(e) => setNewIdeaText(e.target.value)}
            placeholder="Ej. Ver el amanecer en la terraza"
            className="field !rounded-xl !py-3 text-[14px]"
          />
          <div className="flex gap-2">
            {COST_CATS.map((cat) => {
              const selected = newIdeaCost === cat;
              const c = COST_COLOR[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNewIdeaCost(cat)}
                  className="flex-1 rounded-full border p-2.5 text-[12.5px] transition"
                  style={{
                    background: selected ? c.bg : "rgba(255,255,255,0.03)",
                    color: selected ? c.color : "#A79FBD",
                    borderColor: selected ? c.border : "rgba(255,255,255,0.1)",
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
          <Button
            type="submit"
            variant="ghost"
            size="md"
            disabled={pending}
            className="py-3"
          >
            Agregar idea
          </Button>
        </form>
      </div>
    </div>
  );
}
