import type { BankAccountId, BankInstitutionId } from "./types";

export type OtaBankChannel = "airbnb" | "booking" | "vrbo" | "unknown";

export interface ParsedBankStatementLine {
  receivedDate: string;
  amount: number;
  counterparty: string;
  reference: string;
  otaChannel: OtaBankChannel;
  externalBookingId?: string;
  fingerprint: string;
}

export interface BankStatementParseResult {
  format: "finom" | "bper" | "unknown";
  lines: ParsedBankStatementLine[];
  skippedRows: number;
}

export function extractBookingExternalId(text: string): string | undefined {
  const dotted = text.match(/ID\.(\d+)/i);
  if (dotted?.[1]) {
    return dotted[1];
  }
  const spaced = text.match(/\bID[:\s]+(\d{6,})\b/i);
  return spaced?.[1];
}

function parseItalianAmount(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

function parseFinomAmount(value: string): number {
  const cleaned = value
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/[€]/g, "")
    .replace(/\s*EUR\s*/gi, "")
    .trim();
  if (!cleaned) {
    return Number.NaN;
  }
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return parseItalianAmount(cleaned);
  }
  if (cleaned.includes(",")) {
    return parseItalianAmount(cleaned);
  }
  return Number(cleaned);
}

function parseFinomDate(value: string): string | undefined {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const slash = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (slash) {
    return `${slash[3]}-${slash[2]}-${slash[1]}`;
  }
  const dot = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dot) {
    return `${dot[3]}-${dot[2]}-${dot[1]}`;
  }
  return undefined;
}

function parseBperDate(value: string): string | undefined {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) {
    return undefined;
  }
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function detectOtaChannel(text: string): OtaBankChannel {
  const upper = text.toUpperCase();
  if (upper.includes("AIRBNB")) {
    return "airbnb";
  }
  if (upper.includes("BOOKING.COM") || upper.includes("BOOKING COM")) {
    return "booking";
  }
  if (/\bBOOKING\b/.test(upper) && upper.includes("B.V")) {
    return "booking";
  }
  if (upper.includes("VRBO") || upper.includes("HOMEAWAY")) {
    return "vrbo";
  }
  return "unknown";
}

function buildFingerprint(parts: string[]): string {
  return parts.join("|").toLowerCase();
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseBankStatementCsv(
  content: string,
  context: {
    bankAccountId: BankAccountId;
    bankInstitution: BankInstitutionId;
  },
): BankStatementParseResult {
  const normalized = content.replace(/^\uFEFF/, "").trim();
  const rows = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length === 0) {
    return { format: "unknown", lines: [], skippedRows: 0 };
  }

  const header = rows[0].toLowerCase();
  if (header.includes("completed date") && header.includes("counterparty")) {
    return parseFinomCsv(rows, context);
  }

  if (
    (header.includes("societa") || header.includes("societ")) &&
    header.includes("importo") &&
    rows[0].includes(";")
  ) {
    return parseBperCsv(rows, context);
  }

  if (
    header.includes("descrizione") &&
    header.includes("importo") &&
    header.includes("contabile") &&
    rows[0].includes(";")
  ) {
    return parseBperCsv(rows, context);
  }

  return { format: "unknown", lines: [], skippedRows: rows.length - 1 };
}

function findFinomColumnIndices(headerRow: string): {
  dateIdx: number;
  counterpartyIdx: number;
  referenceIdx: number;
  amountIdx: number;
} | null {
  const cells = parseCsvLine(headerRow, ",").map((cell) =>
    cell.trim().toLowerCase(),
  );
  const dateIdx = cells.findIndex(
    (cell) => cell.includes("completed date") || cell === "date",
  );
  const counterpartyIdx = cells.findIndex((cell) =>
    cell.includes("counterparty"),
  );
  const referenceIdx = cells.findIndex((cell) => cell.includes("reference"));
  const amountIdx = cells.findIndex(
    (cell) => cell === "amount" || cell.startsWith("amount"),
  );
  if (
    dateIdx < 0 ||
    counterpartyIdx < 0 ||
    referenceIdx < 0 ||
    amountIdx < 0
  ) {
    return null;
  }
  return { dateIdx, counterpartyIdx, referenceIdx, amountIdx };
}

function parseFinomCsv(
  rows: string[],
  context: {
    bankAccountId: BankAccountId;
    bankInstitution: BankInstitutionId;
  },
): BankStatementParseResult {
  const lines: ParsedBankStatementLine[] = [];
  let skippedRows = 0;
  const columnIndices = findFinomColumnIndices(rows[0] ?? "");
  const useIndices = columnIndices ?? {
    dateIdx: 0,
    counterpartyIdx: 1,
    referenceIdx: 2,
    amountIdx: 3,
  };

  for (const row of rows.slice(1)) {
    const cells = parseCsvLine(row, ",");
    if (cells.length <= useIndices.amountIdx) {
      skippedRows += 1;
      continue;
    }

    const receivedDate = parseFinomDate(cells[useIndices.dateIdx] ?? "");
    const counterparty = cells[useIndices.counterpartyIdx] ?? "";
    const reference = cells[useIndices.referenceIdx] ?? "";
    const amount = parseFinomAmount(cells[useIndices.amountIdx] ?? "");

    if (!receivedDate || !Number.isFinite(amount) || amount <= 0) {
      skippedRows += 1;
      continue;
    }

    const combined = `${counterparty} ${reference}`;
    const otaChannel = detectOtaChannel(combined);
    if (otaChannel === "unknown") {
      skippedRows += 1;
      continue;
    }

    const externalBookingId = extractBookingExternalId(combined);
    const roundedAmount = Math.round(amount * 100) / 100;

    lines.push({
      receivedDate,
      amount: roundedAmount,
      counterparty,
      reference,
      otaChannel,
      externalBookingId,
      fingerprint: buildFingerprint([
        context.bankInstitution,
        context.bankAccountId,
        receivedDate,
        String(roundedAmount),
        counterparty,
        reference,
      ]),
    });
  }

  return { format: "finom", lines, skippedRows };
}

function findBperColumnIndices(headerRow: string): {
  contabileIdx: number;
  descrizioneIdx: number;
  importoIdx: number;
} | null {
  const cells = headerRow.split(";").map((cell) =>
    cell
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, ""),
  );
  const contabileIdx = cells.findIndex((cell) => cell.includes("contabile"));
  const descrizioneIdx = cells.findIndex((cell) => cell.includes("descrizione"));
  const importoIdx = cells.findIndex((cell) => cell === "importo" || cell.startsWith("importo"));
  if (contabileIdx < 0 || descrizioneIdx < 0 || importoIdx < 0) {
    return null;
  }
  return { contabileIdx, descrizioneIdx, importoIdx };
}

function parseBperRowFields(
  row: string,
  indices: {
    contabileIdx: number;
    descrizioneIdx: number;
    importoIdx: number;
  },
): { receivedDate?: string; description: string; amount: number } | null {
  const parts = row.split(";");
  const minParts = indices.importoIdx + 1;
  if (parts.length < minParts) {
    return null;
  }

  const receivedDate = parseBperDate(parts[indices.contabileIdx] ?? "");
  let description: string;
  let amountRaw: string;

  if (parts.length > minParts && parts.length >= indices.descrizioneIdx + 2) {
    // Ultima colonna = Div.; penultima = Importo
    amountRaw = parts[parts.length - 2] ?? "";
    description = parts.slice(indices.descrizioneIdx, parts.length - 2).join(";");
  } else {
    amountRaw = parts[indices.importoIdx] ?? "";
    description = parts[indices.descrizioneIdx] ?? "";
  }

  const amount = parseItalianAmount(amountRaw);
  return { receivedDate, description, amount };
}

function parseBperCsv(
  rows: string[],
  context: {
    bankAccountId: BankAccountId;
    bankInstitution: BankInstitutionId;
  },
): BankStatementParseResult {
  const lines: ParsedBankStatementLine[] = [];
  let skippedRows = 0;
  const columnIndices = findBperColumnIndices(rows[0] ?? "");
  if (!columnIndices) {
    return { format: "bper", lines: [], skippedRows: rows.length - 1 };
  }

  for (const row of rows.slice(1)) {
    const fields = parseBperRowFields(row, columnIndices);
    if (!fields) {
      skippedRows += 1;
      continue;
    }

    const { receivedDate, description, amount } = fields;

    if (!receivedDate || !Number.isFinite(amount) || amount <= 0) {
      skippedRows += 1;
      continue;
    }

    const upper = description.toUpperCase();
    const isOtaInflow =
      upper.includes("BONIFICI ESTERI") &&
      (upper.includes("AIRBNB") || upper.includes("BOOKING"));
    if (!isOtaInflow) {
      skippedRows += 1;
      continue;
    }

    const otaChannel = detectOtaChannel(description);
    const externalBookingId = extractBookingExternalId(description);
    const roundedAmount = Math.round(amount * 100) / 100;

    lines.push({
      receivedDate,
      amount: roundedAmount,
      counterparty: description.slice(0, 80),
      reference: description,
      otaChannel,
      externalBookingId,
      fingerprint: buildFingerprint([
        context.bankInstitution,
        context.bankAccountId,
        receivedDate,
        String(roundedAmount),
        description.slice(0, 120),
      ]),
    });
  }

  return { format: "bper", lines, skippedRows };
}
