import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAuth } from "@/lib/auth-request";
import { FISCAL_YEAR } from "@/lib/constants";
import { parseAirbnbUpload } from "@/lib/ota-import/parse-airbnb-upload";

export async function POST(request: NextRequest) {
  if (!(await requireApiAuth(request))) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseAirbnbUpload(buffer, propertyId, year, month);

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
