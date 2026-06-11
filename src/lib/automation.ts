import { isLinkedCleaningExpense } from "./booking-cleaning";
import { bookingAppliesToPeriod } from "./booking-allocation";
import { hasManualCategoryInMonth } from "./expense-dedup";
import {
  getElapsedFiscalMonth,
  getFiscalMonths,
  getMonthLabel,
} from "./calculations";
import { FISCAL_YEAR } from "./constants";
import type { Booking, DashboardData, Expense, Property } from "./types";

export const AUTOMATION_PREFIX = "auto:";

export interface AutomationSettings {
  autoRent: boolean;
  autoKrossBooking: boolean;
  autoCleaning: boolean;
}

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  autoRent: false,
  autoKrossBooking: false,
  autoCleaning: false,
};

export interface AutomationPreview {
  removedAutomated: number;
  rentEntries: number;
  rentTotal: number;
  krossEntries: number;
  krossTotal: number;
  cleaningEntries: number;
  cleaningCheckIns: number;
  cleaningTotal: number;
}

function monthEndDate(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function buildAutomationId(
  type: "rent" | "kross" | "cleaning",
  propertyId: string,
  year: number,
  month: number,
): string {
  return `${AUTOMATION_PREFIX}${type}:${propertyId}:${year}-${String(month).padStart(2, "0")}`;
}

export function isAutomatedExpense(expense: Expense): boolean {
  return Boolean(expense.automationId?.startsWith(AUTOMATION_PREFIX));
}

function isRentOrKrossAutomationId(automationId: string | undefined): boolean {
  return Boolean(
    automationId?.includes(":rent:") || automationId?.includes(":kross:"),
  );
}

function automationMonth(automationId: string): number | null {
  const match = automationId.match(/:(\d{4})-(\d{2})$/);
  return match ? Number(match[2]) : null;
}

/** Affitto e Kross solo sul mese corrente: niente pregresso Excel né mesi futuri. */
export function pruneStaleRentKrossAutomation(
  data: DashboardData,
  referenceDate = new Date(),
): DashboardData {
  const currentMonth = getElapsedFiscalMonth(referenceDate);

  if (currentMonth <= 0) {
    return {
      ...data,
      expenses: data.expenses.filter(
        (expense) =>
          !isAutomatedExpense(expense) ||
          !isRentOrKrossAutomationId(expense.automationId),
      ),
    };
  }

  return {
    ...data,
    expenses: data.expenses.filter((expense) => {
      if (
        !isAutomatedExpense(expense) ||
        !isRentOrKrossAutomationId(expense.automationId)
      ) {
        return true;
      }

      return automationMonth(expense.automationId ?? "") === currentMonth;
    }),
  };
}

export function buildAutomatedExpenses(
  bookings: Booking[],
  properties: Property[],
  automation: AutomationSettings,
  throughMonth = getElapsedFiscalMonth(),
  expenses: Expense[] = [],
): Omit<Expense, "id">[] {
  const results: Omit<Expense, "id">[] = [];
  const currentMonth = getElapsedFiscalMonth();

  for (const property of properties) {
    const krossMonthly = property.krossBookingMonthly ?? 0;

    for (const period of getFiscalMonths()) {
      if (period.month > throughMonth) {
        continue;
      }
      const expenseDate = monthEndDate(period.year, period.month);
      const monthLabel = getMonthLabel(period.month);

      if (
        automation.autoRent &&
        currentMonth > 0 &&
        period.month === currentMonth &&
        property.monthlyRent > 0 &&
        !hasManualCategoryInMonth(expenses, property.id, "affitto", period)
      ) {
        results.push({
          date: expenseDate,
          propertyId: property.id,
          categoryId: "affitto",
          description: `Affitto automatico — ${monthLabel}`,
          amount: roundAmount(property.monthlyRent),
          automationId: buildAutomationId(
            "rent",
            property.id,
            period.year,
            period.month,
          ),
          notes: "Generato automaticamente",
        });
      }

      if (
        automation.autoKrossBooking &&
        currentMonth > 0 &&
        period.month === currentMonth &&
        krossMonthly > 0 &&
        !hasManualCategoryInMonth(
          expenses,
          property.id,
          "krossbooking",
          period,
        )
      ) {
        results.push({
          date: expenseDate,
          propertyId: property.id,
          categoryId: "krossbooking",
          description: `KrossBooking automatico — ${monthLabel}`,
          amount: roundAmount(krossMonthly),
          automationId: buildAutomationId(
            "kross",
            property.id,
            period.year,
            period.month,
          ),
          notes: "Generato automaticamente",
        });
      }

    }
  }

  return results;
}

export function getAutomationPreview(data: DashboardData): AutomationPreview {
  const automation = data.automation ?? DEFAULT_AUTOMATION_SETTINGS;
  const generated = buildAutomatedExpenses(
    data.bookings,
    data.properties,
    automation,
    getElapsedFiscalMonth(),
    data.expenses,
  );

  let rentEntries = 0;
  let rentTotal = 0;
  let krossEntries = 0;
  let krossTotal = 0;
  let cleaningEntries = 0;
  let cleaningCheckIns = 0;
  let cleaningTotal = 0;

  for (const expense of generated) {
    if (expense.automationId?.includes(":rent:")) {
      rentEntries += 1;
      rentTotal += expense.amount;
    } else if (expense.automationId?.includes(":kross:")) {
      krossEntries += 1;
      krossTotal += expense.amount;
    }
  }

  for (const expense of data.expenses) {
    if (!isLinkedCleaningExpense(expense)) {
      continue;
    }

    cleaningEntries += 1;
    cleaningTotal += expense.amount;
    cleaningCheckIns += 1;
  }

  return {
    removedAutomated: data.expenses.filter(isAutomatedExpense).length,
    rentEntries,
    rentTotal,
    krossEntries,
    krossTotal,
    cleaningEntries,
    cleaningCheckIns,
    cleaningTotal,
  };
}

function isCleaningAutomationId(automationId: string | undefined): boolean {
  return Boolean(automationId?.includes(":cleaning:"));
}

export function refreshAutomatedCleaningExpenses(
  data: DashboardData,
): DashboardData {
  return {
    ...data,
    expenses: data.expenses.filter(
      (expense) =>
        !isAutomatedExpense(expense) ||
        !isCleaningAutomationId(expense.automationId),
    ),
  };
}

export function syncAutomatedExpenses(data: DashboardData): {
  expenses: Expense[];
  preview: AutomationPreview;
} {
  const automation = data.automation ?? DEFAULT_AUTOMATION_SETTINGS;
  const manualExpenses = data.expenses.filter(
    (expense) => !isAutomatedExpense(expense),
  );
  const generated = buildAutomatedExpenses(
    data.bookings,
    data.properties,
    automation,
    getElapsedFiscalMonth(),
    data.expenses,
  ).map((expense) => ({
    ...expense,
    id: crypto.randomUUID(),
  }));

  const preview = getAutomationPreview(data);

  return {
    expenses: [...manualExpenses, ...generated],
    preview,
  };
}

export function countPropertyCheckIns(
  bookings: Booking[],
  propertyId: string,
  month?: number,
): number {
  const propertyBookings = bookings.filter(
    (booking) => booking.propertyId === propertyId,
  );

  if (!month) {
    return propertyBookings.length;
  }

  return propertyBookings.filter((booking) =>
    bookingAppliesToPeriod(booking, { year: FISCAL_YEAR, month }),
  ).length;
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}
