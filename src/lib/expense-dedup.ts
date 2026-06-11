import { getPeriodFromDate } from "./calculations";
import { isAutomatedExpense } from "./automation";
import { isLinkedCleaningExpense } from "./booking-cleaning";
import { isLinkedCommissionExpense } from "./booking-commission";
import { isLinkedVatExpense } from "./booking-vat";
import type { DashboardData, Expense, MonthPeriod } from "./types";

const COMMISSION_CATEGORY_IDS = new Set([
  "com-booking",
  "com-airbnb",
  "commissioni-ota",
]);

function sameMonth(expense: Expense, period: MonthPeriod): boolean {
  const expensePeriod = getPeriodFromDate(expense.date);
  return (
    expensePeriod.year === period.year &&
    expensePeriod.month === period.month
  );
}

function isManualExpense(expense: Expense): boolean {
  return !isAutomatedExpense(expense) && !expense.linkedBookingId;
}

export function hasManualCategoryInMonth(
  expenses: Expense[],
  propertyId: string,
  categoryId: string,
  period: MonthPeriod,
): boolean {
  return expenses.some(
    (expense) =>
      isManualExpense(expense) &&
      expense.propertyId === propertyId &&
      expense.categoryId === categoryId &&
      sameMonth(expense, period),
  );
}

export function hasManualCommissionInMonth(
  expenses: Expense[],
  propertyId: string,
  period: MonthPeriod,
): boolean {
  return expenses.some(
    (expense) =>
      isManualExpense(expense) &&
      expense.propertyId === propertyId &&
      COMMISSION_CATEGORY_IDS.has(expense.categoryId) &&
      sameMonth(expense, period),
  );
}

function isGeneratedExpense(expense: Expense): boolean {
  return (
    isAutomatedExpense(expense) ||
    isLinkedVatExpense(expense) ||
    isLinkedCommissionExpense(expense) ||
    isLinkedCleaningExpense(expense)
  );
}

/**
 * Rimuove spese generate se esiste già una voce manuale della stessa
 * categoria/mese/appartamento (evita doppioni Excel + automazione).
 */
export function deduplicateOverlappingExpenses(
  data: DashboardData,
): DashboardData {
  const expenses = data.expenses.filter((expense) => {
    if (!isGeneratedExpense(expense)) {
      return true;
    }

    const period = getPeriodFromDate(expense.date);

    if (isLinkedVatExpense(expense)) {
      return !hasManualCategoryInMonth(
        data.expenses,
        expense.propertyId,
        "iva",
        period,
      );
    }

    if (isLinkedCommissionExpense(expense)) {
      return !hasManualCommissionInMonth(
        data.expenses,
        expense.propertyId,
        period,
      );
    }

    if (isLinkedCleaningExpense(expense)) {
      return !hasManualCategoryInMonth(
        data.expenses,
        expense.propertyId,
        "pulizie",
        period,
      );
    }

    if (expense.automationId?.includes(":cleaning:")) {
      return !hasManualCategoryInMonth(
        data.expenses,
        expense.propertyId,
        "pulizie",
        period,
      );
    }

    if (expense.automationId?.includes(":rent:")) {
      return !hasManualCategoryInMonth(
        data.expenses,
        expense.propertyId,
        "affitto",
        period,
      );
    }

    if (expense.automationId?.includes(":kross:")) {
      return !hasManualCategoryInMonth(
        data.expenses,
        expense.propertyId,
        "krossbooking",
        period,
      );
    }

    return true;
  });

  return {
    ...data,
    expenses,
  };
}
