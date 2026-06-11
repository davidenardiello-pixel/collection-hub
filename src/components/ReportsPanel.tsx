"use client";

import { useMemo, useState } from "react";
import { FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import {
  downloadAnnualSummaryReport,
  downloadBookingsReport,
  downloadExpensesReport,
  downloadFullReport,
  downloadPropertiesReport,
  getReportFilterLabel,
  getReportPreviewCounts,
  openPrintableReport,
  type ReportFilter,
} from "@/lib/reports";
import type {
  Booking,
  Expense,
  ExpenseCategory,
  Platform,
  Property,
} from "@/lib/types";
import { Card, Field, Select } from "./ui";

export function ReportsPanel({
  bookings,
  expenses,
  properties,
  platforms,
  expenseCategories,
  profitTargets,
  onMessage,
}: {
  bookings: Booking[];
  expenses: Expense[];
  properties: Property[];
  platforms: Platform[];
  expenseCategories: ExpenseCategory[];
  profitTargets: number[];
  onMessage?: (text: string) => void;
}) {
  const [month, setMonth] = useState<number | "all">("all");
  const [propertyId, setPropertyId] = useState<string | "all">("all");

  const filter = useMemo<ReportFilter>(
    () => ({ month, propertyId }),
    [month, propertyId],
  );

  const preview = useMemo(
    () => getReportPreviewCounts(bookings, expenses, filter),
    [bookings, expenses, filter],
  );

  const filterLabel = getReportFilterLabel(filter, properties);
  const hasFilter = month !== "all" || propertyId !== "all";

  function notify(text: string) {
    onMessage?.(text);
  }

  return (
    <Card title={`Report scaricabili FY${FISCAL_YEAR}`}>
      <p className="mb-4 text-sm text-rc-muted">
        Esporta i dati in CSV (apribili con Excel o Numbers) o genera un report
        stampabile da salvare in PDF. Puoi filtrare per mese e appartamento come
        nella pulizia dati.
      </p>

      <div className="mb-5 grid gap-4 rounded-xl border border-rc-gold/20 bg-rc-charcoal/40 p-4 sm:grid-cols-2">
        <Field label="Mese">
          <Select
            value={String(month)}
            onChange={(event) => {
              const value = event.target.value;
              setMonth(value === "all" ? "all" : Number(value));
            }}
          >
            <option value="all">Tutti i mesi</option>
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={String(index + 1)}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Appartamento">
          <Select
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
          >
            <option value="all">Tutti gli appartamenti</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-sm text-rc-muted sm:col-span-2">
          {hasFilter ? (
            <>
              <span className="text-rc-gold-light">{filterLabel}</span>
              {" · "}
              {preview.bookings} prenotazioni, {preview.expenses} spese incluse
            </>
          ) : (
            <>Nessun filtro: report su tutti i dati FY{FISCAL_YEAR}.</>
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ReportButton
          title="Panoramica mensile"
          description="Incassi, spese, profitto e obiettivi mese per mese."
          onClick={() => {
            downloadAnnualSummaryReport(
              bookings,
              expenses,
              properties,
              profitTargets,
              filter,
            );
            notify("Report panoramica mensile scaricato.");
          }}
        />
        <ReportButton
          title="Prenotazioni"
          description="Elenco con notti, piattaforma e importi nel filtro attivo."
          onClick={() => {
            downloadBookingsReport(
              bookings,
              expenses,
              properties,
              platforms,
              filter,
            );
            notify("Report prenotazioni scaricato.");
          }}
        />
        <ReportButton
          title="Spese"
          description="Spese con proprietà e categoria nel filtro attivo."
          onClick={() => {
            downloadExpensesReport(
              bookings,
              expenses,
              properties,
              expenseCategories,
              filter,
            );
            notify("Report spese scaricato.");
          }}
        />
        <ReportButton
          title="Per proprietà"
          description="Totali e profitto mensile per gli appartamenti nel filtro."
          onClick={() => {
            downloadPropertiesReport(
              bookings,
              expenses,
              properties,
              expenseCategories,
              platforms,
              filter,
            );
            notify("Report proprietà scaricato.");
          }}
        />
        <ReportButton
          title="Report completo"
          description="Un unico CSV con tutte le sezioni nel filtro attivo."
          onClick={() => {
            downloadFullReport(
              bookings,
              expenses,
              properties,
              platforms,
              expenseCategories,
              profitTargets,
              filter,
            );
            notify("Report completo scaricato.");
          }}
        />
        <ReportButton
          title="PDF / Stampa"
          description="Report annuale filtrato, pronto per stampa o Salva come PDF."
          onClick={() => {
            const opened = openPrintableReport(
              bookings,
              expenses,
              properties,
              profitTargets,
              filter,
            );
            notify(
              opened
                ? "Report aperto in una nuova scheda."
                : "Abilita i popup del browser per stampare il report.",
            );
          }}
        />
      </div>
    </Card>
  );
}

function ReportButton({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-rc-gold/25 bg-rc-charcoal/50 p-4 text-left transition hover:border-rc-gold/45 hover:bg-rc-charcoal"
    >
      <p className="font-semibold text-rc-gold-light">{title}</p>
      <p className="mt-1 text-xs text-rc-muted">{description}</p>
    </button>
  );
}
