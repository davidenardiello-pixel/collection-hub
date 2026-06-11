import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildAirbnbSyncPeriod,
  type AirbnbReservation,
  type AirbnbSyncPeriod,
} from "@/lib/ota-import/airbnb";
import { FISCAL_YEAR } from "@/lib/constants";

interface ParsePayload {
  propertyId: string;
  period: AirbnbSyncPeriod;
  reservations: AirbnbReservation[];
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.\- ()]/g, "_") || "upload.csv";
}

function persistUploadedFile(
  propertyId: string,
  filename: string,
  buffer: Buffer,
): string {
  const uploadDir = join(process.cwd(), "data", "ota-uploads", propertyId);
  mkdirSync(uploadDir, { recursive: true });

  const safeName = sanitizeFilename(filename);
  const savedPath = join(uploadDir, safeName);
  writeFileSync(savedPath, buffer);
  writeFileSync(join(uploadDir, "latest-airbnb.csv"), buffer);

  return savedPath;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const propertyId = String(formData.get("propertyId") ?? "").trim();
    const year = Number(formData.get("year") ?? FISCAL_YEAR);
    const month = Number(formData.get("month"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File mancante." }, { status: 400 });
    }

    if (!propertyId) {
      return NextResponse.json(
        { error: "Seleziona un appartamento." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Seleziona il mese di competenza dell'import." },
        { status: 400 },
      );
    }

    const period = buildAirbnbSyncPeriod(year, month);
    const buffer = Buffer.from(await file.arrayBuffer());
    const savedPath = persistUploadedFile(propertyId, file.name, buffer);

    const scriptPath = join(process.cwd(), "scripts", "import-airbnb.py");
    const result = spawnSync(
      "python3",
      [
        scriptPath,
        savedPath,
        "--property-id",
        propertyId,
        "--year",
        String(period.year),
        "--month",
        String(period.month),
      ],
      { encoding: "utf8" },
    );

    if (result.status !== 0) {
      const details = (result.stderr || result.stdout || "").trim();
      return NextResponse.json(
        {
          error: details || "Impossibile leggere il file Airbnb.",
        },
        { status: 500 },
      );
    }

    const parsed = JSON.parse(result.stdout) as ParsePayload;

    return NextResponse.json({
      propertyId: parsed.propertyId,
      period: parsed.period,
      reservations: parsed.reservations,
      filename: file.name,
      count: parsed.reservations.length,
      savedPath,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore durante la lettura del file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
