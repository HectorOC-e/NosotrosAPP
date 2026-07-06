// Locale-aware formatters — Honduras (es-HN), Lempiras.

/** Parses a DB `date` (YYYY-MM-DD) as a local calendar day, avoiding TZ shift. */
export function parseDbDate(d: string): Date {
  return new Date(`${d}T00:00:00`);
}

/** "12 jul" */
export function fmtDateShort(d: Date): string {
  return d.toLocaleDateString("es-HN", { day: "numeric", month: "short" });
}

/** Whole days from today (local) to `d`; negative = past. */
export function daysUntil(d: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86_400_000);
}

/** "hoy" · "mañana" · "ayer" · "en N días" · "hace N días" */
export function relLabel(d: Date): string {
  const diff = daysUntil(d);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff < 0) return `hace ${-diff} días`;
  return `en ${diff} días`;
}

/** "Lunes, 6 de julio" (capitalized). */
export function todayLongLabel(now: Date = new Date()): string {
  const s = now.toLocaleDateString("es-HN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Thousands-separated amount, e.g. 2940 -> "2,940". */
export function money(n: number): string {
  return n.toLocaleString("es-HN");
}

/** Local YYYY-MM-DD (for <input type="date"> and DB writes). */
export function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** First grapheme of a name, uppercased — for the brand-mark circles. */
export function initialOf(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "·";
}
