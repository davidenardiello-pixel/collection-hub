"use client";

import { useMemo } from "react";
import {
  countPropertyCheckIns,
  getAutomationPreview,
  type AutomationPreview,
} from "@/lib/automation";
import { formatCurrency } from "@/lib/calculations";
import { FISCAL_YEAR } from "@/lib/constants";
import type {
  AutomationSettings,
  Booking,
  DashboardData,
  Property,
} from "@/lib/types";
import { Button, Card, Field, Input } from "./ui";

export function AutomationPanel({
  data,
  bookings,
  properties,
  onUpdateAutomation,
  onUpdatePropertyAutomation,
  onSyncAutomatedExpenses,
  onMessage,
}: {
  data: DashboardData;
  bookings: Booking[];
  properties: Property[];
  onUpdateAutomation: (settings: AutomationSettings) => void;
  onUpdatePropertyAutomation: (
    propertyId: string,
    cleaningCostPerCheckIn: number,
    krossBookingMonthly: number,
  ) => void;
  onSyncAutomatedExpenses: () => AutomationPreview;
  onMessage?: (text: string) => void;
}) {
  const automation = data.automation;
  const preview = useMemo(() => getAutomationPreview(data), [data]);

  function handleSync() {
    const result = onSyncAutomatedExpenses();
    const parts: string[] = [];

    if (result.removedAutomated > 0) {
      parts.push(`${result.removedAutomated} spese automatiche sostituite`);
    }

    const created =
      result.rentEntries + result.krossEntries + result.cleaningEntries;

    if (created > 0) {
      parts.push(`${created} nuove voci generate`);
    } else {
      parts.push("nessuna nuova voce da generare con le impostazioni attuali");
    }

    onMessage?.(`Sincronizzazione completata: ${parts.join(" · ")}.`);
  }

  return (
    <Card title="Spese automatizzate">
      <p className="mb-4 text-sm text-rc-muted">
        Configura affitto, KrossBooking e pulizie per appartamento. Ogni
        prenotazione importata (non Excel) genera una spesa pulizie collegata
        pari al costo check-in impostato, nel mese del check-in. Usa
        &quot;Genera / aggiorna&quot; anche per applicare le pulizie ai check-in
        già caricati dopo aver impostato o modificato il costo.
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <AutomationToggle
          label="Affitto mensile"
          description="Solo sul mese corrente (non pregresso né futuro)."
          checked={automation.autoRent}
          onChange={(checked) =>
            onUpdateAutomation({ ...automation, autoRent: checked })
          }
        />
        <AutomationToggle
          label="KrossBooking"
          description="Solo sul mese corrente (non pregresso né futuro)."
          checked={automation.autoKrossBooking}
          onChange={(checked) =>
            onUpdateAutomation({ ...automation, autoKrossBooking: checked })
          }
        />
        <AutomationToggle
          label="Pulizie"
          description="Sempre attive per prenotazione se il costo check-in è impostato."
          checked={automation.autoCleaning}
          onChange={(checked) =>
            onUpdateAutomation({ ...automation, autoCleaning: checked })
          }
        />
      </div>

      <div className="space-y-4">
        {properties.map((property) => (
          <PropertyAutomationRow
            key={property.id}
            property={property}
            checkInsYtd={countPropertyCheckIns(bookings, property.id)}
            onSave={(cleaningCostPerCheckIn, krossBookingMonthly) =>
              onUpdatePropertyAutomation(
                property.id,
                cleaningCostPerCheckIn,
                krossBookingMonthly,
              )
            }
          />
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-rc-gold/20 bg-rc-charcoal/40 p-4 text-sm">
        <p className="font-semibold text-rc-gold-light">Anteprima sincronizzazione</p>
        <ul className="mt-3 space-y-1 text-rc-muted">
          <PreviewLine
            enabled={automation.autoRent}
            label="Affitti"
            count={preview.rentEntries}
            total={preview.rentTotal}
          />
          <PreviewLine
            enabled={automation.autoKrossBooking}
            label="KrossBooking"
            count={preview.krossEntries}
            total={preview.krossTotal}
          />
          <PreviewLine
            enabled={automation.autoCleaning}
            label="Pulizie"
            count={preview.cleaningEntries}
            total={preview.cleaningTotal}
            extra={
              preview.cleaningCheckIns > 0
                ? `${preview.cleaningCheckIns} check-in`
                : undefined
            }
          />
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={handleSync}>Genera / aggiorna spese automatiche</Button>
      </div>

      <p className="mt-3 text-xs text-rc-muted">
        Affitto e KrossBooking si generano solo nel mese corrente: il pregresso
        resta quello del file rendita e i mesi futuri non vengono anticipati.
        Le pulizie automatiche seguono invece i check-in dei mesi già
        trascorsi. A ogni sincronizzazione le voci Auto vengono ricalcolate;
        le spese manuali restano invariate. FY{FISCAL_YEAR}.
      </p>
    </Card>
  );
}

function AutomationToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border border-rc-gold/20 bg-rc-charcoal/50 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 accent-rc-gold"
      />
      <span>
        <span className="block font-medium text-rc-ink">{label}</span>
        <span className="mt-1 block text-xs text-rc-muted">{description}</span>
      </span>
    </label>
  );
}

function PropertyAutomationRow({
  property,
  checkInsYtd,
  onSave,
}: {
  property: Property;
  checkInsYtd: number;
  onSave: (cleaningCostPerCheckIn: number, krossBookingMonthly: number) => void;
}) {
  return (
    <div className="rounded-xl border border-rc-gold/20 bg-rc-charcoal/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-rc-gold-light">{property.name}</p>
        <p className="text-xs text-rc-muted">
          Affitto: {formatCurrency(property.monthlyRent)}/mese · {checkInsYtd}{" "}
          check-in FY{FISCAL_YEAR}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Costo pulizia per check-in">
          <Input
            type="number"
            min="0"
            step="0.01"
            defaultValue={String(property.cleaningCostPerCheckIn)}
            key={`cleaning-${property.id}-${property.cleaningCostPerCheckIn}`}
            onBlur={(event) => {
              const cleaningCostPerCheckIn = Number(event.target.value || 0);
              onSave(cleaningCostPerCheckIn, property.krossBookingMonthly);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
        </Field>
        <Field label="KrossBooking mensile">
          <Input
            type="number"
            min="0"
            step="0.01"
            defaultValue={String(property.krossBookingMonthly)}
            key={`kross-${property.id}-${property.krossBookingMonthly}`}
            onBlur={(event) => {
              const krossBookingMonthly = Number(event.target.value || 0);
              onSave(property.cleaningCostPerCheckIn, krossBookingMonthly);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
        </Field>
      </div>
    </div>
  );
}

function PreviewLine({
  enabled,
  label,
  count,
  total,
  extra,
}: {
  enabled: boolean;
  label: string;
  count: number;
  total: number;
  extra?: string;
}) {
  if (!enabled) {
    return <li>{label}: disattivato</li>;
  }

  return (
    <li>
      {label}: {count} voci · {formatCurrency(total)}
      {extra ? ` · ${extra}` : ""}
    </li>
  );
}
