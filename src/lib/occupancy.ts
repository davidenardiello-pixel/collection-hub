import {
  bookingAppliesToPeriod,
  getOccupiedCalendarDatesInPeriod,
} from "./booking-allocation";
import { parseDate, sumBookingsInPeriod } from "./calculations";
import { OCCUPANCY_METRICS_START_MONTH } from "./constants";
import type { Booking, MonthPeriod } from "./types";

export function occupancyMetricsAvailable(month: number): boolean {
  return month >= OCCUPANCY_METRICS_START_MONTH;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDateIso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatReferenceDateIso(referenceDate: Date): string {
  return formatDateIso(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    referenceDate.getDate(),
  );
}

export function getMonthCalendarDates(period: MonthPeriod): string[] {
  const daysInMonth = getDaysInMonth(period.year, period.month);
  return Array.from({ length: daysInMonth }, (_, index) =>
    formatDateIso(period.year, period.month, index + 1),
  );
}

/** Totali Excel / rendita mensile: non sono soggiorni reali per l'occupazione. */
export function isOccupancyEligibleBooking(booking: Booking): boolean {
  if (booking.importedFromExcel && booking.legacyIncomeAttribution) {
    return false;
  }

  return true;
}

export function getOccupiedDatesInPeriod(
  bookings: Booking[],
  period: MonthPeriod,
  propertyId?: string,
): Set<string> {
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

  return occupiedDates;
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
  return getOccupiedDatesInPeriod(bookings, period, propertyId).size;
}

export interface DateRange {
  start: string;
  end: string;
}

function nextCalendarDateIso(dateIso: string): string {
  const date = parseDate(dateIso);
  date.setDate(date.getDate() + 1);
  return formatDateIso(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
}

export function groupConsecutiveDates(dates: string[]): DateRange[] {
  if (dates.length === 0) {
    return [];
  }

  const sorted = [...dates].sort();
  const ranges: DateRange[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let index = 1; index < sorted.length; index++) {
    const current = sorted[index];
    if (current === nextCalendarDateIso(end)) {
      end = current;
      continue;
    }

    ranges.push({ start, end });
    start = current;
    end = current;
  }

  ranges.push({ start, end });
  return ranges;
}

export function formatDateRangeItalian(range: DateRange): string {
  const startLabel = parseDate(range.start).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
  if (range.start === range.end) {
    return startLabel;
  }

  const endLabel = parseDate(range.end).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
  return `${startLabel} – ${endLabel}`;
}

export function splitFreeDaysByReference(
  period: MonthPeriod,
  occupiedDates: Set<string>,
  referenceDate: Date,
): {
  pastFreeDays: number;
  potentialBookableDays: number;
  pastFreeDates: string[];
  potentialBookableDates: string[];
} {
  const todayIso = formatReferenceDateIso(referenceDate);
  const pastFreeDates: string[] = [];
  const potentialBookableDates: string[] = [];

  for (const dateIso of getMonthCalendarDates(period)) {
    if (occupiedDates.has(dateIso)) {
      continue;
    }

    if (dateIso < todayIso) {
      pastFreeDates.push(dateIso);
    } else {
      potentialBookableDates.push(dateIso);
    }
  }

  return {
    pastFreeDays: pastFreeDates.length,
    potentialBookableDays: potentialBookableDates.length,
    pastFreeDates,
    potentialBookableDates,
  };
}

export interface PropertyMonthOccupancy {
  daysInMonth: number;
  bookedNights: number;
  availableNights: number;
  pastFreeDays: number;
  potentialBookableDays: number;
  pastFreeRanges: DateRange[];
  potentialBookableRanges: DateRange[];
  occupancyRate: number;
  /** Occupazione massima se si riempiono tutti i giorni ancora liberi (da oggi). */
  potentialMaxOccupancyRate: number;
  /** Quota del mese ancora occupabile (% punti sul totale giorni del mese). */
  remainingOccupancyPotential: number;
  grossIncome: number;
  averageDailyRate: number;
  referenceDate: string;
}

export function getPropertyMonthOccupancy(
  bookings: Booking[],
  period: MonthPeriod,
  propertyId: string,
  referenceDate = new Date(),
): PropertyMonthOccupancy {
  const daysInMonth = getDaysInMonth(period.year, period.month);
  const occupiedDates = getOccupiedDatesInPeriod(bookings, period, propertyId);
  const bookedNights = occupiedDates.size;
  const propertyBookings = bookings.filter(
    (booking) => booking.propertyId === propertyId,
  );
  const grossIncome = sumBookingsInPeriod(propertyBookings, period);
  const availableNights = Math.max(0, daysInMonth - bookedNights);
  const occupancyRate = daysInMonth > 0 ? bookedNights / daysInMonth : 0;
  const averageDailyRate = bookedNights > 0 ? grossIncome / bookedNights : 0;

  const {
    pastFreeDays,
    potentialBookableDays,
    pastFreeDates,
    potentialBookableDates,
  } = splitFreeDaysByReference(period, occupiedDates, referenceDate);

  const pastFreeRanges = groupConsecutiveDates(pastFreeDates);
  const potentialBookableRanges = groupConsecutiveDates(potentialBookableDates);
  const potentialMaxOccupancyRate =
    daysInMonth > 0
      ? (bookedNights + potentialBookableDays) / daysInMonth
      : 0;
  const remainingOccupancyPotential =
    daysInMonth > 0 ? potentialBookableDays / daysInMonth : 0;

  return {
    daysInMonth,
    bookedNights,
    availableNights,
    pastFreeDays,
    potentialBookableDays,
    pastFreeRanges,
    potentialBookableRanges,
    occupancyRate,
    potentialMaxOccupancyRate,
    remainingOccupancyPotential,
    grossIncome,
    averageDailyRate,
    referenceDate: formatReferenceDateIso(referenceDate),
  };
}
