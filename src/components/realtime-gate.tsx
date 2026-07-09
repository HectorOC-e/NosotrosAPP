"use client";

import dynamic from "next/dynamic";

/**
 * Loads the Realtime client after hydration. Importing it statically would pull
 * realtime-js and phoenix into the initial bundle of every authenticated screen
 * (+64 kB gzip, measured) for a component that renders null and contributes
 * nothing to the first paint.
 */
const RealtimeRefresher = dynamic(
  () => import("./realtime-refresher").then((m) => m.RealtimeRefresher),
  { ssr: false },
);

export function RealtimeGate(props: { coupleId: string; userId: string }) {
  return <RealtimeRefresher {...props} />;
}
