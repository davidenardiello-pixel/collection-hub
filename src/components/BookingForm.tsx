"use client";

import { useMemo, useState } from "react";
import {
  formatCurrency,
  getBookingNetIncome,
  getBookingNights,
} from "@/lib/calculations";
import {
  calculateBookingVat,
  getBookingVatRate,
  isVatExemptPlatform,
} from "@/lib/booking-vat";
import type { Booking, Platform, Property } from "@/lib/types";
import { Button, Card, Field, Input, Select } from "./ui";

export function BookingForm({
  properties,
  platforms,
  editing,
  onSubmit,
  onCancelEdit,
}: {
  properties: Property[];
  platforms: Platform[];
  editing?: Booking | null;
  onSubmit: (booking: Omit<Booking, "id">) => void;
  onCancelEdit?: () => void;
}) {
  const [description, setDescription] = useState(editing?.description ?? "");
  const [propertyId, setPropertyId] = useState(
    editing?.propertyId ?? properties[0]?.id ?? "",
  );
  const [platformId, setPlatformId] = useState(
    editing?.platformId ?? platforms[0]?.id ?? "",
  );
  const [checkIn, setCheckIn] = useState(editing?.checkIn ?? "2026-01-01");
  const [checkOut, setCheckOut] = useState(editing?.checkOut ?? "2026-01-05");
  const [grossIncome, setGrossIncome] = useState(
    editing ? String(editing.grossIncome) : "",
  );
  const [cleaningFee, setCleaningFee] = useState(
    editing ? String(editing.cleaningFee) : "0",
  );
  const [otaCommission, setOtaCommission] = useState(
    editing ? String(editing.otaCommission ?? 0) : "0",
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const previewNights = useMemo(() => {
    if (!checkIn || !checkOut) {
      return 0;
    }

    return getBookingNights({
      id: "preview",
      description,
      propertyId,
      platformId,
      checkIn,
      checkOut,
      grossIncome: 0,
      cleaningFee: 0,
      otaCommission: 0,
    });
  }, [checkIn, checkOut, description, platformId, propertyId]);

  const previewVat = useMemo(() => {
    const income = Number(grossIncome || 0);

    if (!Number.isFinite(income) || income <= 0 || isVatExemptPlatform(platformId)) {
      return 0;
    }

    return calculateBookingVat({
      id: "preview",
      description,
      propertyId,
      platformId,
      checkIn,
      checkOut,
      grossIncome: income,
      cleaningFee: 0,
      otaCommission: 0,
    });
  }, [
    checkIn,
    checkOut,
    description,
    grossIncome,
    platformId,
    propertyId,
  ]);

  const platformHint = useMemo(() => {
    if (isVatExemptPlatform(platformId)) {
      return "Prenotazione diretta: nessuno scorporo IVA (importo già esente). Le pulizie check-in vengono comunque registrate automaticamente se configurate sull'appartamento. Puoi inserirla manualmente anche se nello stesso mese hai importato Booking o Airbnb.";
    }

    const ratePercent = Math.round(getBookingVatRate(platformId) * 100);

    if (ratePercent > 0) {
      return `Per ${platformId === "airbnb" ? "Airbnb" : "Booking"}, l'IVA al ${ratePercent}% viene scorporata dal lordo (lordo ÷ ${1 + ratePercent / 100}) e registrata in Spese. Inserisci la commissione OTA se presente: viene registrata come spesa collegata.`;
    }

    return "Inserisci la commissione OTA se presente: viene registrata come spesa collegata.";
  }, [platformId]);

  const previewNetIncome = useMemo(() => {
    const income = Number(grossIncome || 0);
    const commission = Number(otaCommission || 0);

    if (!Number.isFinite(income) || !Number.isFinite(commission)) {
      return 0;
    }

    return getBookingNetIncome({
      id: "preview",
      description,
      propertyId,
      platformId,
      checkIn,
      checkOut,
      grossIncome: income,
      cleaningFee: 0,
      otaCommission: commission,
    });
  }, [
    checkIn,
    checkOut,
    description,
    grossIncome,
    otaCommission,
    platformId,
    propertyId,
  ]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const income = Number(grossIncome);
    const cleaning = Number(cleaningFee || 0);
    const commission = Number(otaCommission || 0);

    if (!description.trim() || !propertyId || !platformId || !checkIn || !checkOut) {
      return;
    }

    if (!Number.isFinite(income) || income < 0) {
      return;
    }

    if (!Number.isFinite(commission) || commission < 0) {
      return;
    }

    if (checkOut <= checkIn) {
      return;
    }

    onSubmit({
      description: description.trim(),
      propertyId,
      platformId,
      checkIn,
      checkOut,
      grossIncome: income,
      cleaningFee: cleaning,
      otaCommission: commission,
      notes: notes.trim() || undefined,
    });

    if (!editing) {
      setDescription("");
      setGrossIncome("");
      setCleaningFee("0");
      setOtaCommission("0");
      setNotes("");
    }
  }

  if (properties.length === 0 || platforms.length === 0) {
    return (
      <Card title="Prenotazione">
        <p className="text-sm text-rc-muted">
          Configura almeno un appartamento e una piattaforma in Impostazioni.
        </p>
      </Card>
    );
  }

  return (
    <Card title={editing ? "Modifica prenotazione" : "Nuova prenotazione"}>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <Field label="Riferimento prenotazione">
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Es. Totale booking marzo"
            required
          />
        </Field>

        <Field label="Proprietà">
          <Select
            value={propertyId || properties[0].id}
            onChange={(event) => setPropertyId(event.target.value)}
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Piattaforma">
          <Select
            value={platformId || platforms[0].id}
            onChange={(event) => setPlatformId(event.target.value)}
          >
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Check-in">
          <Input
            type="date"
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
            required
          />
        </Field>

        <Field label="Check-out">
          <Input
            type="date"
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
            required
          />
        </Field>

        <Field label="Notti calcolate">
          <Input value={`${previewNights} notti`} readOnly />
        </Field>

        <Field label="Incasso lordo (€)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={grossIncome}
            onChange={(event) => setGrossIncome(event.target.value)}
            placeholder="0.00"
            required
          />
        </Field>

        <Field label="Pulizie (€)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={cleaningFee}
            onChange={(event) => setCleaningFee(event.target.value)}
          />
        </Field>

        <Field label="Commissione OTA (€)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={otaCommission}
            onChange={(event) => setOtaCommission(event.target.value)}
            placeholder="Importo commissione piattaforma"
          />
        </Field>

        <Field label="Netto dopo commissione">
          <Input
            value={formatCurrency(previewNetIncome)}
            readOnly
          />
        </Field>

        {previewVat > 0 ? (
          <Field label="IVA scorporo (stima)">
            <Input value={formatCurrency(previewVat)} readOnly />
          </Field>
        ) : null}

        <p className="text-xs text-rc-muted md:col-span-2">{platformHint}</p>

        <Field label="Note">
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Opzionale"
          />
        </Field>

        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit">
            {editing ? "Salva modifiche" : "Aggiungi prenotazione"}
          </Button>
          {editing && onCancelEdit ? (
            <Button type="button" variant="secondary" onClick={onCancelEdit}>
              Annulla
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
