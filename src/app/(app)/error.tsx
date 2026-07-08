"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Catches render failures of the six authenticated screens. It lives inside the
 * (app) group, so AppHeader and BottomNav survive: the user stays in the app.
 * A toast cannot cover this — by the time this renders, no client component of
 * the failed screen is mounted.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 text-[34px]" aria-hidden="true">🌧️</div>
      <h2 className="mb-2 font-serif text-[20px] text-ink">Algo se nos cayó</h2>
      <p className="mb-6 max-w-[260px] text-[13.5px] leading-[1.5] text-ink-tertiary">
        No fue culpa de ustedes. Vuelvan a intentarlo en un momento.
      </p>
      <button
        onClick={() => {
          // reset() only clears the boundary's state and re-renders the same RSC
          // payload, which still carries the rejection. router.refresh() fetches a
          // fresh one; both must sit in the same transition so reset() does not
          // re-render the stale payload before the refetch lands.
          startTransition(() => {
            router.refresh();
            reset();
          });
        }}
        className="btn-primary px-8"
      >
        Reintentar
      </button>
    </div>
  );
}
