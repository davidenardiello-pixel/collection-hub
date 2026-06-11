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

export function getPurgePreview(
  bookings: Booking[],
  expenses: Expense[],
  scope: PurgeScope,
): PurgePreview {
  const matchedBookings = scope.includeBookings
    ? bookings.filter((booking) => bookingMatchesPurge(booking, scope))
    : [];
  const matchedExpenses = scope.includeExpenses
    ? expenses.filter((expense) => expenseMatchesPurge(expense, scope))
    : [];

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

export function purgeTransactions<T extends { bookings: Booking[]; expenses: Expense[] }>(
  data: T,
  scope: PurgeScope,
): T {
  return {
    ...data,
    bookings: scope.includeBookings
      ? data.bookings.filter((booking) => !bookingMatchesPurge(booking, scope))
      : data.bookings,
    expenses: scope.includeExpenses
      ? data.expenses.filter((expense) => !expenseMatchesPurge(expense, scope))
      : data.expenses,
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
