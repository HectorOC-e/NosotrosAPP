// Design-system content constants, transcribed verbatim from the prototype.

/** The 7 filter chips in Citas. */
export const FILTER_CATS = [
  "Gratis",
  "Económica",
  "Especial",
  "Aventura",
  "Relax",
  "Creativo",
  "Conexión",
] as const;

/** The 3 cost categories (segmented control when adding an idea). */
export const COST_CATS = ["Gratis", "Económica", "Especial"] as const;

/** The 4 vibe categories (everything that isn't a cost). */
export const VIBE_CATS = ["Aventura", "Relax", "Creativo", "Conexión"] as const;

export type CostCat = (typeof COST_CATS)[number];
export type VibeCat = (typeof VIBE_CATS)[number];

/**
 * The 8 generic starter ideas seeded into a new couple's space.
 * `cost` maps to date_ideas.cost; `vibes` are comma-joined into date_ideas.vibe.
 */
export const SEED_IDEAS: {
  text: string;
  cost: CostCat;
  vibes: VibeCat[];
  favorite?: boolean;
}[] = [
  {
    text: "Vean el atardecer desde la azotea con café y sin celulares",
    cost: "Gratis",
    vibes: ["Relax", "Conexión"],
    favorite: true,
  },
  {
    text: "Cocinen juntos una receta que nunca han probado",
    cost: "Económica",
    vibes: ["Creativo"],
  },
  {
    text: "Maratón de la película que vieron en su primera cita",
    cost: "Gratis",
    vibes: ["Relax"],
  },
  {
    text: "Escápense un fin de semana a un pueblo que no conozcan",
    cost: "Especial",
    vibes: ["Aventura"],
  },
  {
    text: "Anoten 3 cosas que agradecen del otro y léanlas en voz alta",
    cost: "Gratis",
    vibes: ["Conexión"],
    favorite: true,
  },
  {
    text: "Tomen una clase de baile juntos",
    cost: "Económica",
    vibes: ["Aventura", "Creativo"],
  },
  {
    text: "Cena sorpresa en un restaurante nuevo",
    cost: "Especial",
    vibes: ["Conexión"],
  },
  {
    text: "Hagan un picnic nocturno viendo estrellas",
    cost: "Gratis",
    vibes: ["Aventura", "Relax"],
  },
];

/** The 6 conversation-starter topics with their guiding questions. */
export const TOPICS = [
  {
    id: "finanzas",
    title: "Finanzas",
    question: "¿Qué nos haría sentir más tranquilos con el dinero este mes?",
  },
  {
    id: "tiempo",
    title: "Tiempo juntos",
    question: "¿Qué actividad nos gustaría repetir más seguido?",
  },
  {
    id: "familia",
    title: "Familia",
    question: "¿Cómo nos gustaría manejar las visitas familiares este mes?",
  },
  {
    id: "expectativas",
    title: "Expectativas",
    question: "¿Hay algo que esperamos del otro y no hemos dicho en voz alta?",
  },
  {
    id: "espacio",
    title: "Espacio personal",
    question: "¿Cómo puedo darte más espacio cuando lo necesitas?",
  },
  {
    id: "conflictos",
    title: "Conflictos pasados",
    question: "¿Qué nos ayudaría a cerrar mejor la última discusión?",
  },
] as const;

/** Mood check-in emoji scale, saddest → happiest. */
export const EMOJIS = ["😞", "😕", "😐", "🙂", "😄"] as const;

/** Neutral placeholder when a partner hasn't checked in yet. */
export const EMOJI_PLACEHOLDER = "❔";

/** Tint per cost category (segmented control selected state). */
export const COST_COLOR: Record<
  CostCat,
  { bg: string; color: string; border: string }
> = {
  Gratis: { bg: "rgba(62,214,181,0.15)", color: "#3ED6B5", border: "rgba(62,214,181,0.4)" },
  Económica: { bg: "rgba(139,124,255,0.15)", color: "#8B7CFF", border: "rgba(139,124,255,0.4)" },
  Especial: { bg: "rgba(255,111,145,0.15)", color: "#FF6F91", border: "rgba(255,111,145,0.4)" },
};

/** Accent per partner role. */
export const ROLE_ACCENT = {
  creador: { hex: "#FF6F91", tintBg: "rgba(255,111,145,0.15)", tintBorder: "rgba(255,111,145,0.4)", checkinBg: "rgba(255,111,145,0.18)", checkinBorder: "rgba(255,111,145,0.5)" },
  invitado: { hex: "#8B7CFF", tintBg: "rgba(139,124,255,0.15)", tintBorder: "rgba(139,124,255,0.4)", checkinBg: "rgba(139,124,255,0.18)", checkinBorder: "rgba(139,124,255,0.5)" },
} as const;

/** Bottom navigation — "Comunicación" is labeled "Hablar" for space. */
export const NAV_ITEMS = [
  { key: "inicio", href: "/inicio", label: "Inicio", icon: "🏠", title: "Inicio" },
  { key: "citas", href: "/citas", label: "Citas", icon: "💗", title: "Citas" },
  { key: "calendario", href: "/calendario", label: "Calendario", icon: "🗓️", title: "Calendario" },
  { key: "gastos", href: "/gastos", label: "Gastos", icon: "💸", title: "Gastos" },
  { key: "comunicacion", href: "/comunicacion", label: "Hablar", icon: "💬", title: "Comunicación" },
] as const;

/** Progress-bar color by budget usage. */
export function budgetColor(pct: number): string {
  if (pct > 100) return "#FF6B6B";
  if (pct >= 70) return "#FFB84D";
  return "#3ED6B5";
}
