import { getPropertyBankAccount } from "./bank-accounts";
import { getBookingBankDeposit } from "./bank-accounts";
import {
  applyExpectedPayoutFields,
  formatIsoDate,
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

export function matchBankLineToBooking(
  line: ParsedBankStatementLine,
  bookings: Booking[],
  properties: Property[],
  bankAccountId: BankAccountId,
): BankLineMatchResult {
  const propertyIds = new Set(
    properties
      .filter(
        (property) =>
          getPropertyBankAccount(property.id, properties) === bankAccountId,
      )
      .map((property) => property.id),
  );

  const scoped = bookings.filter((booking) =>
    propertyIds.has(booking.propertyId),
  );

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

  if (line.otaChannel === "booking") {
    const payoutThursday = formatIsoDate(received);
    return {
      expectedPayoutBatch: `BK-${payoutThursday}`,
      matchReason: "Bonifico Booking raggruppato per data accredito",
    };
  }

  if (line.otaChannel === "airbnb") {
    return {
      expectedPayoutBatch: `ABB-${line.receivedDate}`,
      matchReason: "Bonifico Airbnb per data accredito",
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
