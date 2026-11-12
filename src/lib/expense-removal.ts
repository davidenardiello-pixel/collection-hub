import { isLinkedCleaningExpense } from "./booking-cleaning";
import { isLinkedCommissionExpense } from "./booking-commission";
import { isLinkedVatExpense } from "./booking-vat";
import { buildAutomationId, isAutomatedExpense } from "./automation";
import { getPeriodFromDate } from "./calculations";
import type { DashboardData, Expense } from "./types";

export type LinkedExpenseKind = "commission" | "vat" | "cleaning";

export function rentKrossSuppressionList(
  data: DashboardData,
): string[] {
  return data.rentKrossAutomationSuppressed ?? [];
}

export function linkedExpenseSuppressionList(
  data: DashboardData,
): string[] {
  return data.bookingLinkedExpenseSuppressed ?? [];
}

export function linkedExpenseSuppressionKey(
  bookingId: string,
  kind: LinkedExpenseKind,
): string {
  return `${bookingId}:${kind}`;
}

export function isRentKrossAutomationSuppressed(
  automationId: string | undefined,
  suppressed: string[] | undefined,
): boolean {
  if (!automationId || !suppressed?.length) {
    return false;
  }

  return suppressed.includes(automationId);
}

export function isBookingLinkedExpenseSuppressed(
  bookingId: string | undefined,
  kind: LinkedExpenseKind,
  suppressed: string[] | undefined,
): boolean {
  if (!bookingId || !suppressed?.length) {
    return false;
  }

  return suppressed.includes(linkedExpenseSuppressionKey(bookingId, kind));
}

function appendUnique(list: string[], value: string): string[] {
  if (list.includes(value)) {
    return list;
  }

  return [...list, value];
}

/** Chiave stabile anche se la spesa è stata creata senza automationId. */
export function resolveRentKrossAutomationId(expense: Expense): string | null {
  if (
    expense.automationId &&
    (expense.automationId.includes(":rent:") ||
      expense.automationId.includes(":kross:"))
  ) {
    return expense.automationId;
  }

  const period = getPeriodFromDate(expense.date);
  if (expense.categoryId === "affitto") {
    return buildAutomationId(
      "rent",
      expense.propertyId,
      period.year,
      period.month,
    );
  }

  if (expense.categoryId === "krossbooking") {
    return buildAutomationId(
      "kross",
      expense.propertyId,
      period.year,
      period.month,
    );
  }

  return null;
}

export function isRentKrossAutomatedExpense(expense: Expense): boolean {
  if (isAutomatedExpense(expense)) {
    return Boolean(
      expense.automationId?.includes(":rent:") ||
        expense.automationId?.includes(":kross:"),
    );
  }

  return Boolean(resolveRentKrossAutomationId(expense));
}

export function removeExpenseFromDashboard(
  data: DashboardData,
  expenseId: string,
): DashboardData {
  const expense = data.expenses.find((item) => item.id === expenseId);
  if (!expense) {
    return data;
  }

  let rentKrossAutomationSuppressed = data.rentKrossAutomationSuppressed ?? [];
  let bookingLinkedExpenseSuppressed = data.bookingLinkedExpenseSuppressed ?? [];

  const rentKrossAutomationId = resolveRentKrossAutomationId(expense);
  if (rentKrossAutomationId) {
    rentKrossAutomationSuppressed = appendUnique(
      rentKrossAutomationSuppressed,
      rentKrossAutomationId,
    );
  }

  if (isLinkedCleaningExpense(expense) && expense.linkedBookingId) {
    bookingLinkedExpenseSuppressed = appendUnique(
      bookingLinkedExpenseSuppressed,
      linkedExpenseSuppressionKey(expense.linkedBookingId, "cleaning"),
    );
  }

  if (isLinkedCommissionExpense(expense) && expense.linkedBookingId) {
    bookingLinkedExpenseSuppressed = appendUnique(
      bookingLinkedExpenseSuppressed,
      linkedExpenseSuppressionKey(expense.linkedBookingId, "commission"),
    );
  }

  if (isLinkedVatExpense(expense) && expense.linkedBookingId) {
    bookingLinkedExpenseSuppressed = appendUnique(
      bookingLinkedExpenseSuppressed,
      linkedExpenseSuppressionKey(expense.linkedBookingId, "vat"),
    );
  }

  return {
    ...data,
    rentKrossAutomationSuppressed,
    bookingLinkedExpenseSuppressed,
    expenses: data.expenses.filter((item) => item.id !== expenseId),
  };
}

export function expenseDeleteConfirmMessage(expense: Expense): string | null {
  if (resolveRentKrossAutomationId(expense)) {
    return "Eliminare questa spesa automatica? L'incasso e le prenotazioni restano invariati. La voce non verrà rigenerata.";
  }

  if (isLinkedCleaningExpense(expense)) {
    return "Eliminare questa pulizia automatica? La prenotazione resta invariata. La voce non verrà rigenerata.";
  }

  if (isLinkedCommissionExpense(expense) || isLinkedVatExpense(expense)) {
    return "Eliminare questa spesa collegata all'incasso? La prenotazione resta invariata. La voce non verrà rigenerata.";
  }

  return null;
}
