import { getAllocatedBookingAmount } from "./booking-allocation";
import { getBookingTotal } from "./calculations";
import type { Booking, MonthPeriod, Platform, Property } from "./types";
import type { BankAccountId } from "./types";
import {
  BANK_ACCOUNT_OPTIONS,
  DEFAULT_BANK_ACCOUNT,
} from "./constants";

export type { BankAccountId };
export const CASH_PLATFORM_IDS = new Set([
  "diretta",
  "prenotazione-diretta",
]);

export function isCashPlatform(platformId: string): boolean {
  return CASH_PLATFORM_IDS.has(platformId);
}

export function getBankAccountLabel(accountId: BankAccountId): string {
  return (
    BANK_ACCOUNT_OPTIONS.find((option) => option.id === accountId)?.label ??
    accountId
  );
}

export function normalizeBankAccount(
  value: BankAccountId | string | undefined,
): BankAccountId {
  if (
    value &&
    BANK_ACCOUNT_OPTIONS.some((option) => option.id === value)
  ) {
    return value as BankAccountId;
  }

  return DEFAULT_BANK_ACCOUNT;
}

export function getPropertyBankAccount(
  propertyId: string,
  properties: Property[],
): BankAccountId {
  const property = properties.find((item) => item.id === propertyId);
  return normalizeBankAccount(property?.bankAccount);
}

/** Importo netto che entra in banca (lordo + pulizie − commissione OTA). */
export function getBookingBankDeposit(booking: Booking): number {
  if (isCashPlatform(booking.platformId)) {
    return 0;
  }

  const total = getBookingTotal(booking);
  const commission = Math.max(0, Number(booking.otaCommission) || 0);
  return Math.round((total - commission) * 100) / 100;
}

/** Incasso contanti (piattaforma Diretta). */
export function getBookingCashIncome(booking: Booking): number {
  if (!isCashPlatform(booking.platformId)) {
    return 0;
  }

  return getBookingTotal(booking);
}

function scaleBookingAmount(
  booking: Booking,
  amount: number,
  period?: MonthPeriod,
): number {
  if (!period) {
    return amount;
  }

  return getAllocatedBookingAmount(booking, period, amount);
}

export interface BankAccountPlatformRow {
  id: string;
  name: string;
  gross: number;
  commission: number;
  net: number;
}

export interface BankAccountPropertyRow {
  id: string;
  name: string;
  gross: number;
  commission: number;
  net: number;
}

export interface BankAccountIncomeRow {
  accountId: BankAccountId;
  label: string;
  gross: number;
  commission: number;
  net: number;
  platforms: BankAccountPlatformRow[];
  properties: BankAccountPropertyRow[];
}

export interface PropertyIncomeChannelRow {
  propertyId: string;
  name: string;
  accountId: BankAccountId;
  accountLabel: string;
  gross: number;
  commission: number;
  bankNet: number;
  cash: number;
  totalNet: number;
}

export interface IncomeChannelSummary {
  accounts: BankAccountIncomeRow[];
  properties: PropertyIncomeChannelRow[];
  bankGross: number;
  bankCommission: number;
  bankNet: number;
  cashTotal: number;
  grandNet: number;
}

export function getIncomeChannelSummary(
  bookings: Booking[],
  properties: Property[],
  platforms: Platform[],
  period?: MonthPeriod,
): IncomeChannelSummary {
  const platformNames = Object.fromEntries(
    platforms.map((platform) => [platform.id, platform.name]),
  );
  const propertyNames = Object.fromEntries(
    properties.map((property) => [property.id, property.name]),
  );
  const accountMap = new Map<
    BankAccountId,
    {
      gross: number;
      commission: number;
      net: number;
      platforms: Map<string, { gross: number; commission: number; net: number }>;
      propertyBuckets: Map<
        string,
        { gross: number; commission: number; net: number }
      >;
    }
  >();
  const propertyTotals = new Map<
    string,
    {
      gross: number;
      commission: number;
      bankNet: number;
      cash: number;
    }
  >();

  for (const option of BANK_ACCOUNT_OPTIONS) {
    accountMap.set(option.id, {
      gross: 0,
      commission: 0,
      net: 0,
      platforms: new Map(),
      propertyBuckets: new Map(),
    });
  }

  let cashTotal = 0;

  for (const booking of bookings) {
    const gross = scaleBookingAmount(booking, getBookingTotal(booking), period);
    const commission = scaleBookingAmount(
      booking,
      Math.max(0, Number(booking.otaCommission) || 0),
      period,
    );
    const net = scaleBookingAmount(
      booking,
      getBookingBankDeposit(booking) + getBookingCashIncome(booking),
      period,
    );

    const propertyBucket = propertyTotals.get(booking.propertyId) ?? {
      gross: 0,
      commission: 0,
      bankNet: 0,
      cash: 0,
    };
    propertyBucket.gross += gross;
    propertyBucket.commission += commission;

    if (isCashPlatform(booking.platformId)) {
      cashTotal += net;
      propertyBucket.cash += net;
      propertyTotals.set(booking.propertyId, propertyBucket);
      continue;
    }

    propertyBucket.bankNet += net;
    propertyTotals.set(booking.propertyId, propertyBucket);

    const accountId = getPropertyBankAccount(booking.propertyId, properties);
    const account = accountMap.get(accountId);
    if (!account) {
      continue;
    }

    account.gross += gross;
    account.commission += commission;
    account.net += net;

    const platformBucket = account.platforms.get(booking.platformId) ?? {
      gross: 0,
      commission: 0,
      net: 0,
    };
    platformBucket.gross += gross;
    platformBucket.commission += commission;
    platformBucket.net += net;
    account.platforms.set(booking.platformId, platformBucket);

    const accountPropertyBucket = account.propertyBuckets.get(
      booking.propertyId,
    ) ?? {
      gross: 0,
      commission: 0,
      net: 0,
    };
    accountPropertyBucket.gross += gross;
    accountPropertyBucket.commission += commission;
    accountPropertyBucket.net += net;
    account.propertyBuckets.set(booking.propertyId, accountPropertyBucket);
  }

  const accounts = BANK_ACCOUNT_OPTIONS.map((option) => {
    const account = accountMap.get(option.id)!;

    return {
      accountId: option.id,
      label: option.label,
      gross: Math.round(account.gross * 100) / 100,
      commission: Math.round(account.commission * 100) / 100,
      net: Math.round(account.net * 100) / 100,
      platforms: Array.from(account.platforms.entries())
        .map(([id, values]) => ({
          id,
          name: platformNames[id] ?? id,
          gross: Math.round(values.gross * 100) / 100,
          commission: Math.round(values.commission * 100) / 100,
          net: Math.round(values.net * 100) / 100,
        }))
        .filter((row) => row.gross > 0 || row.net > 0)
        .sort((left, right) => right.net - left.net),
      properties: Array.from(account.propertyBuckets.entries())
        .map(([id, values]) => ({
          id,
          name: propertyNames[id] ?? id,
          gross: Math.round(values.gross * 100) / 100,
          commission: Math.round(values.commission * 100) / 100,
          net: Math.round(values.net * 100) / 100,
        }))
        .filter((row) => row.gross > 0 || row.net > 0)
        .sort((left, right) => right.net - left.net),
    };
  });

  const propertyRows = Array.from(propertyTotals.entries())
    .map(([propertyId, values]) => {
      const accountId = getPropertyBankAccount(propertyId, properties);
      const bankNet = Math.round(values.bankNet * 100) / 100;
      const cash = Math.round(values.cash * 100) / 100;

      return {
        propertyId,
        name: propertyNames[propertyId] ?? propertyId,
        accountId,
        accountLabel: getBankAccountLabel(accountId),
        gross: Math.round(values.gross * 100) / 100,
        commission: Math.round(values.commission * 100) / 100,
        bankNet,
        cash,
        totalNet: Math.round((bankNet + cash) * 100) / 100,
      };
    })
    .filter(
      (row) =>
        row.gross > 0 ||
        row.bankNet > 0 ||
        row.cash > 0 ||
        row.totalNet > 0,
    )
    .sort((left, right) => right.totalNet - left.totalNet);

  const bankGross = accounts.reduce((total, account) => total + account.gross, 0);
  const bankCommission = accounts.reduce(
    (total, account) => total + account.commission,
    0,
  );
  const bankNet = accounts.reduce((total, account) => total + account.net, 0);
  const cashRounded = Math.round(cashTotal * 100) / 100;

  return {
    accounts,
    properties: propertyRows,
    bankGross: Math.round(bankGross * 100) / 100,
    bankCommission: Math.round(bankCommission * 100) / 100,
    bankNet: Math.round(bankNet * 100) / 100,
    cashTotal: cashRounded,
    grandNet: Math.round((bankNet + cashRounded) * 100) / 100,
  };
}
