import {
  getFiscalBookingAllocations,
  monthEndDate,
} from "./booking-allocation";
import {
  removeCleaningExpensesForBooking,
  upsertCleaningExpense,
} from "./booking-cleaning";
import {
  removeCommissionExpensesForBooking,
  upsertCommissionExpense,
} from "./booking-commission";
import { hasManualCategoryInMonth } from "./expense-dedup";
import type {
  Booking,
  DashboardData,
  Expense,
  ExpenseCategory,
  Platform,
  Property,
} from "./types";

const VAT_CATEGORY_ID = "iva";

/** Piattaforme esenti IVA (es. prenotazioni dirette: importo già netto/fuori campo). */
export const VAT_EXEMPT_PLATFORM_IDS = new Set([
  "diretta",
  "prenotazione-diretta",
]);

/** Aliquota IVA inclusa nel lordo incassato (es. 0,10 = 10%). */
const PLATFORM_VAT_RATES: Record<string, number> = {
  booking: 0.1,
  airbnb: 0.1,
};

export function isVatExemptPlatform(platformId: string): boolean {
  return VAT_EXEMPT_PLATFORM_IDS.has(platformId);
}

export function getBookingVatRate(platformId: string): number {
  if (isVatExemptPlatform(platformId)) {
    return 0;
  }

  return PLATFORM_VAT_RATES[platformId] ?? 0;
}

/** Scorporo IVA da lordo tax-inclusive: IVA = lordo − lordo / (1 + aliquota). */
export function calculateBookingVat(booking: Booking): number {
  const rate = getBookingVatRate(booking.platformId);
  const grossIncome = Math.max(0, Number(booking.grossIncome) || 0);

  if (rate <= 0 || grossIncome <= 0) {
    return 0;
  }

  const vat = grossIncome - grossIncome / (1 + rate);
  return Math.round(vat * 100) / 100;
}

export function calculateBookingNetFromGross(
  booking: Booking,
): number | null {
  const rate = getBookingVatRate(booking.platformId);
  const grossIncome = Math.max(0, Number(booking.grossIncome) || 0);

  if (rate <= 0 || grossIncome <= 0) {
    return null;
  }

  return Math.round((grossIncome / (1 + rate)) * 100) / 100;
}

export function isLinkedVatExpense(expense: Expense): boolean {
  return (
    Boolean(expense.linkedBookingId) && expense.linkedExpenseKind === "vat"
  );
}

export function buildVatExpenses(
  booking: Booking,
  platforms: Platform[],
  expenses: Expense[] = [],
): Omit<Expense, "id">[] {
  const vatTotal = calculateBookingVat(booking);

  if (vatTotal <= 0) {
    return [];
  }

  const platformName =
    platforms.find((platform) => platform.id === booking.platformId)?.name ??
    booking.platformId;
  const ratePercent = Math.round(getBookingVatRate(booking.platformId) * 100);
  const allocations = getFiscalBookingAllocations(booking);

  return allocations
    .filter(
      (allocation) =>
        !hasManualCategoryInMonth(
          expenses,
          booking.propertyId,
          VAT_CATEGORY_ID,
          allocation.period,
        ),
    )
    .map((allocation) => ({
      date: monthEndDate(allocation.period.year, allocation.period.month),
      propertyId: booking.propertyId,
      categoryId: VAT_CATEGORY_ID,
      description: `IVA ${platformName} ${ratePercent}% (scorporo) — ${booking.description}`,
      amount: Math.round(vatTotal * allocation.share * 100) / 100,
      linkedBookingId: booking.id,
      linkedExpenseKind: "vat" as const,
      notes: "IVA sul lordo incassato, generata automaticamente dall'incasso",
    }));
}

export function upsertVatExpense(
  expenses: Expense[],
  booking: Booking,
  platforms: Platform[],
): Expense[] {
  const withoutVat = expenses.filter(
    (expense) =>
      !(
        expense.linkedBookingId === booking.id &&
        expense.linkedExpenseKind === "vat"
      ),
  );
  const built = buildVatExpenses(booking, platforms, withoutVat);

  if (built.length === 0) {
    return withoutVat;
  }

  const linked = built.map((expense) => {
    const existing = expenses.find(
      (item) =>
        item.linkedBookingId === booking.id &&
        item.linkedExpenseKind === "vat" &&
        item.date === expense.date,
    );

    return {
      ...expense,
      id: existing?.id ?? crypto.randomUUID(),
    };
  });

  return [...withoutVat, ...linked];
}

export function removeVatExpensesForBooking(
  expenses: Expense[],
  bookingId: string,
): Expense[] {
  return expenses.filter(
    (expense) =>
      !(
        expense.linkedBookingId === bookingId &&
        expense.linkedExpenseKind === "vat"
      ),
  );
}

function shouldGenerateLinkedVat(booking: Booking): boolean {
  if (booking.importedFromExcel || booking.legacyIncomeAttribution) {
    return false;
  }

  if (isVatExemptPlatform(booking.platformId)) {
    return false;
  }

  return calculateBookingVat(booking) > 0;
}

export function upsertAllBookingLinkedExpenses(
  expenses: Expense[],
  booking: Booking,
  categories: ExpenseCategory[],
  platforms: Platform[],
  properties: Property[],
): Expense[] {
  if (booking.importedFromExcel || booking.legacyIncomeAttribution) {
    return removeAllBookingLinkedExpenses(expenses, booking.id);
  }

  let next = upsertCommissionExpense(
    expenses,
    booking,
    categories,
    platforms,
  );

  next = upsertCleaningExpense(next, booking, properties);

  if (!shouldGenerateLinkedVat(booking)) {
    return removeVatExpensesForBooking(next, booking.id);
  }

  return upsertVatExpense(next, booking, platforms);
}

export function removeAllBookingLinkedExpenses(
  expenses: Expense[],
  bookingId: string,
): Expense[] {
  return removeVatExpensesForBooking(
    removeCleaningExpensesForBooking(
      removeCommissionExpensesForBooking(expenses, bookingId),
      bookingId,
    ),
    bookingId,
  );
}

export function isLinkedBookingExpense(expense: Expense): boolean {
  return Boolean(expense.linkedBookingId);
}

export function syncMissingBookingVat(data: DashboardData): DashboardData {
  let expenses = data.expenses;

  for (const booking of data.bookings) {
    if (!shouldGenerateLinkedVat(booking)) {
      expenses = removeVatExpensesForBooking(expenses, booking.id);
      continue;
    }

    expenses = upsertVatExpense(expenses, booking, data.platforms);
  }

  return {
    ...data,
    expenses,
  };
}
