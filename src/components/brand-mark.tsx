import { cn } from "@/lib/utils";

type BrandMarkProps = {
  /** Person A initial (creador — pink). */
  initialA: string;
  /** Person B initial (invitado — violet). */
  initialB: string;
  /** Circle diameter in px. 24 = app header, 26 = auth header, 52 = success. */
  size?: number;
  /** Dashed animated line (in progress) vs. solid line (bonded/complete). */
  line?: "dashed" | "solid";
  /** Show the "Nosotros" wordmark after the circles. */
  wordmark?: boolean;
  className?: string;
};

/**
 * The couple brand mark: two initialed circles joined by a connecting line.
 * Dashed + animated = "in progress"; solid = "completed / bonded".
 */
export function BrandMark({
  initialA,
  initialB,
  size = 24,
  line = "dashed",
  wordmark = false,
  className,
}: BrandMarkProps) {
  const fontSize = size >= 52 ? 20 : size >= 26 ? 12 : 11;
  const lineWidth = size >= 52 ? 40 : size >= 26 ? 26 : 20;

  const circle = (initial: string, hex: string, tintBg: string, tintBorder: string) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-fraunces), serif",
        fontStyle: "italic",
        fontWeight: 600,
        fontSize,
        color: hex,
        background: tintBg,
        border: `1px solid ${tintBorder}`,
      }}
    >
      {initial}
    </div>
  );

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {circle(
        initialA,
        "#FF6F91",
        line === "solid" ? "rgba(255,111,145,0.18)" : "rgba(255,111,145,0.15)",
        line === "solid" ? "rgba(255,111,145,0.5)" : "rgba(255,111,145,0.4)",
      )}
      {line === "solid" ? (
        <svg width={lineWidth} height="4" viewBox={`0 0 ${lineWidth} 4`} aria-hidden>
          <line x1="0" y1="2" x2={lineWidth} y2="2" stroke="#8B7CFF" strokeWidth="3" />
        </svg>
      ) : (
        <svg width={lineWidth} height="8" viewBox={`0 0 ${lineWidth} 8`} aria-hidden>
          <line
            x1="0"
            y1="4"
            x2={lineWidth}
            y2="4"
            stroke="#A79FBD"
            strokeWidth="2"
            strokeDasharray="4 4"
            style={{ animation: "dashMove 1.4s linear infinite" }}
          />
        </svg>
      )}
      {circle(
        initialB,
        "#8B7CFF",
        line === "solid" ? "rgba(139,124,255,0.18)" : "rgba(139,124,255,0.15)",
        line === "solid" ? "rgba(139,124,255,0.5)" : "rgba(139,124,255,0.4)",
      )}
      {wordmark && (
        <span className="ml-1.5 text-[13px] tracking-[0.02em] text-ink-secondary">
          Nosotros
        </span>
      )}
    </div>
  );
}
