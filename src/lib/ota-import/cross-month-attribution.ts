import { getPeriodFromDate } from "../calculations";
import { MONTH_LABELS } from "../constants";
import type { MonthPeriod } from "../types";

export interface CrossMonthAttribution {
  externalId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  attributionPeriod: MonthPeriod;
}

export function getCheckInPeriod(checkIn: string): MonthPeriod {
  return getPeriodFromDate(checkIn);
}

export function isCheckInOutsideImportPeriod(
  checkIn: string,
  importPeriod: MonthPeriod,
): boolean {
  const checkInPeriod = getCheckInPeriod(checkIn);
  return (
    checkInPeriod.year !== importPeriod.year ||
    checkInPeriod.month !== importPeriod.month
  );
}

export function findCrossMonthAttributions<
  T extends {
    externalId: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
  },
>(reservations: T[], importPeriod: MonthPeriod): CrossMonthAttribution[] {
  return reservations
    .filter((reservation) =>
      isCheckInOutsideImportPeriod(reservation.checkIn, importPeriod),
    )
    .map((reservation) => ({
      externalId: reservation.externalId,
      guestName: reservation.guestName,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      attributionPeriod: getCheckInPeriod(reservation.checkIn),
    }));
}

export function formatAttributionMonth(period: MonthPeriod): string {
  return `${MONTH_LABELS[period.month - 1]} ${period.year}`;
}
