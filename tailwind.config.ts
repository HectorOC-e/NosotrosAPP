import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "480px" }, // mobile-first shell
    },
    extend: {
      colors: {
        // ── Design-system brand tokens ──────────────────────────────
        bg: "#120F17",
        overlay: "#1B1626",
        rosa: "#FF6F91", // creador
        violeta: "#8B7CFF", // invitado
        teal: "#3ED6B5", // positivo
        amber: "#FFB84D",
        alert: "#FF6B6B",
        ink: {
          DEFAULT: "#F2EEF9", // texto
          secondary: "#A79FBD", // texto secundario
          tertiary: "#6b6380", // texto terciario
        },
        // ── shadcn/ui semantic tokens (mapped to the palette) ───────
        border: "#2A2435",
        input: "#2A2435",
        ring: "#8B7CFF",
        background: "#120F17",
        foreground: "#F2EEF9",
        primary: { DEFAULT: "#FF6F91", foreground: "#120F17" },
        secondary: { DEFAULT: "#1B1626", foreground: "#F2EEF9" },
        destructive: { DEFAULT: "#FF6B6B", foreground: "#120F17" },
        muted: { DEFAULT: "#1B1626", foreground: "#A79FBD" },
        accent: { DEFAULT: "#8B7CFF", foreground: "#120F17" },
        popover: { DEFAULT: "#1B1626", foreground: "#F2EEF9" },
        card: { DEFAULT: "#1B1626", foreground: "#F2EEF9" },
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      borderRadius: {
        lg: "1rem",
        md: "0.75rem",
        sm: "0.5rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
