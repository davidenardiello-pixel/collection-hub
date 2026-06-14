import type { Property } from "../types";
import { DEFAULT_AIRBNB_COMMISSION_RATE } from "../constants";

export const AIRBNB_COMMISSION_VAT_RATE = 0.22;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getAirbnbCommissionRate(property?: Property): number {
  const rate = property?.airbnbCommissionRate;

  if (rate != null && rate > 0 && rate < 1) {
    return rate;
  }

  return DEFAULT_AIRBNB_COMMISSION_RATE;
}

export function airbnbCommissionTotalIncidence(commissionRate: number): number {
  return commissionRate * (1 + AIRBNB_COMMISSION_VAT_RATE);
}

export function airbnbHostNetToGrossRatio(commissionRate: number): number {
  return 1 - airbnbCommissionTotalIncidence(commissionRate);
}

/** Lordo prenotazione (importo da fatturare) dal netto host. */
export function grossBookingFromAirbnbHostNet(
  hostNet: number,
  commissionRate = DEFAULT_AIRBNB_COMMISSION_RATE,
): number {
  const net = Math.max(0, Number(hostNet) || 0);
  const ratio = airbnbHostNetToGrossRatio(commissionRate);

  if (net <= 0 || ratio <= 0) {
    return 0;
  }

  return roundMoney(net / ratio);
}

/** Commissione Airbnb totale (imponibile + IVA 22%) = lordo − netto host. */
export function airbnbTotalCommissionFromAmounts(
  grossIncome: number,
  hostNet: number,
): number {
  return roundMoney(Math.max(0, grossIncome - hostNet));
}

/** Commissione imponibile sul foglio: netto ÷ (1 − rate) × rate. */
export function airbnbSpreadsheetCommissionFromHostNet(
  hostNet: number,
  commissionRate = DEFAULT_AIRBNB_COMMISSION_RATE,
): number {
  const net = Math.max(0, Number(hostNet) || 0);

  if (net <= 0 || commissionRate <= 0 || commissionRate >= 1) {
    return 0;
  }

  const lordoBase = net / (1 - commissionRate);
  return roundMoney(lordoBase * commissionRate);
}

export function airbnbCommissionImposable(
  totalCommission: number,
): number {
  const total = Math.max(0, Number(totalCommission) || 0);

  if (total <= 0) {
    return 0;
  }

  return roundMoney(total / (1 + AIRBNB_COMMISSION_VAT_RATE));
}

export function airbnbCommissionVat(totalCommission: number): number {
  const total = Math.max(0, Number(totalCommission) || 0);
  const imposable = airbnbCommissionImposable(total);

  return roundMoney(total - imposable);
}

export interface AirbnbDerivedAmounts {
  hostNet: number;
  grossIncome: number;
  otaCommission: number;
  commissionImposable: number;
  commissionVat: number;
  spreadsheetCommission: number;
  commissionRate: number;
}

export function deriveAirbnbBookingAmounts(
  hostNet: number,
  commissionRate = DEFAULT_AIRBNB_COMMISSION_RATE,
): AirbnbDerivedAmounts {
  const net = roundMoney(Math.max(0, Number(hostNet) || 0));
  const grossIncome = grossBookingFromAirbnbHostNet(net, commissionRate);
  const otaCommission = airbnbTotalCommissionFromAmounts(grossIncome, net);

  return {
    hostNet: net,
    grossIncome,
    otaCommission,
    commissionImposable: airbnbCommissionImposable(otaCommission),
    commissionVat: airbnbCommissionVat(otaCommission),
    spreadsheetCommission: airbnbSpreadsheetCommissionFromHostNet(
      net,
      commissionRate,
    ),
    commissionRate,
  };
}
