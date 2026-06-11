"use client";

import { formatCurrency } from "@/lib/calculations";
import { DataRow, DataTable, Money, Percent } from "./ui";

function formatCell(value: number) {
  return value > 0 ? formatCurrency(value) : "—";
}

export function VoiceListTable({
  title,
  description,
  headers,
  rows,
  total,
  totalLabel = "Totale",
}: {
  title: string;
  description?: string;
  headers: string[];
  rows: {
    id: string;
    name: string;
    total: number;
    share: number;
  }[];
  total: number;
  totalLabel?: string;
}) {
  return (
    <div>
      {description ? (
        <p className="mb-4 text-sm text-rc-muted">{description}</p>
      ) : null}
      <DataTable headers={headers}>
        {rows.map((row) => (
          <DataRow key={row.id}>
            <td className="px-2 py-2 font-medium text-rc-ink">{row.name}</td>
            <td className="px-2 py-2 text-right">
              <Money value={row.total} />
            </td>
            <td className="px-2 py-2 text-right">
              {row.total > 0 ? <Percent value={row.share} /> : "—"}
            </td>
          </DataRow>
        ))}
        <DataRow>
          <td className="px-2 py-2 font-semibold text-rc-gold-light">
            {totalLabel}
          </td>
          <td className="px-2 py-2 text-right font-semibold">
            <Money value={total} />
          </td>
          <td className="px-2 py-2 text-right font-semibold">
            {total > 0 ? <Percent value={1} /> : "—"}
          </td>
        </DataRow>
      </DataTable>
    </div>
  );
}

export function PropertyVoiceMatrix({
  rowLabel,
  columns,
  rows,
  rowTotal,
  totalColumnLabel = "Totale",
  valueTone = "neutral",
}: {
  rowLabel: string;
  columns: { id: string; name: string }[];
  rows: {
    id: string;
    name: string;
    total: number;
    values: { id: string; total: number }[];
  }[];
  rowTotal: (row: (typeof rows)[number]) => number;
  totalColumnLabel?: string;
  valueTone?: "income" | "expense" | "neutral";
}) {
  const valueClass =
    valueTone === "income"
      ? "text-rc-gold-light"
      : valueTone === "expense"
        ? "text-amber-400"
        : "text-rc-ink";

  const columnTotals = columns.map((column) =>
    rows.reduce(
      (sum, row) =>
        sum + (row.values.find((value) => value.id === column.id)?.total ?? 0),
      0,
    ),
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-rc-gold/35 text-left text-rc-gold-light/80">
            <th className="sticky left-0 z-10 min-w-[9rem] bg-rc-charcoal px-2 py-2 font-semibold uppercase tracking-wide">
              {rowLabel}
            </th>
            {columns.map((column) => (
              <th
                key={column.id}
                className="min-w-[5.5rem] px-2 py-2 text-right font-semibold uppercase tracking-wide"
              >
                {column.name}
              </th>
            ))}
            <th className="min-w-[5.5rem] px-2 py-2 text-right font-semibold uppercase tracking-wide">
              {totalColumnLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-rc-gold/15 transition hover:bg-rc-gold/8"
            >
              <td className="sticky left-0 z-10 bg-rc-charcoal px-2 py-2 font-medium text-rc-ink">
                {row.name}
              </td>
              {columns.map((column) => {
                const value =
                  row.values.find((item) => item.id === column.id)?.total ?? 0;
                return (
                  <td
                    key={`${row.id}-${column.id}`}
                    className={`px-2 py-2 text-right tabular-nums ${value > 0 ? valueClass : "text-rc-muted"}`}
                  >
                    {formatCell(value)}
                  </td>
                );
              })}
              <td className={`px-2 py-2 text-right font-medium tabular-nums ${valueClass}`}>
                {formatCell(rowTotal(row))}
              </td>
            </tr>
          ))}
          <tr className="border-t border-rc-gold/25 bg-rc-charcoal/40">
            <td className="sticky left-0 z-10 bg-rc-charcoal px-2 py-2 font-semibold text-rc-gold-light">
              Totale
            </td>
            {columnTotals.map((value, index) => (
              <td
                key={`total-${columns[index].id}`}
                className={`px-2 py-2 text-right font-semibold tabular-nums ${value > 0 ? valueClass : "text-rc-muted"}`}
              >
                {formatCell(value)}
              </td>
            ))}
            <td className={`px-2 py-2 text-right font-semibold tabular-nums ${valueClass}`}>
              {formatCell(columnTotals.reduce((sum, value) => sum + value, 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function MonthlyVoiceMatrix({
  rowLabel,
  columns,
  months,
  monthValues,
  monthTotal,
  columnTotals,
  valueTone = "neutral",
}: {
  rowLabel: string;
  columns: { id: string; name: string }[];
  months: { period: { month: number }; label: string }[];
  monthValues: (month: number) => { id: string; total: number }[];
  monthTotal: (month: number) => number;
  columnTotals: { id: string; total: number }[];
  valueTone?: "income" | "expense" | "neutral";
}) {
  const activeMonths = months.filter((month) => monthTotal(month.period.month) > 0);

  if (activeMonths.length === 0) {
    return (
      <p className="text-sm text-rc-muted">Nessun dato nel periodo selezionato.</p>
    );
  }

  const valueClass =
    valueTone === "income"
      ? "text-rc-gold-light"
      : valueTone === "expense"
        ? "text-amber-400"
        : "text-rc-ink";

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-rc-gold/35 text-left text-rc-gold-light/80">
            <th className="sticky left-0 z-10 min-w-[7rem] bg-rc-charcoal px-2 py-2 font-semibold uppercase tracking-wide">
              {rowLabel}
            </th>
            {columns.map((column) => (
              <th
                key={column.id}
                className="min-w-[5.5rem] px-2 py-2 text-right font-semibold uppercase tracking-wide"
              >
                {column.name}
              </th>
            ))}
            <th className="min-w-[5.5rem] px-2 py-2 text-right font-semibold uppercase tracking-wide">
              Totale
            </th>
          </tr>
        </thead>
        <tbody>
          {activeMonths.map((month) => (
            <tr
              key={month.label}
              className="border-b border-rc-gold/15 transition hover:bg-rc-gold/8"
            >
              <td className="sticky left-0 z-10 bg-rc-charcoal px-2 py-2 font-medium text-rc-ink">
                {month.label}
              </td>
              {columns.map((column) => {
                const value =
                  monthValues(month.period.month).find(
                    (item) => item.id === column.id,
                  )?.total ?? 0;
                return (
                  <td
                    key={`${month.label}-${column.id}`}
                    className={`px-2 py-2 text-right tabular-nums ${value > 0 ? valueClass : "text-rc-muted"}`}
                  >
                    {formatCell(value)}
                  </td>
                );
              })}
              <td className={`px-2 py-2 text-right font-medium tabular-nums ${valueClass}`}>
                {formatCell(monthTotal(month.period.month))}
              </td>
            </tr>
          ))}
          <tr className="border-t border-rc-gold/25 bg-rc-charcoal/40">
            <td className="sticky left-0 z-10 bg-rc-charcoal px-2 py-2 font-semibold text-rc-gold-light">
              Totale anno
            </td>
            {columns.map((column) => {
              const value =
                columnTotals.find((item) => item.id === column.id)?.total ?? 0;
              return (
                <td
                  key={`annual-${column.id}`}
                  className={`px-2 py-2 text-right font-semibold tabular-nums ${value > 0 ? valueClass : "text-rc-muted"}`}
                >
                  {formatCell(value)}
                </td>
              );
            })}
            <td className={`px-2 py-2 text-right font-semibold tabular-nums ${valueClass}`}>
              {formatCell(columnTotals.reduce((sum, item) => sum + item.total, 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
