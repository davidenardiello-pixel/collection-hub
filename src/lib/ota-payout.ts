import {
  getBankAccountLabel,
  getBookingBankDeposit,
  getPropertyBankAccount,
  isCashPlatform,
} from "./bank-accounts";
import { getBookingTotal } from "./calculations";
import { getReceivedTotalForBatch } from "./payout-batch-alloc";
import type { BankAccountId, BankPayoutReceived, Booking, Property } from "./types";

export type OtaPayoutPlatform = "booking" | "airbnb" | "vrbo";

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Primo giorno lavorativo dopo la data (esclusi sabato e domenica). */
export function nextBusinessDayAfter(date: Date): Date {
  let cursor = addCalendarDays(date, 1);
  while (isWeekend(cursor)) {
    cursor = addCalendarDays(cursor, 1);
  }
  return cursor;
}

/**
 * Booking.com: check-out in settimana gio–mer → bonifico il giovedì successivo.
 */
export function getBookingComPayoutDate(checkOut: string): Date {
  const checkout = parseIsoDate(checkOut);
  const weekday = checkout.getDay();
  const daysSinceThursday = (weekday - 4 + 7) % 7;
  const periodStartThursday = addCalendarDays(checkout, -daysSinceThursday);
  return addCalendarDays(periodStartThursday, 7);
}

export function getOtaPayoutPlatform(
  platformId: string,
): OtaPayoutPlatform | null {
  if (platformId === "booking") {
    return "booking";
  }
  if (platformId === "airbnb") {
    return "airbnb";
  }
  if (platformId === "vrbo") {
    return "vrbo";
  }
  return null;
}

export function formatExpectedPayoutBatch(
  platform: OtaPayoutPlatform,
  payoutDate: Date,
): string {
  const iso = formatIsoDate(payoutDate);
  if (platform === "booking") {
    return `BK-${iso}`;
  }
  if (platform === "airbnb") {
    return `ABB-${iso}`;
  }
  return `VRBO-${iso}`;
}

export function resolveExpectedPayout(booking: Booking): {
  expectedPayoutDate?: string;
  expectedPayoutBatch?: string;
} {
  if (isCashPlatform(booking.platformId)) {
    return {};
  }

  const ota = getOtaPayoutPlatform(booking.platformId);
  if (!ota) {
    return {};
  }

  let payoutDate: Date;
  if (ota === "booking") {
    payoutDate = getBookingComPayoutDate(booking.checkOut);
  } else {
    payoutDate = nextBusinessDayAfter(parseIsoDate(booking.checkIn));
  }

  return {
    expectedPayoutDate: formatIsoDate(payoutDate),
    expectedPayoutBatch: formatExpectedPayoutBatch(ota, payoutDate),
  };
}

export function applyExpectedPayoutFields(booking: Booking): Booking {
  const payout = resolveExpectedPayout(booking);
  return {
    ...booking,
    expectedPayoutDate: payout.expectedPayoutDate,
    expectedPayoutBatch: payout.expectedPayoutBatch,
  };
}

export function getBookingGrossTotal(booking: Booking): number {
  return getBookingTotal(booking);
}

export function getBookingNetBankDeposit(booking: Booking): number {
  return getBookingBankDeposit(booking);
}

export function isPayoutRelevantBooking(booking: Booking): boolean {
  return Boolean(getOtaPayoutPlatform(booking.platformId));
}

export function payoutDateInMonth(
  expectedPayoutDate: string | undefined,
  year: number,
  month: number,
): boolean {
  if (!expectedPayoutDate) {
    return false;
  }
  const date = parseIsoDate(expectedPayoutDate);
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}

export type PayoutBatchStatus = "ok" | "difference" | "missing" | "pending";

export interface PayoutBatchRow {
  batchId: string;
  platformId: string;
  platformName: string;
  expectedPayoutDate: string;
  bankAccountIds: BankAccountId[];
  bankAccountLabels: string[];
  bookingCount: number;
  grossTotal: number;
  commissionTotal: number;
  netExpected: number;
  receivedTotal: number;
  difference: number;
  status: PayoutBatchStatus;
  bookings: Booking[];
}

export interface PayoutReconciliationSummary {
  batches: PayoutBatchRow[];
  unmatchedReceivedTotal: number;
  missingBatchCount: number;
  differenceBatchCount: number;
}

const AMOUNT_TOLERANCE = 0.02;

export function buildPayoutReconciliation(
  bookings: Booking[],
  properties: Property[],
  platforms: { id: string; name: string }[],
  bankPayouts: BankPayoutReceived[],
  filter?: { year: number; month: number },
): PayoutReconciliationSummary {
  const platformNames = Object.fromEntries(
    platforms.map((platform) => [platform.id, platform.name]),
  );

  const relevant = bookings
    .map(applyExpectedPayoutFields)
    .filter(isPayoutRelevantBooking)
    .filter((booking) =>
      filter
        ? payoutDateInMonth(
            booking.expectedPayoutDate,
            filter.year,
            filter.month,
          )
        : true,
    );

  const batchMap = new Map<string, Booking[]>();
  for (const booking of relevant) {
    const batchId = booking.expectedPayoutBatch;
    if (!batchId) {
      continue;
    }
    const list = batchMap.get(batchId) ?? [];
    list.push(booking);
    batchMap.set(batchId, list);
  }

  const batches: PayoutBatchRow[] = Array.from(batchMap.entries())
    .map(([batchId, batchBookings]) => {
      const first = batchBookings[0];
      const platformId = first.platformId;
      const grossTotal = batchBookings.reduce(
        (total, booking) => total + getBookingGrossTotal(booking),
        0,
      );
      const commissionTotal = batchBookings.reduce(
        (total, booking) =>
          total + Math.max(0, Number(booking.otaCommission) || 0),
        0,
      );
      const netExpected = batchBookings.reduce(
        (total, booking) => total + getBookingNetBankDeposit(booking),
        0,
      );
      const accountIds = [
        ...new Set(
          batchBookings.map((booking) =>
            getPropertyBankAccount(booking.propertyId, properties),
          ),
        ),
      ];
      const receivedTotal = Math.round(
        accountIds.reduce(
          (sum, accountId) =>
            sum +
            getReceivedTotalForBatch(
              batchId,
              bankPayouts,
              relevant,
              properties,
              accountId,
            ),
          0,
        ) * 100,
      ) / 100;
      const difference = Math.round((receivedTotal - netExpected) * 100) / 100;

      let status: PayoutBatchStatus = "pending";
      if (receivedTotal === 0) {
        const payoutDay = first.expectedPayoutDate
          ? parseIsoDate(first.expectedPayoutDate)
          : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (payoutDay && payoutDay < today) {
          status = "missing";
        }
      } else if (Math.abs(difference) <= AMOUNT_TOLERANCE) {
        status = "ok";
      } else {
        status = "difference";
      }

      return {
        batchId,
        platformId,
        platformName: platformNames[platformId] ?? platformId,
        expectedPayoutDate: first.expectedPayoutDate ?? "",
        bankAccountIds: accountIds,
        bankAccountLabels: accountIds.map((id) => getBankAccountLabel(id)),
        bookingCount: batchBookings.length,
        grossTotal: Math.round(grossTotal * 100) / 100,
        commissionTotal: Math.round(commissionTotal * 100) / 100,
        netExpected: Math.round(netExpected * 100) / 100,
        receivedTotal,
        difference,
        status,
        bookings: batchBookings.sort((left, right) =>
          left.checkIn.localeCompare(right.checkIn),
        ),
      };
    })
    .sort((left, right) =>
      left.expectedPayoutDate.localeCompare(right.expectedPayoutDate),
    );

  const matchedBatchIds = new Set(batchMap.keys());
  let unmatchedReceivedTotal = 0;
  for (const payout of bankPayouts) {
    const covered =
      payout.coveredPayoutBatches && payout.coveredPayoutBatches.length > 0
        ? payout.coveredPayoutBatches
        : payout.expectedPayoutBatch
          ? [payout.expectedPayoutBatch]
          : [];
    const anyMatched = covered.some((batchId) =>
      matchedBatchIds.has(batchId),
    );
    if (!anyMatched && covered.length > 0) {
      unmatchedReceivedTotal += payout.amount;
    }
  }

  return {
    batches,
    unmatchedReceivedTotal: Math.round(unmatchedReceivedTotal * 100) / 100,
    missingBatchCount: batches.filter((batch) => batch.status === "missing")
      .length,
    differenceBatchCount: batches.filter(
      (batch) => batch.status === "difference",
    ).length,
  };
}
