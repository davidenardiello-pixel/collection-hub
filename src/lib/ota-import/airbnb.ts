import { refreshAutomatedCleaningExpenses } from "../automation";
import { getPeriodFromDate } from "../calculations";
import {
  findCrossMonthAttributions,
  type CrossMonthAttribution,
} from "./cross-month-attribution";
import {
  removeAllBookingLinkedExpenses,
  upsertAllBookingLinkedExpenses,
} from "../booking-vat";
import type { Booking, DashboardData, Expense, Property } from "../types";
import { deriveAirbnbBookingAmounts, getAirbnbCommissionRate } from "./airbnb-pricing";

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
  crossMonthAttributions: CrossMonthAttribution[];
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

    return expense.categoryId !== "iva" && expense.categoryId !== "com-airbnb";
  });
}

export function hostNetFromAirbnbBooking(booking: Booking): number | null {
  const fromNotes = booking.notes?.match(
    /(?:Guadagni|netto host)\s+([\d.,]+)\s*€/i,
  );
  if (fromNotes) {
    return (
      Math.round(Number(fromNotes[1].replace(",", ".")) * 100) / 100
    );
  }

  const gross = Math.max(0, Number(booking.grossIncome) || 0);
  const commission = Math.max(0, Number(booking.otaCommission) || 0);
  const inferred = Math.round((gross - commission) * 100) / 100;

  return inferred > 0 ? inferred : null;
}

/** Ricalcola lordo/commissione import Airbnb con formula Guadagni ÷ (1 − rate). */
export function resyncAirbnbOtaBooking(
  booking: Booking,
  property?: Property,
): Booking {
  if (
    booking.importedFromExcel ||
    booking.legacyIncomeAttribution ||
    booking.platformId !== AIRBNB_PLATFORM_ID ||
    !booking.otaImportScope?.startsWith(`${AIRBNB_IMPORT_PREFIX}:`)
  ) {
    return booking;
  }

  const hostNet = hostNetFromAirbnbBooking(booking);
  if (hostNet == null) {
    return booking;
  }

  const amounts = deriveAirbnbBookingAmounts(
    hostNet,
    getAirbnbCommissionRate(property),
  );

  if (
    booking.grossIncome === amounts.grossIncome &&
    booking.otaCommission === amounts.otaCommission
  ) {
    return booking;
  }

  return {
    ...booking,
    grossIncome: amounts.grossIncome,
    cleaningFee: 0,
    otaCommission: amounts.otaCommission,
    notes: `Import Airbnb — Guadagni ${amounts.hostNet.toFixed(2)} € (netto host), lordo cliente ${amounts.grossIncome.toFixed(2)} € (ricostruito ÷ ${(1 - amounts.commissionRate).toFixed(3)})`,
  };
}

export function resyncAirbnbOtaBookings(
  bookings: Booking[],
  properties: Property[],
): Booking[] {
  const propertyMap = new Map(properties.map((property) => [property.id, property]));

  return bookings.map((booking) =>
    resyncAirbnbOtaBooking(
      booking,
      propertyMap.get(booking.propertyId),
    ),
  );
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
    const property = data.properties.find((item) => item.id === propertyId);
    const amounts = deriveAirbnbBookingAmounts(
      reservation.netEarnings,
      getAirbnbCommissionRate(property),
    );
    const payload: Booking = {
      ...(existing ?? { id: crypto.randomUUID() }),
      description: reservation.guestName,
      propertyId,
      platformId: AIRBNB_PLATFORM_ID,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      grossIncome: amounts.grossIncome,
      cleaningFee: 0,
      otaCommission: amounts.otaCommission,
      externalId: reservation.externalId,
      otaImportScope: scope,
      locked: shouldLock,
      importedFromExcel: false,
      legacyIncomeAttribution: false,
      notes: `Import Airbnb — Guadagni ${amounts.hostNet.toFixed(2)} € (netto host), lordo cliente ${amounts.grossIncome.toFixed(2)} € (ricostruito ÷ ${(1 - amounts.commissionRate).toFixed(3)})`,
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
      crossMonthAttributions: findCrossMonthAttributions(reservations, period),
    },
  };
}
