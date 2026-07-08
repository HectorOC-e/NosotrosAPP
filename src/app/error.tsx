"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Catches render failures of the root segment's children — including a throw in
 * (app)/layout.tsx, which (app)/error.tsx cannot catch: in Next, an error.tsx
 * does not cover the layout of its own segment. Also covers /login, /bienvenida
 * and /. The root layout survives, so the design system's classes are available.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-[34px]" aria-hidden="true">
        🌧️
      </div>
      <h2 className="mb-2 font-serif text-[20px] text-ink">Algo se nos cayó</h2>
      <p className="mb-6 max-w-[260px] text-[13.5px] leading-[1.5] text-ink-tertiary">
        No fue culpa de ustedes. Vuelvan a intentarlo en un momento.
      </p>
      <button
        onClick={() => {
          // reset() only clears the boundary's state and re-renders the same RSC
          // payload, which still carries the rejection. Refetch it first.
          router.refresh();
          reset();
        }}
        className="btn-primary px-8"
      >
        Reintentar
      </button>
    </div>
  );
}
