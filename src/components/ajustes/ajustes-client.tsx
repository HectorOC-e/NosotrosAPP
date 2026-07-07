"use client";

import { useState, useTransition } from "react";
import { AI_MODELS, DEFAULT_AI_MODEL } from "@/lib/constants";
import { saveAiConfig } from "@/lib/actions/ai";

export function AjustesClient({
  initialModel,
  hasKey,
}: {
  initialModel: string;
  hasKey: boolean;
}) {
  const [model, setModel] = useState(initialModel || DEFAULT_AI_MODEL);
  const [key, setKey] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onSave() {
    setMsg(null);
    startTransition(async () => {
      const res = await saveAiConfig({ model, key });
      if (res.ok) {
        setKey("");
        setMsg({ ok: true, text: "Guardado ✨ El mediador ya está listo." });
      } else {
        setMsg({ ok: false, text: res.error ?? "No se pudo guardar." });
      }
    });
  }

  return (
    <div className="glass rounded-[22px] px-5 py-[18px]">
      <div className="eyebrow mb-3.5">MEDIADOR IA</div>

      <label className="mb-1.5 block text-[13px] text-ink">Modelo</label>
      <select
        className="field mb-4 w-full"
        value={model}
        onChange={(e) => setModel(e.target.value)}
      >
        {AI_MODELS.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.label}
          </option>
        ))}
        {!AI_MODELS.some((m) => m.slug === model) && (
          <option value={model}>{model} (personalizado)</option>
        )}
      </select>

      <label className="mb-1.5 block text-[13px] text-ink">API key de OpenRouter</label>
      <input
        type="password"
        className="field mb-1.5 w-full"
        placeholder={hasKey ? "•••• guardada — deja vacío para conservarla" : "sk-or-..."}
        value={key}
        onChange={(e) => setKey(e.target.value)}
        autoComplete="off"
      />
      <a
        href="https://openrouter.ai/keys"
        target="_blank"
        rel="noreferrer"
        className="mb-4 block text-[12px] text-ink-tertiary underline"
      >
        ¿De dónde saco una key?
      </a>

      <button
        onClick={onSave}
        disabled={pending}
        className="btn-primary w-full disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>

      {msg && (
        <div
          className="mt-3 text-[13px]"
          style={{ color: msg.ok ? "#3ED6B5" : "#FF6B6B" }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
