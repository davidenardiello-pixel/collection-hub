import excelData from "./excel-data.json";
import type { Booking, Expense } from "./types";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function bookingBaselineKey(
  booking: Pick<
    Booking,
    | "propertyId"
    | "checkIn"
    | "checkOut"
    | "platformId"
    | "grossIncome"
    | "cleaningFee"
  >,
): string {
  return [
    booking.propertyId,
    booking.checkIn,
    booking.checkOut,
    booking.platformId,
    roundMoney(booking.grossIncome),
    roundMoney(booking.cleaningFee ?? 0),
  ].join("|");
}

export function expenseBaselineKey(
  expense: Pick<Expense, "propertyId" | "date" | "categoryId" | "amount">,
): string {
  return [
    expense.propertyId,
    expense.date,
    expense.categoryId,
    roundMoney(expense.amount),
  ].join("|");
}

const EXCEL_BOOKING_KEYS = new Set(
  excelData.bookings.map((booking) => bookingBaselineKey(booking)),
);

const EXCEL_EXPENSE_KEYS = new Set(
  excelData.expenses.map((expense) => expenseBaselineKey(expense)),
);

export function isExcelBaselineBooking(
  booking: Pick<
    Booking,
    | "propertyId"
    | "checkIn"
    | "checkOut"
    | "platformId"
    | "grossIncome"
    | "cleaningFee"
    | "importedFromExcel"
  >,
): boolean {
  if (booking.importedFromExcel) {
    return true;
  }

  return EXCEL_BOOKING_KEYS.has(bookingBaselineKey(booking));
}

export function isExcelBaselineExpense(
  expense: Pick<
    Expense,
    "propertyId" | "date" | "categoryId" | "amount" | "importedFromExcel"
  >,
): boolean {
  if (expense.importedFromExcel) {
    return true;
  }

  return EXCEL_EXPENSE_KEYS.has(expenseBaselineKey(expense));
}
