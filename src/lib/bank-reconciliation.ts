import { getPropertyBankAccount } from "./bank-accounts";
import { getBookingBankDeposit } from "./bank-accounts";
import {
  applyExpectedPayoutFields,
  formatIsoDate,
  getOtaPayoutPlatform,
  parseIsoDate,
} from "./ota-payout";
import type { ParsedBankStatementLine } from "./bank-statement-import";
import type {
  BankAccountId,
  BankInstitutionId,
  Booking,
  Property,
} from "./types";

const AMOUNT_TOLERANCE = 0.06;

export interface BankLineMatchResult {
  matchedBookingId?: string;
  expectedPayoutBatch?: string;
  matchReason?: string;
}

function bookingsForBankAccount(
  bookings: Booking[],
  properties: Property[],
  bankAccountId: BankAccountId,
): Booking[] {
  const propertyIds = new Set(
    properties
      .filter(
        (property) =>
          getPropertyBankAccount(property.id, properties) === bankAccountId,
      )
      .map((property) => property.id),
  );

  return bookings.filter((booking) => propertyIds.has(booking.propertyId));
}

function batchNetExpected(batchId: string, scoped: Booking[]): number {
  return scoped
    .map(applyExpectedPayoutFields)
    .filter((booking) => booking.expectedPayoutBatch === batchId)
    .reduce((total, booking) => total + getBookingBankDeposit(booking), 0);
}

function batchBookingCount(batchId: string, scoped: Booking[]): number {
  return scoped
    .map(applyExpectedPayoutFields)
    .filter((booking) => booking.expectedPayoutBatch === batchId).length;
}

function tryMatchAggregatedBatch(
  line: ParsedBankStatementLine,
  scoped: Booking[],
): BankLineMatchResult | null {
  const received = parseIsoDate(line.receivedDate);
  const candidateBatchIds = new Set<string>();

  if (line.otaChannel === "airbnb") {
    candidateBatchIds.add(`ABB-${line.receivedDate}`);
  }
  if (line.otaChannel === "booking") {
    candidateBatchIds.add(`BK-${line.receivedDate}`);
  }

  for (const booking of scoped) {
    const payout = applyExpectedPayoutFields(booking);
    if (!payout.expectedPayoutBatch || !payout.expectedPayoutDate) {
      continue;
    }
    const platform = getOtaPayoutPlatform(booking.platformId);
    if (line.otaChannel === "airbnb" && platform !== "airbnb") {
      continue;
    }
    if (line.otaChannel === "booking" && platform !== "booking") {
      continue;
    }
    const expected = parseIsoDate(payout.expectedPayoutDate);
    const dayDiff = Math.abs(
      (received.getTime() - expected.getTime()) / 86_400_000,
    );
    if (dayDiff <= 7) {
      candidateBatchIds.add(payout.expectedPayoutBatch);
    }
  }

  let best: { batchId: string; diff: number; count: number } | null = null;

  for (const batchId of candidateBatchIds) {
    const count = batchBookingCount(batchId, scoped);
    if (count === 0) {
      continue;
    }
    const expectedSum = batchNetExpected(batchId, scoped);
    const diff = Math.abs(expectedSum - line.amount);
    const tolerance = AMOUNT_TOLERANCE * Math.max(1, count);
    if (diff <= tolerance && (!best || diff < best.diff)) {
      best = { batchId, diff, count };
    }
  }

  if (!best) {
    return null;
  }

  return {
    expectedPayoutBatch: best.batchId,
    matchReason:
      best.count > 1
        ? `Batch ${best.batchId} · ${best.count} prenotazioni (totale Finom)`
        : `Batch ${best.batchId} · importo singola prenotazione`,
  };
}

export function matchBankLineToBooking(
  line: ParsedBankStatementLine,
  bookings: Booking[],
  properties: Property[],
  bankAccountId: BankAccountId,
): BankLineMatchResult {
  const scoped = bookingsForBankAccount(bookings, properties, bankAccountId);

  if (line.externalBookingId) {
    const byExternal = scoped.find(
      (booking) => booking.externalId === line.externalBookingId,
    );
    if (byExternal) {
      const payout = applyExpectedPayoutFields(byExternal);
      return {
        matchedBookingId: byExternal.id,
        expectedPayoutBatch: payout.expectedPayoutBatch,
        matchReason: `ID prenotazione OTA ${line.externalBookingId}`,
      };
    }
  }

  const received = parseIsoDate(line.receivedDate);
  const candidates = scoped
    .map((booking) => {
      const payout = applyExpectedPayoutFields(booking);
      if (!payout.expectedPayoutDate) {
        return null;
      }
      const expected = parseIsoDate(payout.expectedPayoutDate);
      const dayDiff = Math.abs(
        (received.getTime() - expected.getTime()) / 86_400_000,
      );
      const net = getBookingBankDeposit(booking);
      const amountDiff = Math.abs(net - line.amount);
      if (dayDiff > 5 || amountDiff > AMOUNT_TOLERANCE) {
        return null;
      }
      return { booking, payout, dayDiff, amountDiff };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort(
      (left, right) =>
        left.amountDiff - right.amountDiff || left.dayDiff - right.dayDiff,
    );

  const best = candidates[0];
  if (best) {
    return {
      matchedBookingId: best.booking.id,
      expectedPayoutBatch: best.payout.expectedPayoutBatch,
      matchReason: `Importo e data attesa (${formatIsoDate(parseIsoDate(best.payout.expectedPayoutDate!))})`,
    };
  }

  const batchMatch = tryMatchAggregatedBatch(line, scoped);
  if (batchMatch) {
    return batchMatch;
  }

  if (line.otaChannel === "booking") {
    const payoutThursday = formatIsoDate(received);
    return {
      expectedPayoutBatch: `BK-${payoutThursday}`,
      matchReason:
        "Data accredito Booking (batch non verificato — controlla totale atteso)",
    };
  }

  if (line.otaChannel === "airbnb") {
    return {
      expectedPayoutBatch: `ABB-${line.receivedDate}`,
      matchReason:
        "Data accredito Airbnb (batch non verificato — controlla totale atteso)",
    };
  }

  return {};
}

export function convertParsedLinesToPayouts(
  lines: ParsedBankStatementLine[],
  bookings: Booking[],
  properties: Property[],
  bankAccountId: BankAccountId,
  bankInstitution: BankInstitutionId,
) {
  return lines.map((line) => {
    const match = matchBankLineToBooking(
      line,
      bookings,
      properties,
      bankAccountId,
    );

    return {
      bankAccountId,
      bankInstitution,
      receivedDate: line.receivedDate,
      amount: line.amount,
      counterparty: line.counterparty,
      reference: line.reference,
      expectedPayoutBatch: match.expectedPayoutBatch,
      matchedBookingId: match.matchedBookingId,
      matchReason: match.matchReason,
      otaChannel: line.otaChannel,
      source: "import" as const,
      importFingerprint: line.fingerprint,
    };
  });
}
