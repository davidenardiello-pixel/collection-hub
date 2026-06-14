import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth-request";
import { parseBookingComPeriodFromFilename } from "@/lib/ota-import/booking-com";
import { parseBookingComUpload } from "@/lib/ota-import/parse-booking-com-upload";

export async function POST(request: NextRequest) {
  if (!(await requireApiAuth(request))) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

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
    const parsed = parseBookingComUpload(buffer, file.name, propertyId);

    return NextResponse.json({
      propertyId: parsed.propertyId,
      period: parsed.period,
      reservations: parsed.reservations,
      filename: file.name,
      count: parsed.reservations.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Errore durante la lettura del file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
