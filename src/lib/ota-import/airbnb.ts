import { refreshAutomatedCleaningExpenses } from "../automation";
import { getPeriodFromDate } from "../calculations";
import {
  removeAllBookingLinkedExpenses,
  upsertAllBookingLinkedExpenses,
} from "../booking-vat";
import type { Booking, DashboardData, Expense } from "../types";

export const AIRBNB_PLATFORM_ID = "airbnb";
export const AIRBNB_IMPORT_PREFIX = "airbnb";

export interface AirbnbReservation {
  externalId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  /** Guadagni Airbnb: netto al host (commissioni OTA già dedotte). */
  netEarnings: number;
  nights: number;
  status?: string;
}

export interface AirbnbSyncPeriod {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

export interface AirbnbSyncPreview {
  scope: string;
  period: AirbnbSyncPeriod;
  added: number;
  updated: number;
  removed: number;
  locked: number;
  removedGuests: string[];
  reservations: AirbnbReservation[];
}

export function buildAirbnbImportScope(
  propertyId: string,
  period: AirbnbSyncPeriod,
): string {
  return `${AIRBNB_IMPORT_PREFIX}:${propertyId}:${period.year}-${String(period.month).padStart(2, "0")}`;
}

export function buildAirbnbSyncPeriod(
  year: number,
  month: number,
): AirbnbSyncPeriod {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    year,
    month,
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
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

function isManagedAirbnbBooking(
  booking: Booking,
  propertyId: string,
  scope: string,
  period: AirbnbSyncPeriod,
): boolean {
  if (
    booking.propertyId !== propertyId ||
    booking.platformId !== AIRBNB_PLATFORM_ID ||
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

function removeManualOtaMonthExpenses(
  expenses: Expense[],
  propertyId: string,
  period: AirbnbSyncPeriod,
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

    return expense.categoryId !== "iva";
  });
}

export function syncAirbnbReservations(
  data: DashboardData,
  propertyId: string,
  period: AirbnbSyncPeriod,
  reservations: AirbnbReservation[],
  referenceDate = new Date(),
): { data: DashboardData; preview: AirbnbSyncPreview } {
  const scope = buildAirbnbImportScope(propertyId, period);
  const incomingIds = new Set(reservations.map((item) => item.externalId));

  const managedBookings = data.bookings.filter((booking) =>
    isManagedAirbnbBooking(booking, propertyId, scope, period),
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
      platformId: AIRBNB_PLATFORM_ID,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      grossIncome: reservation.netEarnings,
      cleaningFee: 0,
      otaCommission: 0,
      externalId: reservation.externalId,
      otaImportScope: scope,
      locked: shouldLock,
      importedFromExcel: false,
      legacyIncomeAttribution: false,
      notes: "Import Airbnb — guadagni netti (commissioni già dedotte)",
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
