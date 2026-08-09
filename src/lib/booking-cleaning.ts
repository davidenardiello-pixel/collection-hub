import { monthEndDate } from "./booking-allocation";
import { getPeriodFromDate } from "./calculations";
import { FISCAL_YEAR } from "./constants";
import type {
  Booking,
  DashboardData,
  Expense,
  MonthPeriod,
  Property,
} from "./types";

const CLEANING_CATEGORY_ID = "pulizie";

export function cleaningForecastKey(
  propertyId: string,
  year: number,
  month: number,
): string {
  return `${propertyId}:${year}-${String(month).padStart(2, "0")}`;
}

export function parseCleaningForecastKey(
  key: string,
): { propertyId: string; year: number; month: number } | null {
  const match = key.match(/^(.+):(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }
  return {
    propertyId: match[1],
    year: Number(match[2]),
    month: Number(match[3]),
  };
}

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

export function isCleaningForecastSuppressedForBooking(
  booking: Booking,
  suppressed: string[] | undefined,
): boolean {
  if (!suppressed?.length) {
    return false;
  }
  const period = getCleaningCompetencePeriod(booking);
  const key = cleaningForecastKey(
    booking.propertyId,
    period.year,
    period.month,
  );
  return suppressed.includes(key);
}

export function isCleaningForecastSuppressed(
  data: DashboardData,
  propertyId: string,
  period: MonthPeriod,
): boolean {
  const key = cleaningForecastKey(propertyId, period.year, period.month);
  return (data.cleaningForecastSuppressed ?? []).includes(key);
}

function bookingEligibleForAutoCleaning(booking: Booking): boolean {
  return !booking.importedFromExcel && !booking.legacyIncomeAttribution;
}

export function bookingsForCleaningForecastMonth(
  bookings: Booking[],
  propertyId: string,
  period: MonthPeriod,
): Booking[] {
  return bookings.filter((booking) => {
    if (booking.propertyId !== propertyId) {
      return false;
    }
    if (!bookingEligibleForAutoCleaning(booking)) {
      return false;
    }
    const checkInPeriod = getPeriodFromDate(booking.checkIn);
    return (
      checkInPeriod.year === period.year && checkInPeriod.month === period.month
    );
  });
}

export function buildCleaningExpenses(
  booking: Booking,
  properties: Property[],
  suppressed?: string[],
): Omit<Expense, "id">[] {
  if (!bookingEligibleForAutoCleaning(booking)) {
    return [];
  }

  if (isCleaningForecastSuppressedForBooking(booking, suppressed)) {
    return [];
  }

  const cost = getPropertyCleaningCost(booking.propertyId, properties);

  if (cost <= 0) {
    return [];
  }

  const period = getCleaningCompetencePeriod(booking);

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
        "Forecast pulizia check-in (collegata alla prenotazione). Puoi annullare il blocco mese in Impostazioni.",
    },
  ];
}

export function upsertCleaningExpense(
  expenses: Expense[],
  booking: Booking,
  properties: Property[],
  suppressed?: string[],
): Expense[] {
  const withoutCleaning = expenses.filter(
    (expense) =>
      !(
        expense.linkedBookingId === booking.id &&
        expense.linkedExpenseKind === "cleaning"
      ),
  );
  const built = buildCleaningExpenses(booking, properties, suppressed);

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

export function removeLinkedCleaningForPropertyMonth(
  expenses: Expense[],
  bookings: Booking[],
  propertyId: string,
  period: MonthPeriod,
): Expense[] {
  const bookingIds = new Set(
    bookingsForCleaningForecastMonth(bookings, propertyId, period).map(
      (booking) => booking.id,
    ),
  );

  if (bookingIds.size === 0) {
    return expenses;
  }

  return expenses.filter(
    (expense) =>
      !(
        isLinkedCleaningExpense(expense) &&
        expense.linkedBookingId &&
        bookingIds.has(expense.linkedBookingId)
      ),
  );
}

export function dismissCleaningForecastForPropertyMonth(
  data: DashboardData,
  propertyId: string,
  period: MonthPeriod,
): DashboardData {
  const key = cleaningForecastKey(propertyId, period.year, period.month);
  const suppressed = new Set(data.cleaningForecastSuppressed ?? []);
  suppressed.add(key);

  return {
    ...data,
    cleaningForecastSuppressed: [...suppressed],
    expenses: removeLinkedCleaningForPropertyMonth(
      data.expenses,
      data.bookings,
      propertyId,
      period,
    ),
  };
}

export function restoreCleaningForecastForPropertyMonth(
  data: DashboardData,
  propertyId: string,
  period: MonthPeriod,
): DashboardData {
  const key = cleaningForecastKey(propertyId, period.year, period.month);
  const suppressed = (data.cleaningForecastSuppressed ?? []).filter(
    (item) => item !== key,
  );

  let expenses = data.expenses;
  const suppressedSet = suppressed;
  for (const booking of bookingsForCleaningForecastMonth(
    data.bookings,
    propertyId,
    period,
  )) {
    expenses = upsertCleaningExpense(
      expenses,
      booking,
      data.properties,
      suppressedSet,
    );
  }

  return {
    ...data,
    cleaningForecastSuppressed: suppressed,
    expenses,
  };
}

export interface CleaningForecastMonthRow {
  propertyId: string;
  propertyName: string;
  year: number;
  month: number;
  checkInCount: number;
  linkedCleaningCount: number;
  linkedCleaningTotal: number;
  suppressed: boolean;
}

export function listCleaningForecastByPropertyMonth(
  data: DashboardData,
): CleaningForecastMonthRow[] {
  const rows: CleaningForecastMonthRow[] = [];

  for (const property of data.properties) {
    for (let month = 1; month <= 12; month += 1) {
      const period = { year: FISCAL_YEAR, month };
      const monthBookings = bookingsForCleaningForecastMonth(
        data.bookings,
        property.id,
        period,
      );
      const bookingIds = new Set(monthBookings.map((booking) => booking.id));
      const linked = data.expenses.filter(
        (expense) =>
          isLinkedCleaningExpense(expense) &&
          expense.linkedBookingId &&
          bookingIds.has(expense.linkedBookingId),
      );
      const suppressed = isCleaningForecastSuppressed(data, property.id, period);

      if (
        monthBookings.length === 0 &&
        linked.length === 0 &&
        !suppressed
      ) {
        continue;
      }

      rows.push({
        propertyId: property.id,
        propertyName: property.name,
        year: period.year,
        month,
        checkInCount: monthBookings.length,
        linkedCleaningCount: linked.length,
        linkedCleaningTotal: linked.reduce(
          (total, expense) => total + expense.amount,
          0,
        ),
        suppressed,
      });
    }
  }

  return rows.sort(
    (left, right) =>
      left.month - right.month ||
      left.propertyName.localeCompare(right.propertyName, "it"),
  );
}

export function resyncPropertyBookingCleaningExpenses(
  data: DashboardData,
  propertyId: string,
): DashboardData {
  let expenses = data.expenses;
  const suppressed = data.cleaningForecastSuppressed;

  for (const booking of data.bookings) {
    if (booking.propertyId !== propertyId) {
      continue;
    }

    expenses = upsertCleaningExpense(
      expenses,
      booking,
      data.properties,
      suppressed,
    );
  }

  return {
    ...data,
    expenses,
  };
}

export function syncMissingBookingCleaning(data: DashboardData): DashboardData {
  let expenses = data.expenses;
  const suppressed = data.cleaningForecastSuppressed;

  for (const booking of data.bookings) {
    if (!bookingEligibleForAutoCleaning(booking)) {
      expenses = removeCleaningExpensesForBooking(expenses, booking.id);
      continue;
    }

    expenses = upsertCleaningExpense(
      expenses,
      booking,
      data.properties,
      suppressed,
    );
  }

  return {
    ...data,
    expenses,
  };
}
