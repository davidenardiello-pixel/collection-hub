import {
  getBankAccountLabel,
  getIncomeChannelSummary,
  getPropertyBankAccount,
} from "./bank-accounts";
import {
  buildCompanyPayoutDashboard,
  sumBankDepositsByOtaChannel,
  sumBankDepositsByOtaAllAccounts,
} from "./payout-dashboard";
import type {
  BankAccountId,
  BankPayoutReceived,
  Booking,
  Platform,
  Property,
} from "./types";

export interface OtaCompetenceVsPayoutRow {
  platformId: string;
  platformName: string;
  competenceNet: number;
  payoutExpectedNet: number;
  payoutAttributedNet: number;
}

export interface AccountCompetenceVsPayoutBridge {
  accountId: BankAccountId;
  label: string;
  competenceGross: number;
  competenceCommission: number;
  competenceNet: number;
  payoutExpectedNet: number;
  payoutAttributedNet: number;
  bankCsvTotal: number;
  bankCsvBooking: number;
  bankCsvAirbnb: number;
  bankCsvBookingAllAccounts: number;
  bankCsvAirbnbAllAccounts: number;
  otaRows: OtaCompetenceVsPayoutRow[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Confronta la stessa azienda e lo stesso mese calendario sotto due regole:
 * - Competenza (Incassi): mese di check-in (come sheet / import OTA).
 * - Cassa (Riconciliazione): mese del pagamento atteso in banca + CSV per data accredito.
 */
export function buildAccountCompetenceVsPayoutBridge(
  accountId: BankAccountId,
  bookings: Booking[],
  properties: Property[],
  platforms: Platform[],
  bankPayouts: BankPayoutReceived[],
  filter: { year: number; month: number },
): AccountCompetenceVsPayoutBridge {
  const period = { year: filter.year, month: filter.month };
  const income = getIncomeChannelSummary(
    bookings,
    properties,
    platforms,
    period,
  );
  const accountIncome = income.accounts.find(
    (account) => account.accountId === accountId,
  );
  const payoutDashboard = buildCompanyPayoutDashboard(
    bookings,
    properties,
    platforms,
    bankPayouts,
    filter,
  );
  const accountPayout = payoutDashboard.companies.find(
    (company) => company.accountId === accountId,
  );
  const bankCsv = sumBankDepositsByOtaChannel(bankPayouts, accountId, filter);
  const bankCsvAll = sumBankDepositsByOtaAllAccounts(bankPayouts, filter);

  const platformIds = new Set<string>([
    ...(accountIncome?.platforms.map((platform) => platform.id) ?? []),
    ...(accountPayout?.otaGroups.map((group) => group.platformId) ?? []),
  ]);

  const platformNames = Object.fromEntries(
    platforms.map((platform) => [platform.id, platform.name]),
  );

  const otaRows: OtaCompetenceVsPayoutRow[] = Array.from(platformIds)
    .map((platformId) => {
      const incomeRow = accountIncome?.platforms.find(
        (platform) => platform.id === platformId,
      );
      const payoutRow = accountPayout?.otaGroups.find(
        (group) => group.platformId === platformId,
      );

      return {
        platformId,
        platformName:
          incomeRow?.name ??
          payoutRow?.platformName ??
          platformNames[platformId] ??
          platformId,
        competenceNet: roundMoney(incomeRow?.net ?? 0),
        payoutExpectedNet: roundMoney(payoutRow?.netExpected ?? 0),
        payoutAttributedNet: roundMoney(payoutRow?.receivedTotal ?? 0),
      };
    })
    .filter(
      (row) =>
        row.competenceNet > 0 ||
        row.payoutExpectedNet > 0 ||
        row.payoutAttributedNet > 0,
    )
    .sort(
      (left, right) =>
        Math.max(right.competenceNet, right.payoutExpectedNet) -
        Math.max(left.competenceNet, left.payoutExpectedNet),
    );

  return {
    accountId,
    label: getBankAccountLabel(accountId),
    competenceGross: roundMoney(accountIncome?.gross ?? 0),
    competenceCommission: roundMoney(accountIncome?.commission ?? 0),
    competenceNet: roundMoney(accountIncome?.net ?? 0),
    payoutExpectedNet: roundMoney(accountPayout?.netExpected ?? 0),
    payoutAttributedNet: roundMoney(accountPayout?.receivedTotal ?? 0),
    bankCsvTotal: bankCsv.total,
    bankCsvBooking: bankCsv.booking,
    bankCsvAirbnb: bankCsv.airbnb,
    bankCsvBookingAllAccounts: bankCsvAll.booking,
    bankCsvAirbnbAllAccounts: bankCsvAll.airbnb,
    otaRows,
  };
}

export function countBookingsCheckInInMonth(
  bookings: Booking[],
  properties: Property[],
  accountId: BankAccountId,
  filter: { year: number; month: number },
): number {
  return bookings.filter((booking) => {
    if (getPropertyBankAccount(booking.propertyId, properties) !== accountId) {
      return false;
    }
    const [year, month] = booking.checkIn.split("-").map(Number);
    return year === filter.year && month === filter.month;
  }).length;
}
