"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/calculations";
import { MONTH_LABELS } from "@/lib/constants";
import type { TransactionFilters } from "@/lib/filters";
import {
  buildMonthPropertyPurgeScope,
  getPurgePreview,
  type PurgePreview,
  type PurgeScope,
} from "@/lib/purge";
import type { Booking, Expense } from "@/lib/types";
import { Button } from "./ui";

export function MonthPropertyPurgeAction({
  filters,
  bookings,
  expenses,
  propertyName,
  onPurge,
  onSuccess,
}: {
  filters: TransactionFilters;
  bookings: Booking[];
  expenses: Expense[];
  propertyName: string;
  onPurge: (scope: PurgeScope) => PurgePreview;
  onSuccess?: (preview: PurgePreview) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const canPurge =
    filters.month !== "all" && filters.propertyId !== "all";

  const scope = useMemo(
    () =>
      canPurge
        ? buildMonthPropertyPurgeScope(filters.month as number, filters.propertyId)
        : null,
    [canPurge, filters.month, filters.propertyId],
  );

  const preview = useMemo(
    () =>
      scope
        ? getPurgePreview(bookings, expenses, scope)
        : { bookings: 0, expenses: 0, bookingTotal: 0, expenseTotal: 0 },
    [bookings, expenses, scope],
  );

  const monthLabel =
    filters.month === "all"
      ? ""
      : (MONTH_LABELS[filters.month - 1] ?? `Mese ${filters.month}`);

  const nothingToRemove = preview.bookings === 0 && preview.expenses === 0;

  function handlePurge() {
    if (!scope || nothingToRemove) {
      return;
    }

    if (!confirming) {
      setConfirming(true);
      return;
    }

    const removed = onPurge(scope);
    setConfirming(false);
    onSuccess?.(removed);
  }

  if (!canPurge) {
    return (
      <p className="mt-4 text-xs text-rc-muted">
        Per eliminare tutti gli incassi e le spese di un mese, seleziona un
        <strong className="text-rc-ink"> appartamento</strong> e un
        <strong className="text-rc-ink"> mese</strong> specifici (non
        «Tutti»).
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-rose-500/25 bg-rose-950/20 px-4 py-3">
      <p className="text-sm font-medium text-rose-100">
        Svuota {propertyName} · {monthLabel}
      </p>
      <p className="mt-1 text-sm text-rc-muted">
        Rimuove{" "}
        <strong className="text-rc-ink">{preview.bookings}</strong> prenotazioni
        ({formatCurrency(preview.bookingTotal)}) e{" "}
        <strong className="text-rc-ink">{preview.expenses}</strong> spese (
        {formatCurrency(preview.expenseTotal)}), incluse IVA/commissioni/pulizie
        collegate alle prenotazioni.
      </p>
      {confirming ? (
        <p className="mt-2 text-sm text-amber-200">
          Confermi? L&apos;operazione non è annullabile.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="danger"
          disabled={nothingToRemove}
          onClick={handlePurge}
        >
          {confirming
            ? "Conferma eliminazione totale"
            : "Elimina incassi e spese del periodo"}
        </Button>
        {confirming ? (
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Annulla
          </Button>
        ) : null}
      </div>
    </div>
  );
}
