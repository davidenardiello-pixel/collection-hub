#!/usr/bin/env python3
"""Parse Airbnb reservations export (.csv) into JSON for dashboard sync."""

from __future__ import annotations

import argparse
import calendar
import csv
import json
import re
import sys
from pathlib import Path

CANCELLED_STATUS_MARKERS = (
    "cancellato",
    "cancellata",
    "cancelled",
    "canceled",
    "annullato",
    "annullata",
)

HEADER_ALIASES = {
    "external_id": ("codice di conferma", "confirmation code"),
    "status": ("stato", "status"),
    "guest_name": ("nome dell'ospite", "guest name"),
    "check_in": ("data di inizio", "start date", "check-in"),
    "check_out": ("data di fine", "end date", "check-out"),
    "nights": ("n. di notti", "nights"),
    "earnings": ("guadagni", "earnings", "payout"),
}


def normalize_header(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def map_headers(header_row: list[str]) -> dict[str, int]:
    mapping: dict[str, int] = {}
    normalized = [normalize_header(cell) for cell in header_row]

    for key, aliases in HEADER_ALIASES.items():
        for index, header in enumerate(normalized):
            if any(alias in header for alias in aliases):
                mapping[key] = index
                break

    missing = [
        key
        for key in ("external_id", "status", "guest_name", "check_in", "check_out", "earnings")
        if key not in mapping
    ]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    return mapping


def parse_money(value: object) -> float:
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)):
        return round(float(value), 2)

    text = str(value).strip().replace("\xa0", " ").replace("€", "").strip()
    match = re.search(r"[-+]?\d[\d.,]*", text)
    if not match:
        return 0.0

    number = match.group(0)
    if "," in number and "." in number:
        number = number.replace(".", "").replace(",", ".")
    elif "," in number:
        number = number.replace(",", ".")

    return round(float(number), 2)


def parse_iso_date(value: object) -> str | None:
    if value is None or value == "":
        return None

    text = str(value).strip()

    match = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", text)
    if match:
        day, month, year = match.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    if len(text) >= 10 and text[4] == "-":
        return text[:10]

    return None


def is_cancelled_status(status: str) -> bool:
    normalized = normalize_header(status)
    return any(marker in normalized for marker in CANCELLED_STATUS_MARKERS)


def build_period(year: int, month: int) -> dict[str, object]:
    last_day = calendar.monthrange(year, month)[1]
    return {
        "year": year,
        "month": month,
        "startDate": f"{year}-{month:02d}-01",
        "endDate": f"{year}-{month:02d}-{last_day:02d}",
    }


def parse_csv(path: Path) -> list[dict[str, object]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        try:
            header_row = next(reader)
        except StopIteration:
            return []

        headers = map_headers(header_row)
        reservations: list[dict[str, object]] = []

        for row in reader:
            if not row or not any(str(cell).strip() for cell in row):
                continue

            status = str(row[headers["status"]]).strip()
            if is_cancelled_status(status):
                continue

            external_id = str(row[headers["external_id"]]).strip().strip('"')
            check_in = parse_iso_date(row[headers["check_in"]])
            check_out = parse_iso_date(row[headers["check_out"]])
            if not external_id or not check_in or not check_out:
                continue

            guest_name = (
                str(row[headers["guest_name"]]).strip().strip('"')
                or f"Prenotazione {external_id}"
            )
            net_earnings = parse_money(row[headers["earnings"]])
            nights = 0
            if "nights" in headers:
                try:
                    nights = int(float(str(row[headers["nights"]]).strip() or 0))
                except (TypeError, ValueError):
                    nights = 0

            reservations.append(
                {
                    "externalId": external_id,
                    "guestName": guest_name,
                    "checkIn": check_in,
                    "checkOut": check_out,
                    "netEarnings": net_earnings,
                    "nights": nights,
                    "status": status,
                }
            )

    return reservations


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path, help="Airbnb reservations .csv export")
    parser.add_argument("--property-id", required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, required=True)
    args = parser.parse_args()

    if not args.file.exists():
        raise SystemExit(f"File not found: {args.file}")

    if args.month < 1 or args.month > 12:
        raise SystemExit("Month must be between 1 and 12.")

    payload = {
        "propertyId": args.property_id,
        "period": build_period(args.year, args.month),
        "reservations": parse_csv(args.file),
    }
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
