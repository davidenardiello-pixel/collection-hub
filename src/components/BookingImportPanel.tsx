"use client";

import { useRef, useState } from "react";
import { formatCurrency } from "@/lib/calculations";
import { calculateBookingVat } from "@/lib/booking-vat";
import { FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import type { BookingComSyncPreview } from "@/lib/ota-import/booking-com";
import { parseBookingComPeriodFromFilename } from "@/lib/ota-import/booking-com";
import {
  getLatestBookingComSnapshot,
  sumReservationMoney,
} from "@/lib/ota-import/snapshots";
import type { OtaImportSnapshot, Property } from "@/lib/types";
import { Button, Card, Field, Select } from "./ui";

export function BookingImportPanel({
  properties,
  otaImportSnapshots,
  onImportBookingCom,
  onMessage,
}: {
  properties: Property[];
  otaImportSnapshots?: OtaImportSnapshot[];
  onImportBookingCom: (
    propertyId: string,
    file: File,
  ) => Promise<BookingComSyncPreview | { error: string }>;
  onMessage?: (text: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BookingComSyncPreview | null>(null);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const detectedPeriod = selectedFilename
    ? parseBookingComPeriodFromFilename(selectedFilename)
    : null;
  const savedSnapshot = getLatestBookingComSnapshot(
    otaImportSnapshots,
    propertyId,
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
      const result = await onImportBookingCom(propertyId, file);

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
        `Booking.com sincronizzato: +${result.added} · aggiornate ${result.updated} · eliminate ${result.removed}${removedHint} · bloccate ${result.locked}.`,
      );
    } catch (importError) {
      const message =
        importError instanceof Error
          ? importError.message
          : "Import Booking.com non riuscito.";
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

    setSelectedFilename(file.name);
    void runImport(file);
  }

  return (
    <Card title="Import Booking.com">
      <p className="mb-4 text-sm text-rc-muted">
        Carica l&apos;export mensile Booking (.xls) per un appartamento. Dal file
        leggiamo prenotazione e prezzo; le commissioni seguono il PDF Booking
        (commissione OTA + 1,5% costo pagamento, es. 18% + 1,5% = 19,5%). L&apos;XLS
        da solo sottostima (solo 18%). L&apos;IVA 10% scorporo sul lordo è calcolata
        a parte, come nell&apos;inserimento manuale.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
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

        <Field label="File export Booking">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={loading || !propertyId}
            onChange={handleFileChange}
            className="block w-full text-sm text-rc-muted file:mr-3 file:rounded-lg file:border-0 file:bg-rc-gold/20 file:px-3 file:py-2 file:text-sm file:font-medium file:text-rc-gold-light hover:file:bg-rc-gold/30"
          />
        </Field>
      </div>

      <p className="mt-3 text-xs text-rc-muted">
        Il mese di competenza viene letto dal <strong>nome del file</strong>, es.{" "}
        <code className="text-rc-gold-light">
          Soggiorno_ {FISCAL_YEAR}-06-01 - {FISCAL_YEAR}-06-30.xls
        </code>
        {detectedPeriod ? (
          <>
            {" "}
            → rilevato:{" "}
            <strong className="text-rc-gold-light">
              {MONTH_LABELS[detectedPeriod.month - 1]} {detectedPeriod.year}
            </strong>
          </>
        ) : selectedFilename ? (
          <>
            {" "}
            → nome file non valido: inserisci le date{" "}
            <code className="text-rc-gold-light">YYYY-MM-DD - YYYY-MM-DD</code> nel
            nome.
          </>
        ) : null}
      </p>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {savedSnapshot ? (
        <div className="mt-4 rounded-xl border border-rc-gold/20 bg-rc-charcoal/30 p-4 text-sm">
          <p className="font-semibold text-rc-gold-light">
            Ultimo upload dalla dashboard
          </p>
          <p className="mt-2 text-rc-muted">
            {savedSnapshot.filename} · {savedSnapshot.reservationCount}{" "}
            prenotazioni · lordo {formatCurrency(savedSnapshot.grossTotal)} ·
            commissioni {formatCurrency(savedSnapshot.commissionTotal)}
          </p>
          {savedSnapshot.removedGuests.length > 0 ? (
            <p className="mt-1 text-xs text-rc-gold-light/80">
              Rimosse: {savedSnapshot.removedGuests.join(", ")}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-rc-muted">
            {savedSnapshot.guests.join(" · ")}
          </p>
        </div>
      ) : null}

      {preview ? (
        <div className="mt-4 rounded-xl border border-rc-gold/20 bg-rc-charcoal/40 p-4 text-sm">
          <p className="font-semibold text-rc-gold-light">
            Ultimo sync — {preview.scope}
          </p>
          <p className="mt-2 text-rc-muted">
            {preview.reservations.length} prenotazioni · +{preview.added} ·
            aggiornate {preview.updated} · eliminate {preview.removed} ·
            bloccate {preview.locked}
          </p>
          <p className="mt-2 text-rc-muted">
            Dal file — lordo{" "}
            {formatCurrency(
              sumReservationMoney(
                preview.reservations.map((item) => item.grossIncome),
              ),
            )}{" "}
            · commissioni{" "}
            {formatCurrency(
              sumReservationMoney(
                preview.reservations.map((item) => item.otaCommission),
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
                    platformId: "booking",
                    checkIn: item.checkIn,
                    checkOut: item.checkOut,
                    grossIncome: item.grossIncome,
                    cleaningFee: 0,
                    otaCommission: item.otaCommission,
                  }),
                0,
              ),
            )}
          </p>
          {preview.removedGuests.length > 0 ? (
            <p className="mt-1 text-xs text-rc-gold-light/80">
              Rimosse dal file: {preview.removedGuests.join(", ")}
            </p>
          ) : null}
          <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-rc-muted">
            {preview.reservations.map((reservation) => (
              <li key={reservation.externalId}>
                {reservation.guestName} · {reservation.checkIn} →{" "}
                {reservation.checkOut} · {formatCurrency(reservation.grossIncome)}{" "}
                (comm. {formatCurrency(reservation.otaCommission)})
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
