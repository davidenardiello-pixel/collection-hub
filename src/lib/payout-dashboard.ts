import { BANK_ACCOUNT_OPTIONS } from "./constants";
import { getBankAccountLabel, getPropertyBankAccount } from "./bank-accounts";
import { getReceivedTotalForBatch } from "./payout-batch-alloc";
import {
  applyExpectedPayoutFields,
  getBookingGrossTotal,
  getBookingNetBankDeposit,
  isPayoutRelevantBooking,
  parseIsoDate,
  payoutDateInMonth,
} from "./ota-payout";
import type { BankAccountId, BankPayoutReceived, Booking, Property } from "./types";

const AMOUNT_TOLERANCE = 0.02;

export type BookingPayoutStatus =
  | "paid"
  | "partial"
  | "missing"
  | "pending"
  | "difference";

export interface BookingPayoutDetailRow {
  bookingId: string;
  guest: string;
  propertyName: string;
  platformId: string;
  platformName: string;
  checkIn: string;
  checkOut: string;
  gross: number;
  commission: number;
  netExpected: number;
  receivedAmount: number;
  receivedDate?: string;
  expectedPayoutDate: string;
  expectedPayoutBatch: string;
  status: BookingPayoutStatus;
}

export interface OtaPayoutGroup {
  platformId: string;
  platformName: string;
  netExpected: number;
  receivedTotal: number;
  difference: number;
  bookingCount: number;
  paidCount: number;
  missingCount: number;
  bookings: BookingPayoutDetailRow[];
}

export interface CompanyPayoutGroup {
  accountId: BankAccountId;
  label: string;
  netExpected: number;
  receivedTotal: number;
  difference: number;
  bookingCount: number;
  paidCount: number;
  missingCount: number;
  otaGroups: OtaPayoutGroup[];
}

export interface CompanyPayoutDashboard {
  companies: CompanyPayoutGroup[];
  netExpected: number;
  receivedTotal: number;
  difference: number;
  bookingCount: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveBookingPayoutStatus(
  netExpected: number,
  receivedAmount: number,
  expectedPayoutDate: string,
): BookingPayoutStatus {
  const difference = receivedAmount - netExpected;
  if (receivedAmount <= 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parseIsoDate(expectedPayoutDate) < today) {
      return "missing";
    }
    return "pending";
  }
  if (Math.abs(difference) <= AMOUNT_TOLERANCE) {
    return "paid";
  }
  if (receivedAmount < netExpected - AMOUNT_TOLERANCE) {
    return "partial";
  }
  return "difference";
}

export function getBookingReceivedFromBank(
  booking: Booking,
  allBookings: Booking[],
  properties: Property[],
  bankPayouts: BankPayoutReceived[],
  bankAccountId: BankAccountId,
): { amount: number; receivedDate?: string } {
  const direct = bankPayouts.filter(
    (payout) => payout.matchedBookingId === booking.id,
  );
  if (direct.length > 0) {
    const amount = direct.reduce((total, payout) => total + payout.amount, 0);
    const receivedDate = [...direct]
      .map((payout) => payout.receivedDate)
      .sort()
      .at(-1);
    return { amount: roundMoney(amount), receivedDate };
  }

  const enriched = applyExpectedPayoutFields(booking);
  const netExpected = getBookingNetBankDeposit(booking);
  const batchId = enriched.expectedPayoutBatch;
  if (!batchId) {
    return { amount: 0 };
  }

  const batchBookings = allBookings
    .filter(
      (item) =>
        getPropertyBankAccount(item.propertyId, properties) === bankAccountId,
    )
    .map(applyExpectedPayoutFields)
    .filter(
      (item) =>
        item.expectedPayoutBatch === batchId && isPayoutRelevantBooking(item),
    );

  const batchNetExpected = roundMoney(
    batchBookings.reduce(
      (total, item) => total + getBookingNetBankDeposit(item),
      0,
    ),
  );

  const batchPayouts = bankPayouts.filter(
    (payout) =>
      payout.bankAccountId === bankAccountId &&
      (payout.expectedPayoutBatch === batchId ||
        payout.coveredPayoutBatches?.includes(batchId)),
  );
  const receivedBatchTotal = getReceivedTotalForBatch(
    batchId,
    bankPayouts,
    allBookings,
    properties,
    bankAccountId,
  );
  const receivedDate = batchPayouts
    .map((payout) => payout.receivedDate)
    .sort()
    .at(-1);

  if (receivedBatchTotal <= 0 || batchNetExpected <= 0) {
    return { amount: 0 };
  }

  const batchTolerance =
    AMOUNT_TOLERANCE * Math.max(1, batchBookings.length);

  if (Math.abs(receivedBatchTotal - batchNetExpected) <= batchTolerance) {
    return { amount: roundMoney(netExpected), receivedDate };
  }

  if (receivedBatchTotal < batchNetExpected) {
    const share = netExpected / batchNetExpected;
    return {
      amount: roundMoney(receivedBatchTotal * share),
      receivedDate,
    };
  }

  const candidates = bankPayouts.filter(
    (payout) =>
      !payout.matchedBookingId &&
      payout.bankAccountId === bankAccountId &&
      payout.expectedPayoutBatch === batchId &&
      Math.abs(payout.amount - netExpected) <= AMOUNT_TOLERANCE,
  );

  if (candidates.length === 1) {
    return {
      amount: roundMoney(candidates[0].amount),
      receivedDate: candidates[0].receivedDate,
    };
  }

  return { amount: 0 };
}

export function buildCompanyPayoutDashboard(
  bookings: Booking[],
  properties: Property[],
  platforms: { id: string; name: string }[],
  bankPayouts: BankPayoutReceived[],
  filter: { year: number; month: number },
): CompanyPayoutDashboard {
  const propertyNames = Object.fromEntries(
    properties.map((property) => [property.id, property.name]),
  );
  const platformNames = Object.fromEntries(
    platforms.map((platform) => [platform.id, platform.name]),
  );

  const companies: CompanyPayoutGroup[] = BANK_ACCOUNT_OPTIONS.map(
    (option) => {
      const accountId = option.id;
      const monthBookings = bookings
        .map(applyExpectedPayoutFields)
        .filter(isPayoutRelevantBooking)
        .filter((booking) =>
          payoutDateInMonth(booking.expectedPayoutDate, filter.year, filter.month),
        )
        .filter(
          (booking) =>
            getPropertyBankAccount(booking.propertyId, properties) ===
            accountId,
        );

      const otaMap = new Map<string, BookingPayoutDetailRow[]>();

      for (const booking of monthBookings) {
        const { amount: receivedAmount, receivedDate } =
          getBookingReceivedFromBank(
            booking,
            bookings,
            properties,
            bankPayouts,
            accountId,
          );
        const netExpected = getBookingNetBankDeposit(booking);
        const expectedPayoutDate = booking.expectedPayoutDate ?? "";
        const row: BookingPayoutDetailRow = {
          bookingId: booking.id,
          guest: booking.description,
          propertyName: propertyNames[booking.propertyId] ?? booking.propertyId,
          platformId: booking.platformId,
          platformName: platformNames[booking.platformId] ?? booking.platformId,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          gross: roundMoney(getBookingGrossTotal(booking)),
          commission: roundMoney(Math.max(0, Number(booking.otaCommission) || 0)),
          netExpected: roundMoney(netExpected),
          receivedAmount,
          receivedDate,
          expectedPayoutDate,
          expectedPayoutBatch: booking.expectedPayoutBatch ?? "",
          status: resolveBookingPayoutStatus(
            netExpected,
            receivedAmount,
            expectedPayoutDate,
          ),
        };

        const list = otaMap.get(booking.platformId) ?? [];
        list.push(row);
        otaMap.set(booking.platformId, list);
      }

      const otaGroups: OtaPayoutGroup[] = Array.from(otaMap.entries())
        .map(([platformId, rows]) => {
          const netExpected = rows.reduce(
            (total, row) => total + row.netExpected,
            0,
          );
          const receivedTotal = rows.reduce(
            (total, row) => total + row.receivedAmount,
            0,
          );

          return {
            platformId,
            platformName: platformNames[platformId] ?? platformId,
            netExpected: roundMoney(netExpected),
            receivedTotal: roundMoney(receivedTotal),
            difference: roundMoney(receivedTotal - netExpected),
            bookingCount: rows.length,
            paidCount: rows.filter((row) => row.status === "paid").length,
            missingCount: rows.filter((row) => row.status === "missing").length,
            bookings: rows.sort((left, right) =>
              left.expectedPayoutDate.localeCompare(right.expectedPayoutDate),
            ),
          };
        })
        .sort((left, right) => right.netExpected - left.netExpected);

      const netExpected = otaGroups.reduce(
        (total, group) => total + group.netExpected,
        0,
      );
      const receivedTotal = otaGroups.reduce(
        (total, group) => total + group.receivedTotal,
        0,
      );
      const allRows = otaGroups.flatMap((group) => group.bookings);

      return {
        accountId,
        label: getBankAccountLabel(accountId),
        netExpected: roundMoney(netExpected),
        receivedTotal: roundMoney(receivedTotal),
        difference: roundMoney(receivedTotal - netExpected),
        bookingCount: allRows.length,
        paidCount: allRows.filter((row) => row.status === "paid").length,
        missingCount: allRows.filter((row) => row.status === "missing").length,
        otaGroups,
      };
    },
  );

  const netExpected = companies.reduce(
    (total, company) => total + company.netExpected,
    0,
  );
  const receivedTotal = companies.reduce(
    (total, company) => total + company.receivedTotal,
    0,
  );
  const bookingCount = companies.reduce(
    (total, company) => total + company.bookingCount,
    0,
  );

  return {
    companies,
    netExpected: roundMoney(netExpected),
    receivedTotal: roundMoney(receivedTotal),
    difference: roundMoney(receivedTotal - netExpected),
    bookingCount,
  };
}

export function bookingPayoutStatusLabel(status: BookingPayoutStatus): string {
  switch (status) {
    case "paid":
      return "Incassato";
    case "partial":
      return "Parziale";
    case "missing":
      return "Mancante";
    case "difference":
      return "Differenza";
    default:
      return "In attesa";
  }
}

export function bookingPayoutStatusClass(status: BookingPayoutStatus): string {
  switch (status) {
    case "paid":
      return "text-emerald-400";
    case "partial":
    case "difference":
      return "text-amber-400";
    case "missing":
      return "text-rose-400";
    default:
      return "text-rc-muted";
  }
}

function platformToBankOtaChannel(
  platformId: string,
): "airbnb" | "booking" | "vrbo" | undefined {
  if (platformId === "airbnb") {
    return "airbnb";
  }
  if (platformId === "booking") {
    return "booking";
  }
  if (platformId === "vrbo") {
    return "vrbo";
  }
  return undefined;
}

function bankPayoutInMonth(
  receivedDate: string,
  year: number,
  month: number,
): boolean {
  const [y, m] = receivedDate.split("-").map(Number);
  return y === year && m === month;
}

export interface OtaCollectionOverviewRow {
  platformId: string;
  platformName: string;
  grossMonth: number;
  commissionMonth: number;
  netExpectedMonth: number;
  dueByTodayAmount: number;
  dueByTodayCount: number;
  receivedAttributed: number;
  stillOwedAmount: number;
  missingCount: number;
  pendingAmount: number;
  pendingCount: number;
  nextPendingDate?: string;
  bankCsvMonth: number;
}

export interface MissingPayoutSummaryItem {
  platformId: string;
  platformName: string;
  expectedPayoutDate: string;
  netStillOwed: number;
  guest: string;
  propertyName: string;
}

export function buildOtaCollectionOverview(
  company: CompanyPayoutGroup,
  bankPayouts: BankPayoutReceived[],
  filter: { year: number; month: number },
): {
  rows: OtaCollectionOverviewRow[];
  missingItems: MissingPayoutSummaryItem[];
  totals: {
    grossMonth: number;
    commissionMonth: number;
    netExpectedMonth: number;
    dueByTodayAmount: number;
    receivedAttributed: number;
    stillOwedAmount: number;
    bankCsvMonth: number;
    otaBookingsMissingCommission: number;
  };
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const missingItems: MissingPayoutSummaryItem[] = [];

  const rows: OtaCollectionOverviewRow[] = company.otaGroups.map((group) => {
    let dueByTodayAmount = 0;
    let dueByTodayCount = 0;
    let stillOwedAmount = 0;
    let missingCount = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    let nextPendingDate: string | undefined;
    const grossMonth = roundMoney(
      group.bookings.reduce((total, row) => total + row.gross, 0),
    );
    const commissionMonth = roundMoney(
      group.bookings.reduce((total, row) => total + row.commission, 0),
    );

    for (const row of group.bookings) {
      const due = parseIsoDate(row.expectedPayoutDate);
      if (due <= today) {
        dueByTodayAmount += row.netExpected;
        dueByTodayCount += 1;
      }

      const owed = Math.max(0, row.netExpected - row.receivedAmount);
      if (row.status === "missing" || row.status === "partial") {
        stillOwedAmount += owed;
        if (row.status === "missing") {
          missingCount += 1;
        }
        missingItems.push({
          platformId: group.platformId,
          platformName: group.platformName,
          expectedPayoutDate: row.expectedPayoutDate,
          netStillOwed: roundMoney(owed),
          guest: row.guest,
          propertyName: row.propertyName,
        });
      }

      if (row.status === "pending") {
        pendingAmount += row.netExpected;
        pendingCount += 1;
        if (!nextPendingDate || row.expectedPayoutDate < nextPendingDate) {
          nextPendingDate = row.expectedPayoutDate;
        }
      }
    }

    const channel = platformToBankOtaChannel(group.platformId);
    const bankCsvMonth = roundMoney(
      bankPayouts
        .filter(
          (payout) =>
            payout.bankAccountId === company.accountId &&
            bankPayoutInMonth(payout.receivedDate, filter.year, filter.month) &&
            (channel ? payout.otaChannel === channel : true),
        )
        .reduce((total, payout) => total + payout.amount, 0),
    );

    return {
      platformId: group.platformId,
      platformName: group.platformName,
      grossMonth,
      commissionMonth,
      netExpectedMonth: group.netExpected,
      dueByTodayAmount: roundMoney(dueByTodayAmount),
      dueByTodayCount,
      receivedAttributed: group.receivedTotal,
      stillOwedAmount: roundMoney(stillOwedAmount),
      missingCount,
      pendingAmount: roundMoney(pendingAmount),
      pendingCount,
      nextPendingDate,
      bankCsvMonth,
    };
  });

  missingItems.sort((left, right) =>
    left.expectedPayoutDate.localeCompare(right.expectedPayoutDate),
  );

  const otaBookingsMissingCommission = company.otaGroups.reduce(
    (total, group) =>
      total +
      group.bookings.filter(
        (row) => row.commission <= 0 && row.netExpected > 0,
      ).length,
    0,
  );

  const totals = {
    grossMonth: roundMoney(
      rows.reduce((total, row) => total + row.grossMonth, 0),
    ),
    commissionMonth: roundMoney(
      rows.reduce((total, row) => total + row.commissionMonth, 0),
    ),
    netExpectedMonth: roundMoney(
      rows.reduce((total, row) => total + row.netExpectedMonth, 0),
    ),
    dueByTodayAmount: roundMoney(
      rows.reduce((total, row) => total + row.dueByTodayAmount, 0),
    ),
    receivedAttributed: roundMoney(
      rows.reduce((total, row) => total + row.receivedAttributed, 0),
    ),
    stillOwedAmount: roundMoney(
      rows.reduce((total, row) => total + row.stillOwedAmount, 0),
    ),
    bankCsvMonth: roundMoney(
      rows.reduce((total, row) => total + row.bankCsvMonth, 0),
    ),
    otaBookingsMissingCommission,
  };

  return { rows, missingItems, totals };
}
