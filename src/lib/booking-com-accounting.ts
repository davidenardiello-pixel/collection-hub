/**
 * Parser per export contabilità Booking.com (estratti pagamenti / payout).
 * Collega ID batch pagamento (NO.xxx in banca) al numero prenotazione.
 */

export type BookingAccountingRowSource = "statements" | "payout";

export interface BookingAccountingReservationLine {
  source: BookingAccountingRowSource;
  reservationId: string;
  payoutBatchRef: string;
  netAmount: number;
  payoutDate?: string;
  propertyId?: string;
  propertyName?: string;
}

export interface BookingAccountingIndex {
  byBatchRef: Map<string, BookingAccountingReservationLine[]>;
  byReservationId: Map<string, BookingAccountingReservationLine[]>;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

function headerIndex(header: string[], ...candidates: string[]): number {
  const normalized = header.map((cell) =>
    cell
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, ""),
  );
  for (const candidate of candidates) {
    const key = candidate
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    const idx = normalized.findIndex((cell) => cell === key || cell.includes(key));
    if (idx >= 0) {
      return idx;
    }
  }
  return -1;
}

function parseMoney(value: string): number {
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  return Number(cleaned);
}

function normalizeReservationId(value: string): string {
  let id = value.trim();
  if (id.endsWith(".0")) {
    id = id.slice(0, -2);
  }
  return id;
}

export function detectBookingAccountingCsvFormat(
  text: string,
): BookingAccountingRowSource | "unknown" {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const header = parseCsvLine(firstLine).join(" ").toLowerCase();
  if (header.includes("numero prenotazione") && header.includes("id pagamento")) {
    return "statements";
  }
  if (
    header.includes("tipo/tipo di transazione") &&
    header.includes("numero di riferimento")
  ) {
    return "payout";
  }
  return "unknown";
}

function addToIndex(
  index: BookingAccountingIndex,
  line: BookingAccountingReservationLine,
): void {
  const batchList = index.byBatchRef.get(line.payoutBatchRef) ?? [];
  batchList.push(line);
  index.byBatchRef.set(line.payoutBatchRef, batchList);

  const resList = index.byReservationId.get(line.reservationId) ?? [];
  resList.push(line);
  index.byReservationId.set(line.reservationId, resList);
}

export function emptyBookingAccountingIndex(): BookingAccountingIndex {
  return {
    byBatchRef: new Map(),
    byReservationId: new Map(),
  };
}

export function mergeBookingAccountingIndexes(
  ...indexes: BookingAccountingIndex[]
): BookingAccountingIndex {
  const merged = emptyBookingAccountingIndex();
  for (const index of indexes) {
    for (const lines of index.byBatchRef.values()) {
      for (const line of lines) {
        addToIndex(merged, line);
      }
    }
  }
  return merged;
}

export function parseBookingStatementsAccountingCsv(
  text: string,
): BookingAccountingIndex {
  const rows = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const index = emptyBookingAccountingIndex();
  if (rows.length < 2) {
    return index;
  }

  const header = parseCsvLine(rows[0]);
  const typeIdx = headerIndex(header, "Tipologia");
  const resIdx = headerIndex(header, "Numero prenotazione");
  const netIdx = headerIndex(header, "Netto");
  const batchIdx = headerIndex(header, "ID pagamento");
  const payoutDateIdx = headerIndex(header, "Data del pagamento");

  if (resIdx < 0 || netIdx < 0 || batchIdx < 0) {
    return index;
  }

  for (const row of rows.slice(1)) {
    const cells = parseCsvLine(row);
    if (typeIdx >= 0) {
      const type = (cells[typeIdx] ?? "").trim().toLowerCase();
      if (type && type !== "prenotazione") {
        continue;
      }
    }
    const reservationId = normalizeReservationId(cells[resIdx] ?? "");
    const payoutBatchRef = (cells[batchIdx] ?? "").trim();
    const netAmount = parseMoney(cells[netIdx] ?? "");
    if (!reservationId || !payoutBatchRef || !Number.isFinite(netAmount)) {
      continue;
    }
    addToIndex(index, {
      source: "statements",
      reservationId,
      payoutBatchRef,
      netAmount: Math.round(netAmount * 100) / 100,
      payoutDate: payoutDateIdx >= 0 ? cells[payoutDateIdx]?.trim() : undefined,
    });
  }

  return index;
}

export function parseBookingPayoutExportCsv(text: string): BookingAccountingIndex {
  const rows = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const index = emptyBookingAccountingIndex();
  if (rows.length < 2) {
    return index;
  }

  const header = parseCsvLine(rows[0]);
  const typeIdx = headerIndex(header, "Tipo/tipo di transazione");
  const batchIdx = headerIndex(header, "Descrizione della transazione");
  const resIdx = headerIndex(header, "Numero di riferimento");
  const netIdx = headerIndex(
    header,
    "Importo della transazione",
    "Importo pagato",
  );
  const propertyIdIdx = headerIndex(header, "ID struttura");
  const propertyNameIdx = headerIndex(header, "Nome struttura");
  const payoutDateIdx = headerIndex(header, "Data del pagamento");

  if (typeIdx < 0 || batchIdx < 0 || resIdx < 0 || netIdx < 0) {
    return index;
  }

  for (const row of rows.slice(1)) {
    const cells = parseCsvLine(row);
    const type = (cells[typeIdx] ?? "").trim();
    if (type !== "Prenotazione") {
      continue;
    }
    const payoutBatchRef = (cells[batchIdx] ?? "").trim();
    const reservationId = normalizeReservationId(cells[resIdx] ?? "");
    const netRaw = cells[netIdx] ?? "";
    const netAmount = parseMoney(netRaw === "-" ? "0" : netRaw);
    if (!payoutBatchRef || !reservationId || !Number.isFinite(netAmount)) {
      continue;
    }
    addToIndex(index, {
      source: "payout",
      reservationId,
      payoutBatchRef,
      netAmount: Math.round(netAmount * 100) / 100,
      payoutDate: payoutDateIdx >= 0 ? cells[payoutDateIdx]?.trim() : undefined,
      propertyId:
        propertyIdIdx >= 0 ? (cells[propertyIdIdx] ?? "").trim() : undefined,
      propertyName:
        propertyNameIdx >= 0 ? (cells[propertyNameIdx] ?? "").trim() : undefined,
    });
  }

  return index;
}

export function parseBookingAccountingCsv(text: string): BookingAccountingIndex {
  const format = detectBookingAccountingCsvFormat(text);
  if (format === "statements") {
    return parseBookingStatementsAccountingCsv(text);
  }
  if (format === "payout") {
    return parseBookingPayoutExportCsv(text);
  }
  return emptyBookingAccountingIndex();
}

export function filterAccountingIndexToKnownReservations(
  index: BookingAccountingIndex,
  reservationIds: Set<string>,
): BookingAccountingIndex {
  const filtered = emptyBookingAccountingIndex();
  for (const lines of index.byReservationId.values()) {
    for (const line of lines) {
      const bare = line.reservationId.replace(/^0+/, "") || "0";
      const known =
        reservationIds.has(line.reservationId) ||
        reservationIds.has(bare) ||
        [...reservationIds].some(
          (id) => id.replace(/^0+/, "") === bare,
        );
      if (known) {
        addToIndex(filtered, line);
      }
    }
  }
  return filtered;
}

export function batchNetTotal(
  index: BookingAccountingIndex,
  payoutBatchRef: string,
): number {
  const lines = index.byBatchRef.get(payoutBatchRef) ?? [];
  const total = lines.reduce((sum, line) => sum + line.netAmount, 0);
  return Math.round(total * 100) / 100;
}

export function reservationIdsForBatch(
  index: BookingAccountingIndex,
  payoutBatchRef: string,
): string[] {
  const lines = index.byBatchRef.get(payoutBatchRef) ?? [];
  return [...new Set(lines.map((line) => line.reservationId))];
}
