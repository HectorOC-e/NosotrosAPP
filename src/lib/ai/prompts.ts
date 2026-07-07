import "server-only";
import type { ChatMessage } from "@/lib/ai/openrouter";
import { COST_CATS, type CostCat } from "@/lib/constants";

const EMOJI_WORD: Record<string, string> = {
  "😞": "muy bajo",
  "😕": "bajo",
  "😐": "neutral",
  "🙂": "bien",
  "😄": "muy bien",
};

/** Turns recent mood rows into a short, human sentence for the model. */
export function summarizeMoods(
  rows: { mood_emoji: string; mood_date: string }[],
): string {
  if (!rows.length) return "No hay check-ins de ánimo recientes.";
  const counts = new Map<string, number>();
  for (const r of rows) {
    const word = EMOJI_WORD[r.mood_emoji] ?? "neutral";
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word, n]) => `${n}× ${word}`);
  return `Ánimos de los últimos 7 días: ${parts.join(", ")}.`;
}

export const MEDIATOR_SYSTEM = [
  "Eres un mediador cálido para una pareja en la app 'Nosotros'.",
  "Hablas en español (tono hondureño, cercano y natural), en segunda persona plural cuando aplique.",
  "No eres terapeuta ni das diagnósticos: acompañas, sugieres frases y preguntas suaves.",
  "Respuestas breves (máx 4 frases), sin listas largas, sin juzgar a ninguno de los dos.",
].join(" ");

/** System prompt for chat turns, enriched with the week's mood context. */
export function chatSystem(moodSummary: string): string {
  return `${MEDIATOR_SYSTEM}\n\nContexto reciente (úsalo con delicadeza, no lo recites literalmente): ${moodSummary}`;
}

/** Synthetic user instruction that produces the weekly reflection. */
export function reflectionUserPrompt(moodSummary: string, topics: string[]): string {
  return [
    "Escribe una reflexión breve y cálida (máximo 4 frases) sobre cómo ha estado la pareja esta semana",
    "y sugiere con suavidad UN tema para conversar.",
    `Datos: ${moodSummary}`,
    `Temas guía disponibles: ${topics.join(", ")}.`,
  ].join(" ");
}

/** Messages to generate ONE fresh date idea as strict JSON {cost,text}. */
export function dateIdeaMessages(opts: {
  costFilter?: string;
  avoid: string[];
}): ChatMessage[] {
  const costLine = opts.costFilter
    ? `La idea debe ser de categoría de costo "${opts.costFilter}".`
    : "";
  const avoidLine = opts.avoid.length
    ? `Evita repetir estas ideas que ya tienen:\n- ${opts.avoid.slice(0, 15).join("\n- ")}`
    : "";
  return [
    {
      role: "system",
      content: `${MEDIATOR_SYSTEM}\n\nGeneras ideas de cita concretas y realistas para una pareja en Honduras.`,
    },
    {
      role: "user",
      content: [
        "Propón UNA sola idea de cita fresca, cálida y específica (una o dos frases).",
        costLine,
        avoidLine,
        'Responde SOLO con JSON válido, sin texto adicional, con esta forma exacta: {"cost":"Gratis|Económica|Especial","text":"..."}.',
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

/** Messages to generate ONE gentle guiding question (plain text). */
export function guidingQuestionMessages(opts: {
  moodSummary: string;
}): ChatMessage[] {
  return [
    { role: "system", content: MEDIATOR_SYSTEM },
    {
      role: "user",
      content: [
        "Propón UNA sola pregunta guía, suave y abierta, para que la pareja converse con calma.",
        "En español (es-HN), cálida, sin tono clínico ni de terapia.",
        `Contexto (úsalo con delicadeza, no lo menciones literalmente): ${opts.moodSummary}`,
        "Responde SOLO con la pregunta, sin comillas ni texto adicional.",
      ].join("\n"),
    },
  ];
}

/** Defensively parses the model's JSON date idea; never throws. */
export function parseDateIdea(
  raw: string,
  costFilter?: string,
): { text: string; cost: CostCat } {
  const isCost = (v: unknown): v is CostCat =>
    typeof v === "string" && (COST_CATS as readonly string[]).includes(v);
  const fallbackCost: CostCat = isCost(costFilter) ? costFilter : "Económica";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]) as { text?: unknown; cost?: unknown };
      const text = typeof obj.text === "string" ? obj.text.trim() : "";
      if (text) return { text, cost: isCost(obj.cost) ? obj.cost : fallbackCost };
    }
  } catch {
    // fall through to raw-text fallback
  }
  const text = raw.trim().slice(0, 200) || "Una cita especial, ustedes dos";
  return { text, cost: fallbackCost };
}
