import {
  getFiscalBookingAllocations,
  monthEndDate,
} from "./booking-allocation";
import { hasManualCommissionInMonth } from "./expense-dedup";
import type {
  Booking,
  DashboardData,
  Expense,
  ExpenseCategory,
  Platform,
} from "./types";

const PLATFORM_COMMISSION_CATEGORIES: Record<string, string> = {
  booking: "com-booking",
  airbnb: "com-airbnb",
};

const FALLBACK_COMMISSION_CATEGORY = "commissioni-ota";

function roundMoney(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function normalizeBookingCommission(booking: Booking): Booking {
  return {
    ...booking,
    otaCommission: roundMoney(
      Math.max(0, Number(booking.otaCommission) || 0),
    ),
  };
}

export function isLinkedCommissionExpense(expense: Expense): boolean {
  return (
    Boolean(expense.linkedBookingId) &&
    expense.linkedExpenseKind === "commission"
  );
}

export function getCommissionCategoryId(
  platformId: string,
  categories: ExpenseCategory[],
): string {
  const preferred =
    PLATFORM_COMMISSION_CATEGORIES[platformId] ?? FALLBACK_COMMISSION_CATEGORY;
  const knownIds = new Set(categories.map((category) => category.id));

  if (knownIds.has(preferred)) {
    return preferred;
  }

  if (knownIds.has(FALLBACK_COMMISSION_CATEGORY)) {
    return FALLBACK_COMMISSION_CATEGORY;
  }

  return categories[0]?.id ?? FALLBACK_COMMISSION_CATEGORY;
}

export function buildCommissionExpenses(
  booking: Booking,
  platforms: Platform[],
  categories: ExpenseCategory[],
  expenses: Expense[] = [],
): Omit<Expense, "id">[] {
  const commission = Math.max(0, Number(booking.otaCommission) || 0);

  if (commission <= 0) {
    return [];
  }

  const platformName =
    platforms.find((platform) => platform.id === booking.platformId)?.name ??
    booking.platformId;
  const categoryId = getCommissionCategoryId(booking.platformId, categories);
  const allocations = getFiscalBookingAllocations(booking);

  return allocations
    .filter(
      (allocation) =>
        !hasManualCommissionInMonth(
          expenses,
          booking.propertyId,
          allocation.period,
        ),
    )
    .map((allocation) => ({
      date: monthEndDate(allocation.period.year, allocation.period.month),
      propertyId: booking.propertyId,
      categoryId,
      description: `Commissione ${platformName} — ${booking.description}`,
      amount: roundMoney(commission * allocation.share),
      linkedBookingId: booking.id,
      linkedExpenseKind: "commission" as const,
      notes: "Generata automaticamente dall'incasso collegato",
    }));
}

export function upsertCommissionExpense(
  expenses: Expense[],
  booking: Booking,
  categories: ExpenseCategory[],
  platforms: Platform[],
): Expense[] {
  const withoutLinked = expenses.filter(
    (expense) =>
      !(
        expense.linkedBookingId === booking.id &&
        expense.linkedExpenseKind === "commission"
      ),
  );
  const built = buildCommissionExpenses(
    booking,
    platforms,
    categories,
    withoutLinked,
  );

  if (built.length === 0) {
    return withoutLinked;
  }

  const linked = built.map((expense) => {
    const existing = expenses.find(
      (item) =>
        item.linkedBookingId === booking.id &&
        item.linkedExpenseKind === "commission" &&
        item.date === expense.date,
    );

    return {
      ...expense,
      id: existing?.id ?? crypto.randomUUID(),
    };
  });

  return [...withoutLinked, ...linked];
}

export function removeCommissionExpensesForBooking(
  expenses: Expense[],
  bookingId: string,
): Expense[] {
  return expenses.filter(
    (expense) =>
      !(
        expense.linkedBookingId === bookingId &&
        expense.linkedExpenseKind === "commission"
      ),
  );
}

/** Crea spese collegate solo per prenotazioni con commissione inserita manualmente. */
export function syncMissingBookingCommissions(
  data: DashboardData,
): DashboardData {
  let expenses = data.expenses;

  for (const booking of data.bookings) {
    if (booking.importedFromExcel || booking.legacyIncomeAttribution) {
      expenses = removeCommissionExpensesForBooking(expenses, booking.id);
      continue;
    }

    if (booking.otaCommission <= 0) {
      expenses = removeCommissionExpensesForBooking(expenses, booking.id);
      continue;
    }

    expenses = upsertCommissionExpense(
      expenses,
      booking,
      data.expenseCategories,
      data.platforms,
    );
  }

  return {
    ...data,
    expenses,
  };
}
