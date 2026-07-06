"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { complete, setIntent, type Intent } from "@/lib/onboarding-core";

type Credentials = { nombre: string; correo: string; pass: string };

/** UI outcome of a begin* action. */
export type BeginResult =
  | { status: "confirm"; email: string } // email sent, awaiting confirmation
  | { status: "done"; role: "creador" | "invitado" } // completed (confirmation off / already signed in)
  | { status: "error"; error: string };

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Ese correo ya tiene una cuenta. Confírmalo desde tu correo o usa otro.";
  if (m.includes("rate limit"))
    return "Demasiados intentos por ahora. Esperen un momento e inténtenlo de nuevo.";
  if (m.includes("password")) return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("email")) return "Revisa el correo — no parece válido.";
  return "No pudimos crear la cuenta. Inténtalo de nuevo.";
}

async function appOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Signs the user up. With email confirmation ON (this project) there is no
 * session yet, so we stash the intent and ask them to confirm — onboarding is
 * completed later by the /auth/confirm route. With confirmation OFF (or if the
 * user is already signed in but unpaired), we complete immediately.
 */
async function begin(input: Credentials, intent: Intent): Promise<BeginResult> {
  const supabase = await createClient();
  const email = input.correo.trim();

  const {
    data: { user: existing },
  } = await supabase.auth.getUser();
  if (existing) {
    const res = await complete(supabase, existing.id, intent);
    return res;
  }

  const origin = await appOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.pass,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) return { status: "error", error: friendlyAuthError(error.message) };

  if (data.session && data.user) {
    return complete(supabase, data.user.id, intent);
  }

  await setIntent(intent);
  return { status: "confirm", email };
}

export async function beginCreate(input: Credentials): Promise<BeginResult> {
  return begin(input, { kind: "create", nombre: input.nombre });
}

export async function beginJoin(
  input: Credentials & { code: string },
): Promise<BeginResult> {
  return begin(input, { kind: "join", nombre: input.nombre, code: input.code });
}

/** Result of a returning-user sign-in. */
export type SignInResult =
  | { status: "app" } // authenticated and already paired → go to the app
  | { status: "onboarding" } // authenticated but not paired yet → finish onboarding
  | { status: "error"; error: string };

/** Signs a returning user in with email + password. */
export async function signIn(input: {
  correo: string;
  pass: string;
}): Promise<SignInResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.correo.trim(),
    password: input.pass,
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("not confirmed") || m.includes("confirm"))
      return {
        status: "error",
        error: "Aún no confirmas tu correo — revisa tu bandeja (y el spam).",
      };
    if (m.includes("invalid") || m.includes("credentials"))
      return { status: "error", error: "Correo o contraseña incorrectos." };
    if (m.includes("rate limit"))
      return { status: "error", error: "Demasiados intentos. Esperen un momento." };
    return { status: "error", error: "No pudimos iniciar sesión. Inténtalo de nuevo." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("couple_id")
    .eq("id", data.user.id)
    .maybeSingle();

  return { status: profile?.couple_id ? "app" : "onboarding" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
