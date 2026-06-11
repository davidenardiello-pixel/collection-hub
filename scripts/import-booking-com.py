#!/usr/bin/env python3
"""Parse Booking.com reservation export (.xls) into JSON for dashboard sync."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import xlrd
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "xlrd is required. Install with: pip3 install xlrd"
    ) from exc

ACTIVE_STATUSES = {"ok", "confirmed", "confermata", "confermato"}
CANCELLED_STATUSES = {
    "cancelled",
    "canceled",
    "cancellata",
    "cancellato",
    "annullata",
    "annullato",
    "no-show",
    "no show",
}

# Booking addebita "Commissione e costi" = % commissione OTA + costo pagamento (~1,5%).
# L'XLS espone solo "Importo commissione" al 18%; il PDF estratto conto usa il totale reale.
BOOKING_PAYMENT_FEE_PCT = 1.5
DEFAULT_COMMISSION_PCT = 18.0

HEADER_ALIASES = {
    "external_id": ("n° di prenotazione", "numero di prenotazione", "reservation number"),
    "guest_name": ("nome ospite(i)", "guest name(s)", "nome ospite"),
    "check_in": ("arrivo", "check-in", "check in"),
    "check_out": ("partenza", "check-out", "check out"),
    "price": ("prezzo", "price"),
    "commission_pct": ("% commissione", "commission %", "commission percentage"),
    "commission": ("importo commissione", "commission amount"),
    "status": ("stato", "status"),
    "cancelled_at": ("data di cancellazione", "cancellation date"),
    "nights": ("durata (notti)", "duration (nights)", "nights"),
}


def normalize_header(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def parse_money(value: object) -> float:
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)):
        return round(float(value), 2)

    text = str(value).strip().replace("\xa0", " ")
    match = re.search(r"[-+]?\d[\d.,]*", text)
    if not match:
        return 0.0

    number = match.group(0)
    if "," in number and "." in number:
        # 1.234,56 → migliaia con punto, decimali con virgola
        number = number.replace(".", "").replace(",", ".")
    elif "," in number:
        number = number.replace(",", ".")
    # altrimenti il punto è già separatore decimale (725.53)

    return round(float(number), 4)


def parse_commission_pct(value: object) -> float:
    if value is None or value == "":
        return DEFAULT_COMMISSION_PCT

    try:
        return float(value)
    except (TypeError, ValueError):
        return DEFAULT_COMMISSION_PCT


def booking_commission_and_costs(gross_income: float, commission_pct: float) -> float:
    """Allinea al PDF Booking: commissione OTA + costo pagamento."""
    total_pct = commission_pct + BOOKING_PAYMENT_FEE_PCT
    return round(gross_income * total_pct / 100, 2)


def parse_iso_date(value: object) -> str | None:
    if value is None or value == "":
        return None
    if hasattr(value, "date"):
        return value.date().isoformat()
    text = str(value).strip()
    return text[:10] if len(text) >= 10 else None


def parse_period_from_filename(filename: str) -> dict[str, object] | None:
    match = re.search(
        r"(\d{4})-(\d{2})-(\d{2})\s*-\s*(\d{4})-(\d{2})-(\d{2})",
        filename,
    )
    if not match:
        return None
    return {
        "year": int(match.group(1)),
        "month": int(match.group(2)),
        "startDate": f"{match.group(1)}-{match.group(2)}-{match.group(3)}",
        "endDate": f"{match.group(4)}-{match.group(5)}-{match.group(6)}",
    }


def map_headers(header_row: list[object]) -> dict[str, int]:
    mapping: dict[str, int] = {}
    normalized = [normalize_header(cell) for cell in header_row]

    for key, aliases in HEADER_ALIASES.items():
        for index, header in enumerate(normalized):
            if any(alias in header for alias in aliases):
                mapping[key] = index
                break

    missing = [
        key
        for key in (
            "external_id",
            "guest_name",
            "check_in",
            "check_out",
            "price",
        )
        if key not in mapping
    ]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    return mapping


def parse_workbook(path: Path) -> list[dict[str, object]]:
    workbook = xlrd.open_workbook(path)
    sheet = workbook.sheet_by_index(0)
    if sheet.nrows < 2:
        return []

    headers = map_headers(sheet.row_values(0))
    reservations: list[dict[str, object]] = []

    for row_index in range(1, sheet.nrows):
        row = sheet.row_values(row_index)
        status = str(row[headers["status"]]).strip().lower() if "status" in headers else "ok"
        cancelled_at = (
            parse_iso_date(row[headers["cancelled_at"]])
            if "cancelled_at" in headers
            else None
        )

        if cancelled_at or status in CANCELLED_STATUSES:
            continue

        if status not in ACTIVE_STATUSES:
            continue

        external_id = str(row[headers["external_id"]]).strip()
        if external_id.endswith(".0"):
            external_id = external_id[:-2]

        check_in = parse_iso_date(row[headers["check_in"]])
        check_out = parse_iso_date(row[headers["check_out"]])
        if not external_id or not check_in or not check_out:
            continue

        guest_name = str(row[headers["guest_name"]]).strip() or f"Prenotazione {external_id}"
        gross_income = parse_money(row[headers["price"]])
        commission_pct = (
            parse_commission_pct(row[headers["commission_pct"]])
            if "commission_pct" in headers
            else DEFAULT_COMMISSION_PCT
        )
        commission = booking_commission_and_costs(gross_income, commission_pct)
        nights = 0
        if "nights" in headers:
            try:
                nights = int(float(row[headers["nights"]]))
            except (TypeError, ValueError):
                nights = 0

        reservations.append(
            {
                "externalId": external_id,
                "guestName": guest_name,
                "checkIn": check_in,
                "checkOut": check_out,
                "grossIncome": gross_income,
                "otaCommission": commission,
                "nights": nights,
            }
        )

    return reservations


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path, help="Booking.com .xls export")
    parser.add_argument("--property-id", required=True)
    parser.add_argument("--year", type=int)
    parser.add_argument("--month", type=int)
    parser.add_argument("--start-date")
    parser.add_argument("--end-date")
    args = parser.parse_args()

    if not args.file.exists():
        raise SystemExit(f"File not found: {args.file}")

    period = parse_period_from_filename(args.file.name)
    if not period and args.year and args.month and args.start_date and args.end_date:
        period = {
            "year": args.year,
            "month": args.month,
            "startDate": args.start_date,
            "endDate": args.end_date,
        }
    if not period:
        raise SystemExit("Cannot infer period from filename. Use YYYY-MM-DD - YYYY-MM-DD in the name.")

    payload = {
        "propertyId": args.property_id,
        "period": period,
        "reservations": parse_workbook(args.file),
    }
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
