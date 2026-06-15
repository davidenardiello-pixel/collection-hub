import { getFiscalBookingAllocations } from "./booking-allocation";
import { getBookingNights, sumBookingsInPeriod } from "./calculations";
import { OCCUPANCY_METRICS_START_MONTH } from "./constants";
import type { Booking, MonthPeriod } from "./types";

export function occupancyMetricsAvailable(month: number): boolean {
  return month >= OCCUPANCY_METRICS_START_MONTH;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getBookedNightsInPeriod(
  bookings: Booking[],
  period: MonthPeriod,
  propertyId?: string,
): number {
  const scoped = propertyId
    ? bookings.filter((booking) => booking.propertyId === propertyId)
    : bookings;

  let total = 0;

  for (const booking of scoped) {
    const nights = getBookingNights(booking);

    if (nights <= 0) {
      continue;
    }

    for (const allocation of getFiscalBookingAllocations(booking)) {
      if (
        allocation.period.year === period.year &&
        allocation.period.month === period.month
      ) {
        total += allocation.share * nights;
      }
    }
  }

  return Math.round(total * 100) / 100;
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
  const bookedNights = getBookedNightsInPeriod(bookings, period, propertyId);
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
