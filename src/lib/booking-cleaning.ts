import { monthEndDate } from "./booking-allocation";
import { getPeriodFromDate } from "./calculations";
import { hasManualCategoryInMonth } from "./expense-dedup";
import type { Booking, DashboardData, Expense, Property } from "./types";

const CLEANING_CATEGORY_ID = "pulizie";

export function isLinkedCleaningExpense(expense: Expense): boolean {
  return (
    Boolean(expense.linkedBookingId) && expense.linkedExpenseKind === "cleaning"
  );
}

export function getPropertyCleaningCost(
  propertyId: string,
  properties: Property[],
): number {
  const property = properties.find((item) => item.id === propertyId);
  return Math.max(0, Number(property?.cleaningCostPerCheckIn) || 0);
}

function getCleaningCompetencePeriod(booking: Booking) {
  return getPeriodFromDate(booking.checkIn);
}

export function buildCleaningExpenses(
  booking: Booking,
  properties: Property[],
  expenses: Expense[] = [],
): Omit<Expense, "id">[] {
  if (booking.importedFromExcel || booking.legacyIncomeAttribution) {
    return [];
  }

  const cost = getPropertyCleaningCost(booking.propertyId, properties);

  if (cost <= 0) {
    return [];
  }

  const period = getCleaningCompetencePeriod(booking);

  if (
    hasManualCategoryInMonth(
      expenses,
      booking.propertyId,
      CLEANING_CATEGORY_ID,
      period,
    )
  ) {
    return [];
  }

  return [
    {
      date: monthEndDate(period.year, period.month),
      propertyId: booking.propertyId,
      categoryId: CLEANING_CATEGORY_ID,
      description: `Pulizie check-in — ${booking.description}`,
      amount: cost,
      linkedBookingId: booking.id,
      linkedExpenseKind: "cleaning" as const,
      notes:
        "Costo pulizia impostato sull'appartamento, collegato alla prenotazione",
    },
  ];
}

export function upsertCleaningExpense(
  expenses: Expense[],
  booking: Booking,
  properties: Property[],
): Expense[] {
  const withoutCleaning = expenses.filter(
    (expense) =>
      !(
        expense.linkedBookingId === booking.id &&
        expense.linkedExpenseKind === "cleaning"
      ),
  );
  const built = buildCleaningExpenses(booking, properties, withoutCleaning);

  if (built.length === 0) {
    return withoutCleaning;
  }

  const linked = built.map((expense) => {
    const existing = expenses.find(
      (item) =>
        item.linkedBookingId === booking.id &&
        item.linkedExpenseKind === "cleaning",
    );

    return {
      ...expense,
      id: existing?.id ?? crypto.randomUUID(),
    };
  });

  return [...withoutCleaning, ...linked];
}

export function removeCleaningExpensesForBooking(
  expenses: Expense[],
  bookingId: string,
): Expense[] {
  return expenses.filter(
    (expense) =>
      !(
        expense.linkedBookingId === bookingId &&
        expense.linkedExpenseKind === "cleaning"
      ),
  );
}

export function resyncPropertyBookingCleaningExpenses(
  data: DashboardData,
  propertyId: string,
): DashboardData {
  let expenses = data.expenses;

  for (const booking of data.bookings) {
    if (booking.propertyId !== propertyId) {
      continue;
    }

    expenses = upsertCleaningExpense(expenses, booking, data.properties);
  }

  return {
    ...data,
    expenses,
  };
}

export function syncMissingBookingCleaning(data: DashboardData): DashboardData {
  let expenses = data.expenses;

  for (const booking of data.bookings) {
    if (booking.importedFromExcel || booking.legacyIncomeAttribution) {
      expenses = removeCleaningExpensesForBooking(expenses, booking.id);
      continue;
    }

    expenses = upsertCleaningExpense(expenses, booking, data.properties);
  }

  return {
    ...data,
    expenses,
  };
}
