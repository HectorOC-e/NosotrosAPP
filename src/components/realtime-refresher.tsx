"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Live sync between the two partners. This app keeps no client-side store — pages
 * are Server Components refreshed by revalidatePath — so Realtime carries no data.
 * It only says "something in your couple changed", and we refetch.
 *
 * One private channel per couple. The RLS policy on realtime.messages is what keeps
 * other couples out; see the migration. Realtime is additive: if the channel never
 * subscribes, the app still works exactly as before, refreshing on navigation.
 */
export function RealtimeRefresher({
  coupleId,
  userId,
}: {
  coupleId: string;
  userId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`couple:${coupleId}`, {
      config: { private: true },
    });

    // Deleting a cita cascades to its expenses: one trigger per row. Coalesce them.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    let firstSubscribe = true;

    channel
      .on("broadcast", { event: "cambio" }, ({ payload }) => {
        // The actor already refreshed through revalidatePath.
        if (payload?.actor === userId) return;
        refreshSoon();
      })
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          // A reconnect means we missed every event in the gap. Catch up once.
          // Skipped on the first subscribe: the page was just server-rendered.
          if (!firstSubscribe) router.refresh();
          firstSubscribe = false;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("realtime:", status, err);
        }
      });

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [coupleId, userId, router]);

  return null;
}
