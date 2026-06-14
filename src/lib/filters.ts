import { FISCAL_YEAR, MONTH_LABELS } from "./constants";
import { bookingAppliesToPeriod } from "./booking-allocation";
import { getPeriodFromDate } from "./calculations";
import type { Booking, Expense } from "./types";

export type FilterMonth = number | "all";
export type FilterProperty = string | "all";

export interface TransactionFilters {
  month: FilterMonth;
  propertyId: FilterProperty;
  categoryId: FilterProperty;
  platformId: FilterProperty;
  search: string;
}

export const EMPTY_FILTERS: TransactionFilters = {
  month: "all",
  propertyId: "all",
  categoryId: "all",
  platformId: "all",
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

    if (
      filters.platformId !== "all" &&
      booking.platformId !== filters.platformId
    ) {
      return false;
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

    if (
      filters.categoryId !== "all" &&
      expense.categoryId !== filters.categoryId
    ) {
      return false;
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

export function groupByProperty<T>(
  items: T[],
  getPropertyId: (item: T) => string,
  propertyNames: Record<string, string>,
): { propertyId: string; name: string; items: T[] }[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const propertyId = getPropertyId(item);
    const bucket = groups.get(propertyId) ?? [];
    bucket.push(item);
    groups.set(propertyId, bucket);
  }

  return Array.from(groups.entries())
    .map(([propertyId, groupItems]) => ({
      propertyId,
      name: propertyNames[propertyId] ?? propertyId,
      items: groupItems,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "it"));
}

export function describeActiveFilters(
  filters: TransactionFilters,
  labels: {
    properties: Record<string, string>;
    categories?: Record<string, string>;
    platforms?: Record<string, string>;
  },
): string[] {
  const parts: string[] = [];

  if (filters.month !== "all") {
    parts.push(MONTH_LABELS[filters.month - 1] ?? `Mese ${filters.month}`);
  }

  if (filters.propertyId !== "all") {
    parts.push(labels.properties[filters.propertyId] ?? filters.propertyId);
  }

  if (filters.categoryId !== "all" && labels.categories) {
    parts.push(labels.categories[filters.categoryId] ?? filters.categoryId);
  }

  if (filters.platformId !== "all" && labels.platforms) {
    parts.push(labels.platforms[filters.platformId] ?? filters.platformId);
  }

  if (filters.search.trim()) {
    parts.push(`“${filters.search.trim()}”`);
  }

  return parts;
}
