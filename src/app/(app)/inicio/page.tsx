import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveBudget, getSessionContext } from "@/lib/queries";
import { derivePartners } from "@/lib/partners";
import {
  parseDbDate,
  fmtDateShort,
  relLabel,
  daysUntil,
  todayLongLabel,
  money,
} from "@/lib/format";
import { budgetColor, EMOJI_PLACEHOLDER } from "@/lib/constants";

export default async function InicioPage() {
  const supabase = await createClient();
  const ctx = await getSessionContext();
  const { personA, personB } = derivePartners(ctx!);
  const selfName = ctx!.profile?.display_name ?? "";

  // ── Próximo pendiente ──
  const { data: events } = await supabase
    .from("events")
    .select("title, event_date, done")
    .eq("done", false)
    .not("event_date", "is", null);
  const upcoming = (events ?? [])
    .map((e) => ({ title: e.title, date: parseDbDate(e.event_date as string) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const proximo =
    upcoming.find((e) => daysUntil(e.date) >= 0) ?? upcoming[0] ?? null;

  // ── Presupuesto activo ──
  const budget = await getActiveBudget(supabase);
  const { data: exp } = budget
    ? await supabase.from("expenses").select("amount").eq("budget_id", budget.id)
    : { data: [] as { amount: number }[] };
  const spent = (exp ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const limit = budget ? Number(budget.limit_amount) : 0;
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const barColor = budgetColor(pct);

  let citaIdeaText: string | null = null;
  if (budget?.date_idea_id) {
    const { data: citaIdea } = await supabase
      .from("date_ideas")
      .select("text")
      .eq("id", budget.date_idea_id)
      .maybeSingle();
    citaIdeaText = citaIdea?.text ?? null;
  }
  const isCita = !!budget?.date_idea_id;

  // ── Check-in de hoy ──
  const today = new Date().toISOString().slice(0, 10);
  const { data: moods } = await supabase
    .from("moods")
    .select("profile_id, mood_emoji")
    .eq("mood_date", today);
  const emojiFor = (id: string | null) =>
    moods?.find((m) => m.profile_id === id)?.mood_emoji ?? null;
  const emojiA = emojiFor(personA.id);
  const emojiB = emojiFor(personB.id);
  const checkinIncomplete = !emojiA || !emojiB;

  return (
    <div>
      <h1 className="mb-1 font-serif text-[24px] font-medium italic text-ink">
        Hola, {selfName}
      </h1>
      <p className="mb-[22px] text-[13.5px] text-ink-secondary">{todayLongLabel()}</p>

      <div className="flex flex-col gap-3.5">
        {/* Próximo pendiente */}
        <div className="glass rounded-[22px] px-5 py-[18px]">
          <div className="eyebrow mb-2">PRÓXIMO PENDIENTE</div>
          {proximo ? (
            <>
              <div className="mb-1 text-[16px] text-ink">{proximo.title}</div>
              <div className="tnum text-[13px] text-teal">
                {fmtDateShort(proximo.date)} · {relLabel(proximo.date)}
              </div>
            </>
          ) : (
            <div className="text-[14.5px] text-ink-secondary">
              No tienen pendientes por ahora — agreguen uno en Calendario.
            </div>
          )}
        </div>

        {/* Salida / cita activa */}
        <div className="glass rounded-[22px] px-5 py-[18px]">
          <div className="mb-2.5 flex items-baseline justify-between">
            <div className="eyebrow">{isCita ? "CITA ACTUAL" : "PRESUPUESTO ACTIVO"}</div>
            {budget && (
              <div className="tnum text-[12.5px]" style={{ color: barColor }}>
                {Math.round(pct)}%
              </div>
            )}
          </div>
          {budget ? (
            <>
              <div className="mb-1 text-[15.5px] text-ink">{budget.label}</div>
              {isCita && citaIdeaText && (
                <div className="mb-2.5 text-[12px] leading-[1.4] text-ink-tertiary">
                  {citaIdeaText}
                </div>
              )}
              {!isCita && <div className="mb-2.5" />}
              <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, pct)}%`, background: barColor }}
                />
              </div>
              <div className="tnum text-[12.5px] text-ink-secondary">
                L {money(spent)} de L {money(limit)}
              </div>
            </>
          ) : (
            <div className="text-[14.5px] text-ink-secondary">
              Aún no tienen una salida activa — empiecen una cita o defínanla en Gastos.
            </div>
          )}
        </div>

        {/* Cómo se sienten hoy */}
        <div className="glass rounded-[22px] px-5 py-[18px]">
          <div className="eyebrow mb-3">CÓMO SE SIENTEN HOY</div>
          <div className="flex gap-3.5">
            <MoodPanel name={personA.name} emoji={emojiA} tint="rgba(255,111,145,0.07)" />
            <MoodPanel name={personB.name} emoji={emojiB} tint="rgba(139,124,255,0.07)" />
          </div>
          {checkinIncomplete && (
            <Link
              href="/comunicacion"
              className="btn-ghost mt-3 block w-full py-[11px] text-center text-[13.5px]"
            >
              Registrar cómo se sienten →
            </Link>
          )}
        </div>

        {/* Shortcut a Citas */}
        <Link
          href="/citas"
          className="flex flex-col gap-1 rounded-[22px] border border-rosa/30 p-5 text-left backdrop-blur-[20px] transition hover:brightness-110"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,111,145,0.14), rgba(139,124,255,0.14))",
          }}
        >
          <span className="font-serif text-[17px] italic text-ink">
            ¿Sin planes hoy?
          </span>
          <span className="text-[13.5px] text-ink-secondary">
            Pide una idea de cita →
          </span>
        </Link>
      </div>
    </div>
  );
}

function MoodPanel({
  name,
  emoji,
  tint,
}: {
  name: string;
  emoji: string | null;
  tint: string;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl p-3"
      style={{ background: tint }}
    >
      <span className="text-[26px]">{emoji ?? EMOJI_PLACEHOLDER}</span>
      <span className="text-[12px] text-ink-secondary">{name}</span>
    </div>
  );
}
