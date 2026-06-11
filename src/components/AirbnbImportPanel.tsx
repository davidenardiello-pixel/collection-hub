"use client";

import { useRef, useState } from "react";
import { formatCurrency } from "@/lib/calculations";
import { calculateBookingVat } from "@/lib/booking-vat";
import { FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import type { AirbnbSyncPreview } from "@/lib/ota-import/airbnb";
import {
  getLatestAirbnbSnapshot,
  sumReservationMoney,
} from "@/lib/ota-import/snapshots";
import type { OtaImportSnapshot, Property } from "@/lib/types";
import { Button, Card, Field, Select } from "./ui";

function getDefaultImportMonth(): number {
  const today = new Date();
  if (today.getFullYear() === FISCAL_YEAR) {
    return today.getMonth() + 1;
  }

  return 1;
}

export function AirbnbImportPanel({
  properties,
  otaImportSnapshots,
  onImportAirbnb,
  onMessage,
}: {
  properties: Property[];
  otaImportSnapshots?: OtaImportSnapshot[];
  onImportAirbnb: (
    propertyId: string,
    file: File,
    year: number,
    month: number,
  ) => Promise<AirbnbSyncPreview | { error: string }>;
  onMessage?: (text: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [month, setMonth] = useState(String(getDefaultImportMonth()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AirbnbSyncPreview | null>(null);
  const savedSnapshot = getLatestAirbnbSnapshot(
    otaImportSnapshots,
    propertyId,
    FISCAL_YEAR,
    Number(month),
  );

  async function runImport(file: File) {
    if (!propertyId) {
      const message = "Seleziona un appartamento prima di caricare il file.";
      setError(message);
      onMessage?.(message);
      return;
    }

    setLoading(true);
    setPreview(null);
    setError(null);

    try {
      const result = await onImportAirbnb(
        propertyId,
        file,
        FISCAL_YEAR,
        Number(month),
      );

      if ("error" in result) {
        setError(result.error);
        onMessage?.(result.error);
        return;
      }

      setPreview(result);
      const removedHint =
        result.removedGuests.length > 0
          ? ` · rimosse: ${result.removedGuests.join(", ")}`
          : "";
      onMessage?.(
        `Airbnb sincronizzato: +${result.added} · aggiornate ${result.updated} · eliminate ${result.removed}${removedHint} · bloccate ${result.locked}.`,
      );
    } catch (importError) {
      const message =
        importError instanceof Error
          ? importError.message
          : "Import Airbnb non riuscito.";
      setError(message);
      onMessage?.(message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void runImport(file);
  }

  return (
    <Card title="Import Airbnb">
      <p className="mb-4 text-sm text-rc-muted">
        Carica l&apos;export prenotazioni Airbnb (.csv). Il campo{" "}
        <strong>Guadagni</strong> è già netto (commissioni Airbnb dedotte).
        Escludiamo solo le righe con stato cancellato. L&apos;IVA (10% scorporo)
        e le pulizie check-in sono calcolate come per Booking.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Appartamento">
          <Select
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Mese competenza">
          <Select value={month} onChange={(event) => setMonth(event.target.value)}>
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={String(index + 1)}>
                {label} {FISCAL_YEAR}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="File export Airbnb">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            disabled={loading || !propertyId}
            onChange={handleFileChange}
            className="block w-full text-sm text-rc-muted file:mr-3 file:rounded-lg file:border-0 file:bg-rc-gold/20 file:px-3 file:py-2 file:text-sm file:font-medium file:text-rc-gold-light hover:file:bg-rc-gold/30"
          />
        </Field>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {savedSnapshot ? (
        <div className="mt-4 rounded-xl border border-rc-gold/20 bg-rc-charcoal/30 p-4 text-sm">
          <p className="font-semibold text-rc-gold-light">
            Ultimo upload Airbnb — {savedSnapshot.scope}
          </p>
          <p className="mt-2 text-rc-muted">
            {savedSnapshot.filename} · {savedSnapshot.reservationCount}{" "}
            prenotazioni · netto {formatCurrency(savedSnapshot.grossTotal)}
          </p>
          {savedSnapshot.removedGuests.length > 0 ? (
            <p className="mt-1 text-xs text-rc-gold-light/80">
              Rimosse: {savedSnapshot.removedGuests.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <div className="mt-4 rounded-xl border border-rc-gold/20 bg-rc-charcoal/40 p-4 text-sm">
          <p className="font-semibold text-rc-gold-light">
            Ultimo sync — {preview.scope}
          </p>
          <p className="mt-2 text-rc-muted">
            {preview.reservations.length} prenotazioni · +{preview.added} ·
            aggiornate {preview.updated} · eliminate {preview.removed} · bloccate{" "}
            {preview.locked}
          </p>
          <p className="mt-2 text-rc-muted">
            Dal file — netto{" "}
            {formatCurrency(
              sumReservationMoney(
                preview.reservations.map((item) => item.netEarnings),
              ),
            )}{" "}
            · IVA 10% (scorporo, calcolata){" "}
            {formatCurrency(
              preview.reservations.reduce(
                (total, item) =>
                  total +
                  calculateBookingVat({
                    id: "",
                    description: "",
                    propertyId: "",
                    platformId: "airbnb",
                    checkIn: item.checkIn,
                    checkOut: item.checkOut,
                    grossIncome: item.netEarnings,
                    cleaningFee: 0,
                    otaCommission: 0,
                  }),
                0,
              ),
            )}
          </p>
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-rc-muted">
            {preview.reservations.map((reservation) => (
              <li key={reservation.externalId}>
                {reservation.guestName} · {reservation.checkIn} →{" "}
                {reservation.checkOut} · {formatCurrency(reservation.netEarnings)}
                {reservation.status ? ` · ${reservation.status}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4">
          <Button disabled>Lettura file in corso…</Button>
        </div>
      ) : null}
    </Card>
  );
}
