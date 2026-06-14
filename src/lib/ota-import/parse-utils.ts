export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function parseMoney(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }

  const text = String(value).trim().replace(/\u00a0/g, " ").replace(/€/g, "");
  const match = text.match(/[-+]?\d[\d.,]*/);
  if (!match) {
    return 0;
  }

  let number = match[0];
  if (number.includes(",") && number.includes(".")) {
    number = number.replace(/\./g, "").replace(",", ".");
  } else if (number.includes(",")) {
    number = number.replace(",", ".");
  }

  return Math.round(Number(number) * 100) / 100;
}

export function parseIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = String(value).trim();
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  if (text.length >= 10 && text[4] === "-") {
    return text.slice(0, 10);
  }

  return null;
}

export function mapHeaders(
  headerRow: unknown[],
  aliases: Record<string, string[]>,
  required: string[],
): Record<string, number> {
  const normalized = headerRow.map(normalizeHeader);
  const mapping: Record<string, number> = {};

  for (const [key, options] of Object.entries(aliases)) {
    for (let index = 0; index < normalized.length; index += 1) {
      const header = normalized[index];
      if (options.some((alias) => header.includes(alias))) {
        mapping[key] = index;
        break;
      }
    }
  }

  const missing = required.filter((key) => mapping[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Colonne mancanti nel file: ${missing.join(", ")}`);
  }

  return mapping;
}

export function parseCsvContent(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim())) {
      rows.push(row);
    }
  }

  return rows;
}
