import * as XLSX from "xlsx";
import {
  bookingCommissionAndCosts,
  parseBookingComPeriodFromFilename,
  type BookingComReservation,
  type BookingComSyncPeriod,
} from "./booking-com";
import {
  mapHeaders,
  normalizeHeader,
  parseIsoDate,
  parseMoney,
} from "./parse-utils";

const ACTIVE_STATUSES = new Set(["ok", "confirmed", "confermata", "confermato"]);
const CANCELLED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "cancellata",
  "cancellato",
  "annullata",
  "annullato",
  "no-show",
  "no show",
]);

const DEFAULT_COMMISSION_PCT = 18;

const HEADER_ALIASES: Record<string, string[]> = {
  external_id: [
    "n° di prenotazione",
    "numero di prenotazione",
    "reservation number",
  ],
  guest_name: ["nome ospite(i)", "guest name(s)", "nome ospite"],
  check_in: ["arrivo", "check-in", "check in"],
  check_out: ["partenza", "check-out", "check out"],
  price: ["prezzo", "price"],
  commission_pct: ["% commissione", "commission %", "commission percentage"],
  commission: ["importo commissione", "commission amount"],
  status: ["stato", "status"],
  cancelled_at: ["data di cancellazione", "cancellation date"],
  nights: ["durata (notti)", "duration (nights)", "nights"],
};

function parseCommissionPct(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_COMMISSION_PCT;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_COMMISSION_PCT;
}

function parseWorkbookRows(buffer: Buffer): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];
}

export function parseBookingComUpload(
  buffer: Buffer,
  filename: string,
  propertyId: string,
): {
  propertyId: string;
  period: BookingComSyncPeriod;
  reservations: BookingComReservation[];
} {
  const period = parseBookingComPeriodFromFilename(filename);
  if (!period) {
    throw new Error(
      "Nome file non valido. Usa l'export Booking con intervallo date nel nome (es. 2026-06-01 - 2026-06-30).",
    );
  }

  const rows = parseWorkbookRows(buffer);
  if (rows.length < 2) {
    return { propertyId, period, reservations: [] };
  }

  const headers = mapHeaders(
    rows[0],
    HEADER_ALIASES,
    ["external_id", "guest_name", "check_in", "check_out", "price"],
  );

  const reservations: BookingComReservation[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row || row.length === 0) {
      continue;
    }

    const status =
      headers.status !== undefined
        ? normalizeHeader(row[headers.status])
        : "ok";
    const cancelledAt =
      headers.cancelled_at !== undefined
        ? parseIsoDate(row[headers.cancelled_at])
        : null;

    if (cancelledAt || CANCELLED_STATUSES.has(status)) {
      continue;
    }

    if (!ACTIVE_STATUSES.has(status)) {
      continue;
    }

    let externalId = String(row[headers.external_id] ?? "").trim();
    if (externalId.endsWith(".0")) {
      externalId = externalId.slice(0, -2);
    }

    const checkIn = parseIsoDate(row[headers.check_in]);
    const checkOut = parseIsoDate(row[headers.check_out]);
    if (!externalId || !checkIn || !checkOut) {
      continue;
    }

    const guestName =
      String(row[headers.guest_name] ?? "").trim() ||
      `Prenotazione ${externalId}`;
    const grossIncome = parseMoney(row[headers.price]);
    const commissionPct =
      headers.commission_pct !== undefined
        ? parseCommissionPct(row[headers.commission_pct])
        : DEFAULT_COMMISSION_PCT;
    const otaCommission = bookingCommissionAndCosts(grossIncome, commissionPct);

    let nights = 0;
    if (headers.nights !== undefined) {
      const parsedNights = Number(row[headers.nights]);
      nights = Number.isFinite(parsedNights) ? Math.trunc(parsedNights) : 0;
    }

    reservations.push({
      externalId,
      guestName,
      checkIn,
      checkOut,
      grossIncome,
      otaCommission,
      nights,
    });
  }

  return { propertyId, period, reservations };
}
