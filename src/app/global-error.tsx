"use client";

import { useEffect } from "react";

/**
 * Last resort: the root layout itself failed. This replaces it, so it must render
 * its own <html> and <body>, and cannot rely on globals.css having loaded.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#12101A",
          color: "#EDE9F5",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h2 style={{ fontSize: 20, margin: 0 }}>Algo se nos cayó</h2>
        <p style={{ fontSize: 14, opacity: 0.7, margin: 0, maxWidth: 280 }}>
          No fue culpa de ustedes. Vuelvan a intentarlo en un momento.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8,
            padding: "12px 32px",
            borderRadius: 999,
            border: "none",
            background: "#FF6F91",
            color: "#12101A",
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
