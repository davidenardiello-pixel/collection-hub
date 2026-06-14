import { removeAllBookingLinkedExpenses } from "./booking-vat";
import { getPeriodFromDate } from "./calculations";
import type { Booking, Expense } from "./types";

export type PurgeMonth = number | "all";
export type PurgeProperty = string | "all";

export interface PurgeScope {
  month: PurgeMonth;
  propertyId: PurgeProperty;
  includeBookings: boolean;
  includeExpenses: boolean;
}

export interface PurgePreview {
  bookings: number;
  expenses: number;
  bookingTotal: number;
  expenseTotal: number;
}

function matchesMonth(date: string, month: PurgeMonth): boolean {
  if (month === "all") {
    return true;
  }
  return getPeriodFromDate(date).month === month;
}

function matchesProperty(propertyId: string, target: PurgeProperty): boolean {
  if (target === "all") {
    return true;
  }
  return propertyId === target;
}

export function bookingMatchesPurge(booking: Booking, scope: PurgeScope): boolean {
  return (
    matchesProperty(booking.propertyId, scope.propertyId) &&
    matchesMonth(booking.checkIn, scope.month)
  );
}

export function expenseMatchesPurge(expense: Expense, scope: PurgeScope): boolean {
  return (
    matchesProperty(expense.propertyId, scope.propertyId) &&
    matchesMonth(expense.date, scope.month)
  );
}

function getBookingsToPurge(bookings: Booking[], scope: PurgeScope): Booking[] {
  if (!scope.includeBookings) {
    return [];
  }

  return bookings.filter((booking) => bookingMatchesPurge(booking, scope));
}

function getExpensesToPurge(
  expenses: Expense[],
  scope: PurgeScope,
  removedBookingIds: Set<string>,
): Expense[] {
  const ids = new Set<string>();

  if (scope.includeBookings) {
    for (const expense of expenses) {
      if (
        expense.linkedBookingId &&
        removedBookingIds.has(expense.linkedBookingId)
      ) {
        ids.add(expense.id);
      }
    }
  }

  if (scope.includeExpenses) {
    for (const expense of expenses) {
      if (expenseMatchesPurge(expense, scope)) {
        ids.add(expense.id);
      }
    }
  }

  return expenses.filter((expense) => ids.has(expense.id));
}

export function getPurgePreview(
  bookings: Booking[],
  expenses: Expense[],
  scope: PurgeScope,
): PurgePreview {
  const matchedBookings = getBookingsToPurge(bookings, scope);
  const removedBookingIds = new Set(matchedBookings.map((booking) => booking.id));
  const matchedExpenses = getExpensesToPurge(
    expenses,
    scope,
    removedBookingIds,
  );

  return {
    bookings: matchedBookings.length,
    expenses: matchedExpenses.length,
    bookingTotal: matchedBookings.reduce(
      (sum, booking) => sum + booking.grossIncome + booking.cleaningFee,
      0,
    ),
    expenseTotal: matchedExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0,
    ),
  };
}

export function purgeTransactions<
  T extends { bookings: Booking[]; expenses: Expense[] },
>(data: T, scope: PurgeScope): T {
  const bookingsToRemove = getBookingsToPurge(data.bookings, scope);
  const removedBookingIds = new Set(
    bookingsToRemove.map((booking) => booking.id),
  );

  let expenses = data.expenses;

  if (scope.includeBookings) {
    for (const bookingId of removedBookingIds) {
      expenses = removeAllBookingLinkedExpenses(expenses, bookingId);
    }
  }

  if (scope.includeExpenses) {
    const purgeExpenseIds = new Set(
      getExpensesToPurge(expenses, scope, removedBookingIds).map(
        (expense) => expense.id,
      ),
    );
    expenses = expenses.filter((expense) => !purgeExpenseIds.has(expense.id));
  }

  const bookings = scope.includeBookings
    ? data.bookings.filter((booking) => !bookingMatchesPurge(booking, scope))
    : data.bookings;

  return {
    ...data,
    bookings,
    expenses,
  };
}

export function describePurgeScope(
  scope: PurgeScope,
  propertyName: string,
  monthLabel: string,
): string {
  const propertyPart =
    scope.propertyId === "all" ? "tutti gli appartamenti" : propertyName;
  const monthPart = scope.month === "all" ? "tutti i mesi" : monthLabel;
  return `${propertyPart} · ${monthPart}`;
}

export function buildMonthPropertyPurgeScope(
  month: number,
  propertyId: string,
): PurgeScope {
  return {
    month,
    propertyId,
    includeBookings: true,
    includeExpenses: true,
  };
}
