import { refreshAutomatedCleaningExpenses } from "../automation";
import { getPeriodFromDate } from "../calculations";
import {
  removeAllBookingLinkedExpenses,
  upsertAllBookingLinkedExpenses,
} from "../booking-vat";
import type { Booking, DashboardData, Expense } from "../types";

export const BOOKING_COM_PLATFORM_ID = "booking";
export const BOOKING_COM_IMPORT_PREFIX = "booking-com";

/** Costo pagamento Booking oltre alla % commissione OTA (PDF: "Commissione e costi"). */
export const BOOKING_PAYMENT_FEE_PCT = 1.5;

export function bookingCommissionAndCosts(
  grossIncome: number,
  commissionPct = 18,
): number {
  const totalPct = commissionPct + BOOKING_PAYMENT_FEE_PCT;
  return Math.round(((grossIncome * totalPct) / 100) * 100) / 100;
}

export interface BookingComReservation {
  externalId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  grossIncome: number;
  otaCommission: number;
  nights: number;
}

export interface BookingComSyncPeriod {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

export interface BookingComSyncPreview {
  scope: string;
  period: BookingComSyncPeriod;
  added: number;
  updated: number;
  removed: number;
  locked: number;
  removedGuests: string[];
  reservations: BookingComReservation[];
}

export function buildBookingComImportScope(
  propertyId: string,
  period: BookingComSyncPeriod,
): string {
  return `${BOOKING_COM_IMPORT_PREFIX}:${propertyId}:${period.year}-${String(period.month).padStart(2, "0")}`;
}

export function parseBookingComPeriodFromFilename(
  filename: string,
): BookingComSyncPeriod | null {
  const match = filename.match(
    /(\d{4})-(\d{2})-(\d{2})\s*-\s*(\d{4})-(\d{2})-(\d{2})/,
  );

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    startDate: `${match[1]}-${match[2]}-${match[3]}`,
    endDate: `${match[4]}-${match[5]}-${match[6]}`,
  };
}

function isCheckInOnOrBeforeToday(checkIn: string, referenceDate: Date): boolean {
  const [year, month, day] = checkIn.split("-").map(Number);
  const checkInDate = new Date(year, month - 1, day);
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );

  return checkInDate <= today;
}

function isManagedBookingComBooking(
  booking: Booking,
  propertyId: string,
  scope: string,
  period: BookingComSyncPeriod,
): boolean {
  if (
    booking.propertyId !== propertyId ||
    booking.platformId !== BOOKING_COM_PLATFORM_ID ||
    booking.importedFromExcel
  ) {
    return false;
  }

  if (booking.otaImportScope === scope) {
    return true;
  }

  if (!booking.externalId) {
    return false;
  }

  return booking.checkIn >= period.startDate && booking.checkIn <= period.endDate;
}

/** Rimuove totali manuali commissione/IVA sostituiti dalle spese collegate all'import. */
function removeManualOtaMonthExpenses(
  expenses: Expense[],
  propertyId: string,
  period: BookingComSyncPeriod,
): Expense[] {
  return expenses.filter((expense) => {
    if (
      expense.propertyId !== propertyId ||
      expense.importedFromExcel ||
      expense.linkedBookingId ||
      expense.automationId
    ) {
      return true;
    }

    const expensePeriod = getPeriodFromDate(expense.date);
    if (
      expensePeriod.year !== period.year ||
      expensePeriod.month !== period.month
    ) {
      return true;
    }

    return expense.categoryId !== "com-booking" && expense.categoryId !== "iva";
  });
}

export function syncBookingComReservations(
  data: DashboardData,
  propertyId: string,
  period: BookingComSyncPeriod,
  reservations: BookingComReservation[],
  referenceDate = new Date(),
): { data: DashboardData; preview: BookingComSyncPreview } {
  const scope = buildBookingComImportScope(propertyId, period);
  const incomingIds = new Set(reservations.map((item) => item.externalId));

  const managedBookings = data.bookings.filter((booking) =>
    isManagedBookingComBooking(booking, propertyId, scope, period),
  );

  const removedBookings = managedBookings.filter(
    (booking) =>
      booking.externalId &&
      !incomingIds.has(booking.externalId) &&
      !booking.locked,
  );
  const removeIds = new Set(removedBookings.map((booking) => booking.id));

  let expenses = removeManualOtaMonthExpenses(
    data.expenses,
    propertyId,
    period,
  );

  for (const bookingId of removeIds) {
    expenses = removeAllBookingLinkedExpenses(expenses, bookingId);
  }

  let bookings = data.bookings.filter((booking) => !removeIds.has(booking.id));

  let added = 0;
  let updated = 0;
  let locked = 0;

  for (const reservation of reservations) {
    const existing = bookings.find(
      (booking) =>
        booking.propertyId === propertyId &&
        booking.externalId === reservation.externalId,
    );
    const shouldLock =
      existing?.locked ||
      isCheckInOnOrBeforeToday(reservation.checkIn, referenceDate);
    const payload: Booking = {
      ...(existing ?? { id: crypto.randomUUID() }),
      description: reservation.guestName,
      propertyId,
      platformId: BOOKING_COM_PLATFORM_ID,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      grossIncome: reservation.grossIncome,
      cleaningFee: 0,
      otaCommission: reservation.otaCommission,
      externalId: reservation.externalId,
      otaImportScope: scope,
      locked: shouldLock,
      importedFromExcel: false,
      legacyIncomeAttribution: false,
    };

    if (existing) {
      updated += 1;
      bookings = bookings.map((booking) =>
        booking.id === existing.id ? payload : booking,
      );
    } else {
      added += 1;
      bookings = [payload, ...bookings];
    }

    if (shouldLock) {
      locked += 1;
    }

    expenses = upsertAllBookingLinkedExpenses(
      expenses,
      payload,
      data.expenseCategories,
      data.platforms,
      data.properties,
    );
  }

  const nextData = refreshAutomatedCleaningExpenses({
    ...data,
    bookings,
    expenses,
  });

  return {
    data: nextData,
    preview: {
      scope,
      period,
      added,
      updated,
      removed: removeIds.size,
      locked,
      removedGuests: removedBookings.map(
        (booking) => booking.description || booking.externalId || "Prenotazione",
      ),
      reservations,
    },
  };
}
