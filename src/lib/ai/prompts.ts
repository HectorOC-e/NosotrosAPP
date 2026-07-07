import "server-only";

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
