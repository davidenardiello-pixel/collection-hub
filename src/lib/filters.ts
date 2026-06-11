import { FISCAL_YEAR } from "./constants";
import { bookingAppliesToPeriod } from "./booking-allocation";
import { getPeriodFromDate } from "./calculations";
import type { Booking, Expense } from "./types";

export type FilterMonth = number | "all";
export type FilterProperty = string | "all";

export interface TransactionFilters {
  month: FilterMonth;
  propertyId: FilterProperty;
  search: string;
}

export const EMPTY_FILTERS: TransactionFilters = {
  month: "all",
  propertyId: "all",
  search: "",
};

export function filterBookings(
  bookings: Booking[],
  filters: TransactionFilters,
): Booking[] {
  const query = filters.search.trim().toLowerCase();

  return bookings.filter((booking) => {
    if (
      filters.propertyId !== "all" &&
      booking.propertyId !== filters.propertyId
    ) {
      return false;
    }

    if (filters.month !== "all") {
      if (
        !bookingAppliesToPeriod(booking, {
          year: FISCAL_YEAR,
          month: filters.month,
        })
      ) {
        return false;
      }
    }

    if (query) {
      const haystack = [booking.description, booking.notes ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

export function filterExpenses(
  expenses: Expense[],
  filters: TransactionFilters,
): Expense[] {
  const query = filters.search.trim().toLowerCase();

  return expenses.filter((expense) => {
    if (
      filters.propertyId !== "all" &&
      expense.propertyId !== filters.propertyId
    ) {
      return false;
    }

    if (filters.month !== "all") {
      const month = getPeriodFromDate(expense.date).month;
      if (month !== filters.month) {
        return false;
      }
    }

    if (query) {
      const haystack = [expense.description, expense.notes ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });
}
