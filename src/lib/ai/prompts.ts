import "server-only";
import type { ChatMessage } from "@/lib/ai/openrouter";
import { COST_CATS, VIBE_CATS, type CostCat, type VibeCat } from "@/lib/constants";

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

/** System prompt for chat turns, enriched with couple context + the week's moods. */
export function chatSystem(moodSummary: string, coupleContext?: string): string {
  const ctx = coupleContext ? `\n\n${coupleContext}` : "";
  return `${MEDIATOR_SYSTEM}${ctx}\n\nContexto reciente de la pareja (úsalo con delicadeza, no lo recites literalmente): ${moodSummary}`;
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

/** Messages to generate ONE fresh date idea as strict JSON {cost,vibes,text}. */
export function dateIdeaMessages(opts: {
  costFilter?: string;
  vibes: string[];
  avoid: string[];
  coupleContext?: string;
}): ChatMessage[] {
  const costLine = opts.costFilter ? `Categoría de costo deseada: "${opts.costFilter}".` : "";
  const vibeLine = opts.vibes.length ? `Vibras deseadas: ${opts.vibes.join(", ")}.` : "";
  const avoidLine = opts.avoid.length
    ? `Evita repetir estas ideas que ya tienen:\n- ${opts.avoid.slice(0, 15).join("\n- ")}`
    : "";
  const ctx = opts.coupleContext ? `\n\n${opts.coupleContext}` : "";
  return [
    {
      role: "system",
      content: `${MEDIATOR_SYSTEM}\n\nGeneras ideas de cita concretas y realistas para la pareja.${ctx}`,
    },
    {
      role: "user",
      content: [
        "Propón UNA sola idea de cita fresca, cálida y específica (una o dos frases).",
        costLine,
        vibeLine,
        avoidLine,
        `Elige "cost" entre: ${COST_CATS.join(", ")}. Elige "vibes" (una o dos) entre: ${VIBE_CATS.join(", ")}.`,
        'Responde SOLO con JSON válido, sin texto adicional: {"cost":"...","vibes":["..."],"text":"..."}.',
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

/** Messages to generate ONE guiding question tied to the couple's topics. */
export function guidingQuestionMessages(opts: {
  moodSummary: string;
  topics: { title: string; question: string }[];
  coupleContext?: string;
}): ChatMessage[] {
  const ctx = opts.coupleContext ? `\n\n${opts.coupleContext}` : "";
  const topicList = opts.topics.map((t) => `- ${t.title}: ${t.question}`).join("\n");
  return [
    { role: "system", content: `${MEDIATOR_SYSTEM}${ctx}` },
    {
      role: "user",
      content: [
        "Estos son los temas de conversación de la pareja:",
        topicList,
        `Ánimo reciente (úsalo con delicadeza): ${opts.moodSummary}`,
        "Elige el tema más pertinente según su ánimo y propón UNA pregunta guía fresca, suave y abierta para ese tema (es-HN, sin tono clínico).",
        'Responde SOLO con JSON: {"topic":"<el título exacto del tema, o General>","question":"..."}.',
      ].join("\n"),
    },
  ];
}

/** Defensively parses the model's JSON date idea; never throws. */
export function parseDateIdea(
  raw: string,
  costFilter?: string,
): { text: string; cost: CostCat; vibes: VibeCat[] } {
  const isCost = (v: unknown): v is CostCat =>
    typeof v === "string" && (COST_CATS as readonly string[]).includes(v);
  const isVibe = (v: unknown): v is VibeCat =>
    typeof v === "string" && (VIBE_CATS as readonly string[]).includes(v);
  const fallbackCost: CostCat = isCost(costFilter) ? costFilter : "Económica";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]) as {
        text?: unknown;
        cost?: unknown;
        vibes?: unknown;
      };
      const text = typeof obj.text === "string" ? obj.text.trim() : "";
      if (text) {
        const vibes = Array.isArray(obj.vibes) ? obj.vibes.filter(isVibe) : [];
        return { text, cost: isCost(obj.cost) ? obj.cost : fallbackCost, vibes };
      }
    }
  } catch {
    // fall through
  }
  const cleaned = raw.trim();
  return {
    text:
      cleaned && !cleaned.startsWith("{")
        ? cleaned.slice(0, 200)
        : "Una cita especial, ustedes dos",
    cost: fallbackCost,
    vibes: [],
  };
}

/** Defensively parses {topic,question}; topic falls back to "General". Never throws. */
export function parseGuidingQuestion(
  raw: string,
  topics: string[],
): { topic: string; question: string } {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const obj = JSON.parse(match[0]) as { topic?: unknown; question?: unknown };
      const question = typeof obj.question === "string" ? obj.question.trim() : "";
      if (question) {
        const topic =
          typeof obj.topic === "string" && topics.includes(obj.topic)
            ? obj.topic
            : "General";
        return { topic, question };
      }
    }
  } catch {
    // fall through
  }
  const cleaned = raw.trim();
  return {
    topic: "General",
    question:
      cleaned && !cleaned.startsWith("{")
        ? cleaned.slice(0, 300)
        : "¿Qué es lo que más agradecen de esta semana juntos?",
  };
}
