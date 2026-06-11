import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  parseBookingComPeriodFromFilename,
  type BookingComReservation,
  type BookingComSyncPeriod,
} from "@/lib/ota-import/booking-com";

interface ParsePayload {
  propertyId: string;
  period: BookingComSyncPeriod;
  reservations: BookingComReservation[];
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.\- ()]/g, "_") || "upload.xls";
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
  writeFileSync(join(uploadDir, "latest.xls"), buffer);

  return savedPath;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const propertyId = String(formData.get("propertyId") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File mancante." }, { status: 400 });
    }

    if (!propertyId) {
      return NextResponse.json(
        { error: "Seleziona un appartamento." },
        { status: 400 },
      );
    }

    const period = parseBookingComPeriodFromFilename(file.name);
    if (!period) {
      return NextResponse.json(
        {
          error:
            "Nome file non valido. Usa l'export Booking con intervallo date nel nome (es. 2026-06-01 - 2026-06-30).",
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const savedPath = persistUploadedFile(propertyId, file.name, buffer);

    const scriptPath = join(process.cwd(), "scripts", "import-booking-com.py");
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
        "--start-date",
        period.startDate,
        "--end-date",
        period.endDate,
      ],
      { encoding: "utf8" },
    );

    if (result.status !== 0) {
      const details = (result.stderr || result.stdout || "").trim();
      return NextResponse.json(
        {
          error:
            details ||
            "Impossibile leggere il file Booking. Installa xlrd con: pip3 install xlrd",
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
