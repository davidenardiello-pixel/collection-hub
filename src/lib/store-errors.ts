export function formatStoreError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Errore nel database condiviso.";

  if (/fetch failed/i.test(message)) {
    return "Impossibile connettersi a Supabase. Il progetto potrebbe essere stato eliminato o sospeso: controlla NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY su Vercel.";
  }

  return message;
}
