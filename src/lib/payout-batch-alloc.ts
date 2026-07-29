import { getPropertyBankAccount, getBookingBankDeposit } from "./bank-accounts";
import {
  applyExpectedPayoutFields,
  getOtaPayoutPlatform,
  type OtaPayoutPlatform,
} from "./ota-payout";
import type {
  BankAccountId,
  BankPayoutReceived,
  Booking,
  Property,
} from "./types";

export function roundPayoutMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function batchNetExpectedForBookings(
  batchId: string,
  bookings: Booking[],
): number {
  return roundPayoutMoney(
    bookings
      .map(applyExpectedPayoutFields)
      .filter((booking) => booking.expectedPayoutBatch === batchId)
      .reduce((total, booking) => total + getBookingBankDeposit(booking), 0),
  );
}

export function payoutCoversBatch(
  payout: BankPayoutReceived,
  batchId: string,
): boolean {
  if (payout.coveredPayoutBatches?.includes(batchId)) {
    return true;
  }
  return payout.expectedPayoutBatch === batchId;
}

export function coveredBatchIds(payout: BankPayoutReceived): string[] {
  if (payout.coveredPayoutBatches && payout.coveredPayoutBatches.length > 0) {
    return payout.coveredPayoutBatches;
  }
  if (payout.expectedPayoutBatch) {
    return [payout.expectedPayoutBatch];
  }
  return [];
}

export function allocatePayoutAmountToBatch(
  payout: BankPayoutReceived,
  batchId: string,
  bookings: Booking[],
  properties: Property[],
  bankAccountId: BankAccountId,
): number {
  if (!payoutCoversBatch(payout, batchId)) {
    return 0;
  }
  if (payout.bankAccountId !== bankAccountId) {
    return 0;
  }

  const covered = coveredBatchIds(payout);
  if (covered.length === 1) {
    return roundPayoutMoney(payout.amount);
  }

  const scoped = bookings.filter(
    (booking) =>
      getPropertyBankAccount(booking.propertyId, properties) === bankAccountId,
  );

  const nets = covered.map((id) => ({
    id,
    net: batchNetExpectedForBookings(id, scoped),
  }));
  const totalNet = nets.reduce((sum, item) => sum + item.net, 0);
  const batchNet = nets.find((item) => item.id === batchId)?.net ?? 0;
  if (totalNet <= 0 || batchNet <= 0) {
    return 0;
  }

  return roundPayoutMoney((payout.amount * batchNet) / totalNet);
}

export function getReceivedTotalForBatch(
  batchId: string,
  bankPayouts: BankPayoutReceived[],
  bookings: Booking[],
  properties: Property[],
  bankAccountId: BankAccountId,
): number {
  let total = 0;
  for (const payout of bankPayouts) {
    total += allocatePayoutAmountToBatch(
      payout,
      batchId,
      bookings,
      properties,
      bankAccountId,
    );
  }
  return roundPayoutMoney(total);
}

export interface PlatformBatchSummary {
  batchId: string;
  payoutDate: string;
  netExpected: number;
  bookingCount: number;
}

export function listPlatformBatches(
  bookings: Booking[],
  platform: OtaPayoutPlatform,
): PlatformBatchSummary[] {
  const map = new Map<
    string,
    { payoutDate: string; net: number; count: number }
  >();

  for (const booking of bookings) {
    const enriched = applyExpectedPayoutFields(booking);
    if (getOtaPayoutPlatform(booking.platformId) !== platform) {
      continue;
    }
    if (!enriched.expectedPayoutBatch || !enriched.expectedPayoutDate) {
      continue;
    }
    const current = map.get(enriched.expectedPayoutBatch) ?? {
      payoutDate: enriched.expectedPayoutDate,
      net: 0,
      count: 0,
    };
    current.net += getBookingBankDeposit(booking);
    current.count += 1;
    map.set(enriched.expectedPayoutBatch, current);
  }

  return Array.from(map.entries())
    .map(([batchId, value]) => ({
      batchId,
      payoutDate: value.payoutDate,
      netExpected: roundPayoutMoney(value.net),
      bookingCount: value.count,
    }))
    .sort((left, right) => left.payoutDate.localeCompare(right.payoutDate));
}
