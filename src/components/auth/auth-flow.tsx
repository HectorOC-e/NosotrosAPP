"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { LabeledField } from "@/components/ui/labeled-field";
import { beginCreate, beginJoin, type BeginResult } from "@/lib/actions/onboarding";

type Step = "choice" | "create" | "join" | "confirm";

const LINK_ERROR =
  "Ese enlace no funcionó o expiró. Vuelvan a crear el espacio o unirse.";

export function AuthFlow({ linkError = false }: { linkError?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choice");
  const [pending, startTransition] = useTransition();

  const [createNombre, setCreateNombre] = useState("");
  const [createCorreo, setCreateCorreo] = useState("");
  const [createPass, setCreatePass] = useState("");

  const [joinNombre, setJoinNombre] = useState("");
  const [joinCorreo, setJoinCorreo] = useState("");
  const [joinPass, setJoinPass] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState<string | null>(linkError ? LINK_ERROR : null);

  function handleResult(res: BeginResult) {
    if (res.status === "confirm") {
      setConfirmEmail(res.email);
      setStep("confirm");
    } else if (res.status === "done") {
      router.push("/bienvenida");
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      handleResult(
        await beginCreate({
          nombre: createNombre,
          correo: createCorreo,
          pass: createPass,
        }),
      );
    });
  }

  function submitJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      handleResult(
        await beginJoin({
          nombre: joinNombre,
          correo: joinCorreo,
          pass: joinPass,
          code: joinCode,
        }),
      );
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-[22px] pb-10 pt-7">
      <BrandMark initialA="" initialB="" size={26} wordmark className="mb-9" />

      {step === "choice" && (
        <>
          <h1 className="mb-2.5 font-serif text-[32px] font-medium italic leading-[1.15] text-ink">
            Un espacio para los dos
          </h1>
          <p className="mb-8 text-[15px] leading-[1.5] text-ink-secondary">
            Citas, calendario, gastos y comunicación — todo compartido entre
            ustedes dos.
          </p>
          {error && <ErrorPanel className="mb-4">{error}</ErrorPanel>}
          <div className="flex flex-col gap-3.5">
            <button
              onClick={() => {
                setError(null);
                setStep("create");
              }}
              className="glass flex flex-col gap-1.5 rounded-3xl border-rosa/35 bg-rosa/[0.08] p-[22px_20px] text-left transition hover:bg-rosa/[0.14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosa"
            >
              <span className="font-serif text-[19px] italic text-ink">
                Crear nuestro espacio
              </span>
              <span className="text-[13.5px] text-ink-secondary">
                Empiecen de cero y luego invitas a tu pareja
              </span>
            </button>
            <button
              onClick={() => {
                setError(null);
                setStep("join");
              }}
              className="glass flex flex-col gap-1.5 rounded-3xl border-violeta/35 bg-violeta/[0.08] p-[22px_20px] text-left transition hover:bg-violeta/[0.14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violeta"
            >
              <span className="font-serif text-[19px] italic text-ink">
                Unirme con un código
              </span>
              <span className="text-[13.5px] text-ink-secondary">
                Tu pareja ya creó el espacio y te compartió un código
              </span>
            </button>
          </div>
        </>
      )}

      {step === "create" && (
        <>
          <BackLink onClick={() => setStep("choice")} />
          <h2 className="mb-1.5 font-serif text-[26px] font-medium italic text-ink">
            Crear nuestro espacio
          </h2>
          <p className="mb-[26px] text-[14px] text-ink-secondary">
            Te enviaremos un correo para confirmar y luego te damos el código
            para invitar a tu pareja.
          </p>
          <form onSubmit={submitCreate} className="flex flex-col gap-4">
            <LabeledField
              label="Tu nombre"
              required
              value={createNombre}
              onChange={(e) => setCreateNombre(e.target.value)}
              placeholder="¿Cómo te dicen?"
            />
            <LabeledField
              label="Correo"
              type="email"
              required
              value={createCorreo}
              onChange={(e) => setCreateCorreo(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
            />
            <LabeledField
              label="Contraseña"
              type="password"
              required
              minLength={8}
              value={createPass}
              onChange={(e) => setCreatePass(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            {error && <ErrorPanel>{error}</ErrorPanel>}
            <Button type="submit" disabled={pending} className="mt-2.5 py-4">
              {pending ? "Creando…" : "Crear nuestro espacio"}
            </Button>
          </form>
        </>
      )}

      {step === "join" && (
        <>
          <BackLink onClick={() => setStep("choice")} />
          <h2 className="mb-1.5 font-serif text-[26px] font-medium italic text-ink">
            Unirme con un código
          </h2>
          <p className="mb-6 text-[14px] text-ink-secondary">
            Pide el código a tu pareja — se lo mostramos cuando creó el espacio.
          </p>
          <form onSubmit={submitJoin} className="flex flex-col gap-4">
            <LabeledField
              label="Tu nombre"
              required
              value={joinNombre}
              onChange={(e) => setJoinNombre(e.target.value)}
              placeholder="¿Cómo te dicen?"
            />
            <LabeledField
              label="Correo"
              type="email"
              required
              value={joinCorreo}
              onChange={(e) => setJoinCorreo(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
            />
            <LabeledField
              label="Contraseña"
              type="password"
              required
              minLength={8}
              value={joinPass}
              onChange={(e) => setJoinPass(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-ink-secondary">
                Código de invitación
              </span>
              <input
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="EJ. LUNA284"
                className="tnum rounded-[14px] border border-violeta/40 bg-violeta/[0.08] p-4 text-[17px] uppercase tracking-[0.08em] text-violeta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violeta"
              />
              <span className="text-[12px] text-ink-tertiary">
                Pídeselo a tu pareja tal como se lo mostramos 💜
              </span>
            </label>
            {error && <ErrorPanel>{error}</ErrorPanel>}
            <Button type="submit" disabled={pending} className="mt-1.5 py-4">
              {pending ? "Enviando…" : "Unirme"}
            </Button>
          </form>
        </>
      )}

      {step === "confirm" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-[22px] py-5 text-center">
          <span className="text-4xl">💌</span>
          <h2 className="font-serif text-[26px] font-medium italic text-ink">
            Revisen su correo
          </h2>
          <p className="m-0 max-w-[300px] text-[14.5px] leading-[1.5] text-ink-secondary">
            Enviamos un enlace de confirmación a{" "}
            <span className="text-ink">{confirmEmail}</span>. Ábranlo desde este
            mismo dispositivo para terminar de crear su espacio.
          </p>
          <p className="m-0 max-w-[300px] text-[12.5px] text-ink-tertiary">
            ¿No lo ven? Revisen spam, o esperen un momento y vuelvan a intentarlo.
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setError(null);
              setStep("choice");
            }}
            className="w-full py-3.5 text-[14.5px]"
          >
            Volver al inicio
          </Button>
        </div>
      )}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-[18px] self-start py-1.5 text-[14px] text-ink-secondary transition hover:text-ink"
    >
      ← Volver
    </button>
  );
}

function ErrorPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[14px] border border-alert/35 bg-alert/[0.12] px-4 py-3.5 text-[13.5px] text-alert ${className}`}
    >
      {children}
    </div>
  );
}
