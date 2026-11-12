"use client";

import { useMemo } from "react";
import {
  countPropertyCheckIns,
  getAutomationPreview,
  type AutomationPreview,
} from "@/lib/automation";
import {
  listCleaningForecastByPropertyMonth,
} from "@/lib/booking-cleaning";
import { formatCurrency } from "@/lib/calculations";
import { FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import type {
  AutomationSettings,
  Booking,
  DashboardData,
  MonthPeriod,
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
  onDismissCleaningForecast,
  onRestoreCleaningForecast,
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
  onDismissCleaningForecast: (propertyId: string, period: MonthPeriod) => void;
  onRestoreCleaningForecast: (propertyId: string, period: MonthPeriod) => void;
  onMessage?: (text: string) => void;
}) {
  const automation = data.automation;
  const preview = useMemo(() => getAutomationPreview(data), [data]);
  const cleaningForecastRows = useMemo(
    () => listCleaningForecastByPropertyMonth(data),
    [data],
  );

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
          description="Una voce per ogni mese trascorso nell'anno (resta lo storico)."
          checked={automation.autoRent}
          onChange={(checked) =>
            onUpdateAutomation({ ...automation, autoRent: checked })
          }
        />
        <AutomationToggle
          label="KrossBooking"
          description="Una voce per ogni mese trascorso nell'anno (resta lo storico)."
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

      <div className="mt-8 rounded-xl border border-rc-gold/25 bg-rc-charcoal/50 p-4">
        <p className="font-semibold text-rc-gold-light">
          Pulizie check-in (forecast) per mese e appartamento
        </p>
        <p className="mt-2 text-sm text-rc-muted">
          Le voci automatiche collegate alle prenotazioni sono un forecast: a fine
          mese puoi annullarle in blocco e registrare in Spese i costi reali
          (pulizie extra, prodotti, ecc.) senza toccare le prenotazioni.
          L&apos;annullamento impedisce che si rigenerino con
          &quot;Genera / aggiorna&quot;.
        </p>

        {cleaningForecastRows.length === 0 ? (
          <p className="mt-4 text-sm text-rc-muted">
            Nessun check-in con pulizie automatiche in FY{FISCAL_YEAR}.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-rc-gold/20 text-xs uppercase text-rc-muted">
                  <th className="px-2 py-2">Mese</th>
                  <th className="px-2 py-2">Appartamento</th>
                  <th className="px-2 py-2 text-center">Check-in</th>
                  <th className="px-2 py-2 text-center">Voci auto</th>
                  <th className="px-2 py-2 text-right">Totale</th>
                  <th className="px-2 py-2">Stato</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {cleaningForecastRows.map((row) => {
                  const period: MonthPeriod = {
                    year: row.year,
                    month: row.month,
                  };
                  return (
                    <tr
                      key={`${row.propertyId}-${row.month}`}
                      className="border-b border-rc-gold/10"
                    >
                      <td className="px-2 py-2">
                        {MONTH_LABELS[row.month - 1]}
                      </td>
                      <td className="px-2 py-2">{row.propertyName}</td>
                      <td className="px-2 py-2 text-center">
                        {row.checkInCount}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {row.linkedCleaningCount}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {formatCurrency(row.linkedCleaningTotal)}
                      </td>
                      <td className="px-2 py-2 text-xs text-rc-muted">
                        {row.suppressed ? "Forecast annullato" : "Attivo"}
                      </td>
                      <td className="px-2 py-2">
                        {row.suppressed ? (
                          <Button
                            variant="secondary"
                            className="text-xs"
                            onClick={() => {
                              onRestoreCleaningForecast(row.propertyId, period);
                              onMessage?.(
                                `Forecast pulizie ripristinato — ${row.propertyName}, ${MONTH_LABELS[row.month - 1]}.`,
                              );
                            }}
                          >
                            Rigenera forecast
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            className="text-xs"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Annullare le pulizie automatiche (forecast) per ${row.propertyName} in ${MONTH_LABELS[row.month - 1]}? Le prenotazioni restano invariate.`,
                                )
                              ) {
                                return;
                              }
                              onDismissCleaningForecast(row.propertyId, period);
                              onMessage?.(
                                `Forecast pulizie annullato — ${row.propertyName}, ${MONTH_LABELS[row.month - 1]}. Aggiungi i costi reali in Spese.`,
                              );
                            }}
                          >
                            Annulla forecast
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-rc-muted">
        Affitto e KrossBooking si generano per ogni mese già trascorso
        nell&apos;anno fiscale (ottobre resta visibile anche a novembre); i mesi
        futuri non vengono anticipati. Se in un mese hai già una spesa manuale
        Affitto/Kross, l&apos;automatica non viene duplicata. Le pulizie
        automatiche seguono i check-in. A ogni sincronizzazione le voci Auto
        vengono ricalcolate; le spese manuali restano invariate. FY
        {FISCAL_YEAR}.
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
