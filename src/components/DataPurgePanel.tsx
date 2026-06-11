"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/calculations";
import { FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import {
  describePurgeScope,
  getPurgePreview,
  type PurgePreview,
  type PurgeScope,
} from "@/lib/purge";
import type { Booking, Expense, Property } from "@/lib/types";
import { Button, Card, Field, Select } from "./ui";

export function DataPurgePanel({
  bookings,
  expenses,
  properties,
  onPurge,
  onSuccess,
}: {
  bookings: Booking[];
  expenses: Expense[];
  properties: Property[];
  onPurge: (scope: PurgeScope) => PurgePreview;
  onSuccess?: (preview: PurgePreview) => void;
}) {
  const [month, setMonth] = useState<number | "all">("all");
  const [propertyId, setPropertyId] = useState<string | "all">("all");
  const [includeBookings, setIncludeBookings] = useState(true);
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [confirming, setConfirming] = useState(false);

  const scope = useMemo<PurgeScope>(
    () => ({
      month,
      propertyId,
      includeBookings,
      includeExpenses,
    }),
    [month, propertyId, includeBookings, includeExpenses],
  );

  const preview = useMemo(
    () => getPurgePreview(bookings, expenses, scope),
    [bookings, expenses, scope],
  );

  const propertyName =
    propertyId === "all"
      ? ""
      : (properties.find((property) => property.id === propertyId)?.name ??
        propertyId);
  const monthLabel =
    month === "all" ? "" : (MONTH_LABELS[month - 1] ?? `Mese ${month}`);

  const nothingSelected = !includeBookings && !includeExpenses;
  const nothingToRemove = preview.bookings === 0 && preview.expenses === 0;

  function handlePurge() {
    if (nothingSelected || nothingToRemove) {
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

  return (
    <Card title="Pulizia dati selettiva">
      <p className="mb-4 text-sm text-rc-muted">
        Elimina incassi e spese aggregati per mese e appartamento, così puoi
        sostituirli in seguito con prenotazioni singole e notti reali. La
        configurazione (appartamenti, piattaforme, categorie) non viene toccata.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Mese">
          <Select
            value={String(month)}
            onChange={(event) => {
              const value = event.target.value;
              setMonth(value === "all" ? "all" : Number(value));
              setConfirming(false);
            }}
          >
            <option value="all">Tutti i mesi</option>
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Appartamento">
          <Select
            value={propertyId}
            onChange={(event) => {
              setPropertyId(event.target.value);
              setConfirming(false);
            }}
          >
            <option value="all">Tutti gli appartamenti</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 text-rc-ink">
          <input
            type="checkbox"
            checked={includeBookings}
            onChange={(event) => {
              setIncludeBookings(event.target.checked);
              setConfirming(false);
            }}
            className="accent-rc-gold"
          />
          Prenotazioni / incassi
        </label>
        <label className="flex items-center gap-2 text-rc-ink">
          <input
            type="checkbox"
            checked={includeExpenses}
            onChange={(event) => {
              setIncludeExpenses(event.target.checked);
              setConfirming(false);
            }}
            className="accent-rc-gold"
          />
          Spese
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-rc-gold/25 bg-rc-charcoal/70 px-4 py-3 text-sm">
        <p className="font-medium text-rc-gold-light">
          Anteprima FY{FISCAL_YEAR} —{" "}
          {describePurgeScope(scope, propertyName, monthLabel)}
        </p>
        <ul className="mt-2 space-y-1 text-rc-muted">
          <li>
            Prenotazioni da rimuovere:{" "}
            <span className="text-rc-ink">{preview.bookings}</span>
            {preview.bookings > 0 ? (
              <span> ({formatCurrency(preview.bookingTotal)})</span>
            ) : null}
          </li>
          <li>
            Spese da rimuovere:{" "}
            <span className="text-rc-ink">{preview.expenses}</span>
            {preview.expenses > 0 ? (
              <span> ({formatCurrency(preview.expenseTotal)})</span>
            ) : null}
          </li>
        </ul>
      </div>

      {confirming ? (
        <p className="mt-3 text-sm text-amber-300">
          Confermi la rimozione? L&apos;operazione non è annullabile. Clicca di
          nuovo per procedere.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="danger"
          disabled={nothingSelected || nothingToRemove}
          onClick={handlePurge}
        >
          {confirming ? "Conferma pulizia" : "Pulisci dati selezionati"}
        </Button>
        {confirming ? (
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Annulla
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
