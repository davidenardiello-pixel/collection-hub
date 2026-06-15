import {
  bookingAppliesToPeriod,
  getOccupiedCalendarDatesInPeriod,
} from "./booking-allocation";
import { sumBookingsInPeriod } from "./calculations";
import { OCCUPANCY_METRICS_START_MONTH } from "./constants";
import type { Booking, MonthPeriod } from "./types";

export function occupancyMetricsAvailable(month: number): boolean {
  return month >= OCCUPANCY_METRICS_START_MONTH;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Totali Excel / rendita mensile: non sono soggiorni reali per l'occupazione. */
export function isOccupancyEligibleBooking(booking: Booking): boolean {
  if (booking.importedFromExcel && booking.legacyIncomeAttribution) {
    return false;
  }

  return true;
}

/**
 * Occupazione = stesse prenotazioni visibili in Incassi per il mese (competenza),
 * con date check-in → check-out sul calendario. Giorni unici (no doppio conteggio).
 */
export function countUniqueOccupiedDaysInPeriod(
  bookings: Booking[],
  period: MonthPeriod,
  propertyId?: string,
): number {
  const occupiedDates = new Set<string>();

  for (const booking of bookings) {
    if (propertyId && booking.propertyId !== propertyId) {
      continue;
    }

    if (!isOccupancyEligibleBooking(booking)) {
      continue;
    }

    if (!bookingAppliesToPeriod(booking, period)) {
      continue;
    }

    for (const date of getOccupiedCalendarDatesInPeriod(booking, period)) {
      occupiedDates.add(date);
    }
  }

  return occupiedDates.size;
}

export interface PropertyMonthOccupancy {
  daysInMonth: number;
  bookedNights: number;
  availableNights: number;
  occupancyRate: number;
  grossIncome: number;
  averageDailyRate: number;
}

export function getPropertyMonthOccupancy(
  bookings: Booking[],
  period: MonthPeriod,
  propertyId: string,
): PropertyMonthOccupancy {
  const daysInMonth = getDaysInMonth(period.year, period.month);
  const bookedNights = countUniqueOccupiedDaysInPeriod(
    bookings,
    period,
    propertyId,
  );
  const propertyBookings = bookings.filter(
    (booking) => booking.propertyId === propertyId,
  );
  const grossIncome = sumBookingsInPeriod(propertyBookings, period);
  const availableNights = Math.max(0, daysInMonth - bookedNights);
  const occupancyRate = daysInMonth > 0 ? bookedNights / daysInMonth : 0;
  const averageDailyRate = bookedNights > 0 ? grossIncome / bookedNights : 0;

  return {
    daysInMonth,
    bookedNights,
    availableNights,
    occupancyRate,
    grossIncome,
    averageDailyRate,
  };
}
