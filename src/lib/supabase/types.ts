import type { createClient } from "@/lib/supabase/server";

/** The exact server Supabase client type produced by our factory. */
export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
