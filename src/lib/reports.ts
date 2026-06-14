import { BRAND } from "./brand";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  getAnnualSummary,
  getBookingNights,
  getBookingTotal,
  getMonthlySummaries,
  getPropertySummary,
} from "./calculations";
import { FISCAL_YEAR, MONTH_LABELS } from "./constants";
import { downloadTextFile } from "./download";
import { filterBookings, filterExpenses } from "./filters";
import { describePurgeScope } from "./purge";
import type {
  Booking,
  Expense,
  ExpenseCategory,
  Platform,
  Property,
} from "./types";

function escapeCsv(value: string | number): string {
  const text = String(value);
  if (text.includes(";") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowsToCsv(rows: (string | number)[][]): string {
  const bom = "\uFEFF";
  return (
    bom + rows.map((row) => row.map(escapeCsv).join(";")).join("\n")
  );
}

export interface ReportFilter {
  month: number | "all";
  propertyId: string | "all";
}

export const EMPTY_REPORT_FILTER: ReportFilter = {
  month: "all",
  propertyId: "all",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function reportFilename(slug: string, filter?: ReportFilter, properties?: Property[]) {
  const today = new Date().toISOString().slice(0, 10);
  const parts = ["collection-hub", slug];

  if (filter && filter.month !== "all") {
    parts.push(slugify(MONTH_LABELS[filter.month - 1] ?? `mese-${filter.month}`));
  }

  if (filter && filter.propertyId !== "all" && properties) {
    const property = properties.find((item) => item.id === filter.propertyId);
    if (property) {
      parts.push(slugify(property.name));
    }
  }

  parts.push(`fy${FISCAL_YEAR}`, today);
  return `${parts.join("-")}.csv`;
}

export function getReportFilterLabel(
  filter: ReportFilter,
  properties: Property[],
): string {
  const propertyName =
    filter.propertyId === "all"
      ? ""
      : (properties.find((property) => property.id === filter.propertyId)?.name ??
        filter.propertyId);
  const monthLabel =
    filter.month === "all"
      ? ""
      : (MONTH_LABELS[filter.month - 1] ?? `Mese ${filter.month}`);

  return describePurgeScope(
    {
      month: filter.month,
      propertyId: filter.propertyId,
      includeBookings: true,
      includeExpenses: true,
    },
    propertyName,
    monthLabel,
  );
}

function applyReportFilter(
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
  filter: ReportFilter = EMPTY_REPORT_FILTER,
) {
  const filters = {
    month: filter.month,
    propertyId: filter.propertyId,
    categoryId: "all" as const,
    platformId: "all" as const,
    search: "",
  };

  return {
    bookings: filterBookings(bookings, filters),
    expenses: filterExpenses(expenses, filters),
    properties:
      filter.propertyId === "all"
        ? properties
        : properties.filter((property) => property.id === filter.propertyId),
  };
}

function filterHeader(filter: ReportFilter, properties: Property[]): string[] {
  if (
    filter.month === "all" &&
    filter.propertyId === "all"
  ) {
    return [];
  }

  return [
    `Filtro: ${getReportFilterLabel(filter, properties)}`,
    "",
  ];
}

function prependFilterToCsv(
  csv: string,
  filter: ReportFilter,
  properties: Property[],
): string {
  const lines = filterHeader(filter, properties);
  if (lines.length === 0) {
    return csv;
  }

  const body = csv.startsWith("\uFEFF") ? csv.slice(1) : csv;
  return `\uFEFF${lines.join("\n")}\n${body}`;
}

function lookupName<T extends { id: string; name: string }>(
  items: T[],
  id: string,
): string {
  return items.find((item) => item.id === id)?.name ?? id;
}

export function buildAnnualSummaryCsv(
  bookings: Booking[],
  expenses: Expense[],
  profitTargets: number[],
): string {
  const annual = getAnnualSummary(bookings, expenses, profitTargets);
  const months = getMonthlySummaries(bookings, expenses, profitTargets);

  const rows: (string | number)[][] = [
    [
      "Mese",
      "Incassi",
      "Spese",
      "Profitto",
      "Margine %",
      "Obiettivo",
      "Gap",
      "Prenotazioni",
      "Spese (n.)",
    ],
    ...months.map((month) => [
      month.label,
      month.income.toFixed(2),
      month.expenses.toFixed(2),
      month.profit.toFixed(2),
      formatPercent(month.margin),
      month.target > 0 ? month.target.toFixed(2) : "",
      month.target > 0 ? month.targetGap.toFixed(2) : "",
      month.bookingCount,
      month.expenseCount,
    ]),
    [
      "TOTALE",
      annual.income.toFixed(2),
      annual.expenses.toFixed(2),
      annual.profit.toFixed(2),
      formatPercent(annual.margin),
      annual.totalTarget.toFixed(2),
      annual.totalTarget > 0 ? annual.targetGap.toFixed(2) : "",
      bookings.length,
      expenses.length,
    ],
  ];

  return rowsToCsv(rows);
}

export function buildBookingsCsv(
  bookings: Booking[],
  properties: Property[],
  platforms: Platform[],
): string {
  const rows: (string | number)[][] = [
    [
      "Check-in",
      "Check-out",
      "Notti",
      "Proprietà",
      "Piattaforma",
      "Descrizione",
      "Lordo",
      "Commissione OTA",
      "Netto",
      "Pulizie",
      "Totale",
      "Note",
    ],
    ...bookings.map((booking) => [
      formatDate(booking.checkIn),
      formatDate(booking.checkOut),
      getBookingNights(booking),
      lookupName(properties, booking.propertyId),
      lookupName(platforms, booking.platformId),
      booking.description,
      booking.grossIncome.toFixed(2),
      (booking.otaCommission ?? 0).toFixed(2),
      (booking.grossIncome - (booking.otaCommission ?? 0)).toFixed(2),
      booking.cleaningFee.toFixed(2),
      getBookingTotal(booking).toFixed(2),
      booking.notes ?? "",
    ]),
  ];

  return rowsToCsv(rows);
}

export function buildExpensesCsv(
  expenses: Expense[],
  properties: Property[],
  categories: ExpenseCategory[],
): string {
  const rows: (string | number)[][] = [
    [
      "Data",
      "Proprietà",
      "Categoria",
      "Oggetto",
      "Importo",
      "Note",
    ],
    ...expenses.map((expense) => [
      formatDate(expense.date),
      lookupName(properties, expense.propertyId),
      lookupName(categories, expense.categoryId),
      expense.description,
      expense.amount.toFixed(2),
      expense.notes ?? "",
    ]),
  ];

  return rowsToCsv(rows);
}

export function buildPropertiesCsv(
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
  categories: ExpenseCategory[],
  platforms: Platform[],
): string {
  const header = [
    "Proprietà",
    "Incassi totali",
    "Spese totali",
    "Profitto",
    "Margine %",
    "Affitto mensile",
    "Tasso vs affitto",
    ...MONTH_LABELS.map((label) => `Profitto ${label}`),
  ];

  const rows = properties.map((property) => {
    const summary = getPropertySummary(
      property.id,
      bookings,
      expenses,
      properties,
      categories,
      platforms,
    );

    return [
      property.name,
      summary.income.toFixed(2),
      summary.expenses.toFixed(2),
      summary.profit.toFixed(2),
      formatPercent(summary.margin),
      property.monthlyRent.toFixed(2),
      formatPercent(summary.rate),
      ...summary.monthly.map((month) => month.profit.toFixed(2)),
    ];
  });

  return rowsToCsv([header, ...rows]);
}

export function buildFullReportCsv(
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
  platforms: Platform[],
  categories: ExpenseCategory[],
  profitTargets: number[],
  filter: ReportFilter = EMPTY_REPORT_FILTER,
): string {
  const scoped = applyReportFilter(bookings, expenses, properties, filter);

  const sections = [
    `REPORT ${BRAND.product} · FY${FISCAL_YEAR}`,
    `Generato: ${new Date().toLocaleString("it-IT")}`,
    ...filterHeader(filter, properties),
    "=== PANORAMICA MENSILE ===",
    buildAnnualSummaryCsv(
      scoped.bookings,
      scoped.expenses,
      profitTargets,
    ),
    "",
    "=== PRENOTAZIONI ===",
    buildBookingsCsv(scoped.bookings, scoped.properties, platforms),
    "",
    "=== SPESE ===",
    buildExpensesCsv(scoped.expenses, scoped.properties, categories),
    "",
    "=== PROPRIETÀ ===",
    buildPropertiesCsv(
      scoped.bookings,
      scoped.expenses,
      scoped.properties,
      categories,
      platforms,
    ),
  ];

  return "\uFEFF" + sections.join("\n");
}

export function openPrintableReport(
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
  profitTargets: number[],
  filter: ReportFilter = EMPTY_REPORT_FILTER,
) {
  const scoped = applyReportFilter(bookings, expenses, properties, filter);
  const annual = getAnnualSummary(
    scoped.bookings,
    scoped.expenses,
    profitTargets,
  );
  const months = getMonthlySummaries(
    scoped.bookings,
    scoped.expenses,
    profitTargets,
  ).filter(
    (month) =>
      filter.month === "all" || month.period.month === filter.month,
  );
  const filterLabel = getReportFilterLabel(filter, properties);

  const monthRows = months
    .map(
      (month) => `
      <tr>
        <td>${month.label}</td>
        <td class="num">${formatCurrency(month.income)}</td>
        <td class="num">${formatCurrency(month.expenses)}</td>
        <td class="num">${formatCurrency(month.profit)}</td>
        <td class="num">${formatPercent(month.margin)}</td>
        <td class="num">${month.target > 0 ? formatCurrency(month.target) : "—"}</td>
      </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>${BRAND.product} Report FY${FISCAL_YEAR}</title>
  <style>
    body { font-family: Georgia, serif; color: #1a1a1a; margin: 32px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .kpi { border: 1px solid #c9a962; padding: 12px; border-radius: 8px; }
    .kpi label { font-size: 11px; text-transform: uppercase; color: #8b6914; }
    .kpi strong { display: block; font-size: 20px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; color: #666; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>${BRAND.name} — ${BRAND.product}</h1>
  <p class="meta">FY${FISCAL_YEAR} · ${filterLabel} · ${new Date().toLocaleString("it-IT")}</p>
  <div class="kpis">
    <div class="kpi"><label>Incassi</label><strong>${formatCurrency(annual.income)}</strong></div>
    <div class="kpi"><label>Spese</label><strong>${formatCurrency(annual.expenses)}</strong></div>
    <div class="kpi"><label>Profitto</label><strong>${formatCurrency(annual.profit)}</strong></div>
    <div class="kpi"><label>Margine</label><strong>${formatPercent(annual.margin)}</strong></div>
  </div>
  <h2>Andamento mensile</h2>
  <table>
    <thead>
      <tr>
        <th>Mese</th>
        <th class="num">Incassi</th>
        <th class="num">Spese</th>
        <th class="num">Profitto</th>
        <th class="num">Margine</th>
        <th class="num">Obiettivo</th>
      </tr>
    </thead>
    <tbody>${monthRows}</tbody>
  </table>
  <script>window.onload = () => window.print()</script>
</body>
</html>`;

  const popup = window.open("", "_blank");
  if (!popup) {
    return false;
  }
  popup.document.write(html);
  popup.document.close();
  return true;
}

export function downloadAnnualSummaryReport(
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
  profitTargets: number[],
  filter: ReportFilter = EMPTY_REPORT_FILTER,
) {
  const scoped = applyReportFilter(bookings, expenses, properties, filter);
  downloadTextFile(
    prependFilterToCsv(
      buildAnnualSummaryCsv(scoped.bookings, scoped.expenses, profitTargets),
      filter,
      properties,
    ),
    reportFilename("panoramica-mensile", filter, properties),
  );
}

export function downloadBookingsReport(
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
  platforms: Platform[],
  filter: ReportFilter = EMPTY_REPORT_FILTER,
) {
  const scoped = applyReportFilter(bookings, expenses, properties, filter);
  downloadTextFile(
    prependFilterToCsv(
      buildBookingsCsv(scoped.bookings, scoped.properties, platforms),
      filter,
      properties,
    ),
    reportFilename("prenotazioni", filter, properties),
  );
}

export function downloadExpensesReport(
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
  categories: ExpenseCategory[],
  filter: ReportFilter = EMPTY_REPORT_FILTER,
) {
  const scoped = applyReportFilter(bookings, expenses, properties, filter);
  downloadTextFile(
    prependFilterToCsv(
      buildExpensesCsv(scoped.expenses, scoped.properties, categories),
      filter,
      properties,
    ),
    reportFilename("spese", filter, properties),
  );
}

export function downloadPropertiesReport(
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
  categories: ExpenseCategory[],
  platforms: Platform[],
  filter: ReportFilter = EMPTY_REPORT_FILTER,
) {
  const scoped = applyReportFilter(bookings, expenses, properties, filter);
  downloadTextFile(
    prependFilterToCsv(
      buildPropertiesCsv(
        scoped.bookings,
        scoped.expenses,
        scoped.properties,
        categories,
        platforms,
      ),
      filter,
      properties,
    ),
    reportFilename("proprieta", filter, properties),
  );
}

export function downloadFullReport(
  bookings: Booking[],
  expenses: Expense[],
  properties: Property[],
  platforms: Platform[],
  categories: ExpenseCategory[],
  profitTargets: number[],
  filter: ReportFilter = EMPTY_REPORT_FILTER,
) {
  downloadTextFile(
    buildFullReportCsv(
      bookings,
      expenses,
      properties,
      platforms,
      categories,
      profitTargets,
      filter,
    ),
    reportFilename("report-completo", filter, properties),
  );
}

export function getReportPreviewCounts(
  bookings: Booking[],
  expenses: Expense[],
  filter: ReportFilter,
) {
  const scoped = applyReportFilter(bookings, expenses, [], filter);
  return {
    bookings: scoped.bookings.length,
    expenses: scoped.expenses.length,
  };
}
