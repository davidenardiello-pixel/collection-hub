import { FISCAL_YEAR } from "./constants";
import type { Booking, MonthPeriod } from "./types";

export interface BookingAllocation {
  period: MonthPeriod;
  share: number;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getPeriodFromDate(value: string): MonthPeriod {
  const date = parseDate(value);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function periodKey(period: MonthPeriod): string {
  return `${period.year}-${period.month}`;
}

function isInFiscalYear(period: MonthPeriod): boolean {
  return period.year === FISCAL_YEAR;
}

function getBookingNights(booking: Booking): number {
  const start = parseDate(booking.checkIn);
  const end = parseDate(booking.checkOut);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(diff, 0);
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function nextMonth(period: MonthPeriod): MonthPeriod {
  if (period.month === 12) {
    return { year: period.year + 1, month: 1 };
  }

  return { year: period.year, month: period.month + 1 };
}

function countNightsByMonth(booking: Booking): Map<string, number> {
  const start = parseDate(booking.checkIn);
  const end = parseDate(booking.checkOut);
  const counts = new Map<string, number>();
  const cursor = new Date(start);

  while (cursor < end) {
    const period = {
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
    };
    const key = periodKey(period);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    cursor.setDate(cursor.getDate() + 1);
  }

  return counts;
}

/** Notti reali di soggiorno nel mese (date check-in → check-out, non competenza incasso). */
export function countBookingNightsInCalendarPeriod(
  booking: Booking,
  period: MonthPeriod,
): number {
  const counts = countNightsByMonth(booking);
  return counts.get(periodKey(period)) ?? 0;
}

function allocationsFromNightSplit(booking: Booking): BookingAllocation[] {
  const nightCounts = countNightsByMonth(booking);
  const totalNights = getBookingNights(booking);

  if (totalNights <= 0 || nightCounts.size === 0) {
    const checkoutPeriod = getPeriodFromDate(booking.checkOut);
    return [{ period: checkoutPeriod, share: 1 }];
  }

  return Array.from(nightCounts.entries()).map(([key, nights]) => {
    const [year, month] = key.split("-").map(Number);
    return {
      period: { year, month },
      share: nights / totalNights,
    };
  });
}

function getLegacyCheckInAllocation(booking: Booking): BookingAllocation[] {
  return [{ period: getPeriodFromDate(booking.checkIn), share: 1 }];
}

function getOtaImportScopeAllocation(booking: Booking): BookingAllocation[] | null {
  if (!booking.otaImportScope) {
    return null;
  }

  const match = booking.otaImportScope.match(/:(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }

  return [
    {
      period: { year: Number(match[1]), month: Number(match[2]) },
      share: 1,
    },
  ];
}

export function getBookingAllocations(booking: Booking): BookingAllocation[] {
  const otaScopeAllocation = getOtaImportScopeAllocation(booking);
  if (otaScopeAllocation) {
    return otaScopeAllocation;
  }

  if (booking.importedFromExcel || booking.legacyIncomeAttribution) {
    return getLegacyCheckInAllocation(booking);
  }

  const checkIn = parseDate(booking.checkIn);
  const checkInPeriod = getPeriodFromDate(booking.checkIn);
  const lastDay = getLastDayOfMonth(checkInPeriod.year, checkInPeriod.month);
  const day = checkIn.getDate();

  if (day === lastDay) {
    return [{ period: nextMonth(checkInPeriod), share: 1 }];
  }

  if (day === lastDay - 1) {
    return allocationsFromNightSplit(booking);
  }

  return [{ period: getPeriodFromDate(booking.checkOut), share: 1 }];
}

export function getBookingShareInPeriod(
  booking: Booking,
  period: MonthPeriod,
): number {
  return getBookingAllocations(booking).reduce((share, allocation) => {
    if (
      allocation.period.year === period.year &&
      allocation.period.month === period.month
    ) {
      return share + allocation.share;
    }

    return share;
  }, 0);
}

export function bookingAppliesToPeriod(
  booking: Booking,
  period: MonthPeriod,
): boolean {
  return getBookingShareInPeriod(booking, period) > 0;
}

export function getAllocatedBookingAmount(
  booking: Booking,
  period: MonthPeriod,
  amount: number,
): number {
  const share = getBookingShareInPeriod(booking, period);
  return Math.round(amount * share * 100) / 100;
}

export function getFiscalBookingAllocations(
  booking: Booking,
): BookingAllocation[] {
  const allocations = getBookingAllocations(booking).filter((allocation) =>
    isInFiscalYear(allocation.period),
  );
  const totalShare = allocations.reduce(
    (sum, allocation) => sum + allocation.share,
    0,
  );

  if (totalShare <= 0) {
    return [];
  }

  if (Math.abs(totalShare - 1) < 0.0001) {
    return allocations;
  }

  return allocations.map((allocation) => ({
    ...allocation,
    share: allocation.share / totalShare,
  }));
}

export function monthEndDate(year: number, month: number): string {
  const lastDay = getLastDayOfMonth(year, month);
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}
