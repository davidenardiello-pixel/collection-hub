"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BrandTitle } from "@/components/BrandTitle";
import { Button, Card, Field, Input } from "@/components/ui";
import { BRAND } from "@/lib/brand";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingMode, setCheckingMode] = useState(true);

  useEffect(() => {
    void fetch("/api/config")
      .then((response) => response.json())
      .then((body: { cloud?: boolean }) => {
        if (!body.cloud) {
          router.replace("/");
        }
      })
      .finally(() => setCheckingMode(false));
  }, [router]);

  if (checkingMode) {
    return (
      <div className="flex min-h-screen items-center justify-center text-rc-muted">
        Verifica accesso...
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Accesso non riuscito.");
        return;
      }

      const next = searchParams.get("next") || "/";
      router.replace(next);
      router.refresh();
    } catch {
      setError("Impossibile contattare il server. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center rc-main-pattern px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/brand/logo-mark.png"
            alt={BRAND.name}
            width={120}
            height={120}
            className="h-24 w-24 object-contain"
            priority
          />
          <BrandTitle size="sm" showTagline />
          <p className="text-sm text-rc-muted">
            Accesso condiviso per il team {BRAND.product.replace("+", "")}+
          </p>
        </div>

        <Card title="Accedi alla dashboard">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field label="Password di team">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Inserisci la password condivisa"
                required
                autoComplete="current-password"
              />
            </Field>

            {error ? (
              <p className="rounded-xl border border-rose-500/35 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Accesso in corso..." : "Entra in Collection Hub+"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-rc-muted">
          Caricamento accesso...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
