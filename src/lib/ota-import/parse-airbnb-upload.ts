import {
  buildAirbnbSyncPeriod,
  type AirbnbReservation,
  type AirbnbSyncPeriod,
} from "./airbnb";
import {
  mapHeaders,
  normalizeHeader,
  parseCsvContent,
  parseIsoDate,
  parseMoney,
} from "./parse-utils";

const CANCELLED_STATUS_MARKERS = [
  "cancellato",
  "cancellata",
  "cancelled",
  "canceled",
  "annullato",
  "annullata",
];

const HEADER_ALIASES: Record<string, string[]> = {
  external_id: ["codice di conferma", "confirmation code"],
  status: ["stato", "status"],
  guest_name: ["nome dell'ospite", "guest name"],
  check_in: ["data di inizio", "start date", "check-in"],
  check_out: ["data di fine", "end date", "check-out"],
  nights: ["n. di notti", "nights"],
  earnings: ["guadagni", "earnings", "payout"],
};

function isCancelledStatus(status: string): boolean {
  const normalized = normalizeHeader(status);
  return CANCELLED_STATUS_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
}

export function parseAirbnbUpload(
  buffer: Buffer,
  propertyId: string,
  year: number,
  month: number,
): {
  propertyId: string;
  period: AirbnbSyncPeriod;
  reservations: AirbnbReservation[];
} {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Seleziona un mese di competenza valido (1–12).");
  }

  const period = buildAirbnbSyncPeriod(year, month);
  const content = buffer.toString("utf-8");
  const rows = parseCsvContent(content);

  if (rows.length < 2) {
    return { propertyId, period, reservations: [] };
  }

  const headers = mapHeaders(
    rows[0],
    HEADER_ALIASES,
    [
      "external_id",
      "status",
      "guest_name",
      "check_in",
      "check_out",
      "earnings",
    ],
  );

  const reservations: AirbnbReservation[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row || !row.some((cell) => String(cell).trim())) {
      continue;
    }

    const status = String(row[headers.status] ?? "").trim();
    if (isCancelledStatus(status)) {
      continue;
    }

    const externalId = String(row[headers.external_id] ?? "")
      .trim()
      .replace(/^"|"$/g, "");
    const checkIn = parseIsoDate(row[headers.check_in]);
    const checkOut = parseIsoDate(row[headers.check_out]);

    if (!externalId || !checkIn || !checkOut) {
      continue;
    }

    const guestName =
      String(row[headers.guest_name] ?? "").trim().replace(/^"|"$/g, "") ||
      `Prenotazione ${externalId}`;
    const netEarnings = parseMoney(row[headers.earnings]);

    let nights = 0;
    if (headers.nights !== undefined) {
      const parsedNights = Number(String(row[headers.nights] ?? "").trim());
      nights = Number.isFinite(parsedNights) ? Math.trunc(parsedNights) : 0;
    }

    reservations.push({
      externalId,
      guestName,
      checkIn,
      checkOut,
      netEarnings,
      nights,
      status,
    });
  }

  return { propertyId, period, reservations };
}
