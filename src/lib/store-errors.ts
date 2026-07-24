function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((part) => typeof part === "string" && part.trim().length > 0)
      .map((part) => String(part));

    if (parts.length > 0) {
      return parts.join(" — ");
    }
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Errore nel database condiviso.";
}

export function formatStoreError(error: unknown): string {
  const message = extractErrorMessage(error);

  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(message)) {
    return "Impossibile connettersi a Supabase. Il progetto potrebbe essere in pausa o eliminato: apri supabase.com, riattiva il progetto e controlla NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY su Vercel.";
  }

  if (/relation.*dashboard_data.*does not exist/i.test(message)) {
    return "Tabella dashboard_data mancante su Supabase. Apri SQL Editor ed esegui il file supabase/schema.sql del repository.";
  }

  if (
    /invalid api key|jwt|unauthorized|permission denied/i.test(message)
  ) {
    return "Chiavi Supabase non valide. Su Vercel verifica NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (chiave service_role, non anon).";
  }

  return message;
}
