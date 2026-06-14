"use client";

import { useRef, useState } from "react";
import { formatCurrency } from "@/lib/calculations";
import { DEFAULT_AIRBNB_COMMISSION_RATE } from "@/lib/constants";
import { downloadBackup } from "@/lib/backup";
import {
  FISCAL_YEAR,
  MAX_EXPENSE_CATEGORIES,
  MAX_PLATFORMS,
  MAX_PROPERTIES,
  MONTH_LABELS,
} from "@/lib/constants";
import type { PurgeScope, PurgePreview } from "@/lib/purge";
import { countPropertyLinkedTransactions } from "@/lib/property-removal";
import type {
  Booking,
  DashboardData,
  Expense,
  ExpenseCategory,
  Platform,
  Property,
} from "@/lib/types";
import { AutomationPanel } from "../AutomationPanel";
import { AirbnbImportPanel } from "../AirbnbImportPanel";
import { BookingImportPanel } from "../BookingImportPanel";
import { DataPurgePanel } from "../DataPurgePanel";
import { ReportsPanel } from "../ReportsPanel";
import { Button, Card, Field, Input } from "../ui";

export function SettingsView({
  data,
  bookings,
  expenses,
  profitTargets,
  properties,
  platforms,
  expenseCategories,
  onAddProperty,
  onUpdateProperty,
  onRemoveProperty,
  onAddPlatform,
  onUpdatePlatform,
  onRemovePlatform,
  onAddExpenseCategory,
  onUpdateExpenseCategory,
  onRemoveExpenseCategory,
  onUpdateProfitTarget,
  onImportBackup,
  onClearTransactions,
  onUpdateAutomation,
  onUpdatePropertyAutomation,
  onSyncAutomatedExpenses,
  onImportBookingCom,
  onImportAirbnb,
}: {
  data: DashboardData;
  bookings: Booking[];
  expenses: Expense[];
  profitTargets: number[];
  properties: Property[];
  platforms: Platform[];
  expenseCategories: ExpenseCategory[];
  onAddProperty: (name: string, monthlyRent: number) => string | null;
  onUpdateProperty: (
    id: string,
    name: string,
    monthlyRent: number,
    airbnbCommissionRate?: number,
  ) => string | null;
  onRemoveProperty: (id: string) => string | null;
  onAddPlatform: (name: string) => string | null;
  onUpdatePlatform: (id: string, name: string) => string | null;
  onRemovePlatform: (id: string) => string | null;
  onAddExpenseCategory: (name: string) => string | null;
  onUpdateExpenseCategory: (id: string, name: string) => string | null;
  onRemoveExpenseCategory: (id: string) => string | null;
  onUpdateProfitTarget: (month: number, value: number) => void;
  onImportBackup: (raw: string) => string | null;
  onClearTransactions: (scope: PurgeScope) => PurgePreview;
  onUpdateAutomation: (
    settings: import("@/lib/types").AutomationSettings,
  ) => void;
  onUpdatePropertyAutomation: (
    propertyId: string,
    cleaningCostPerCheckIn: number,
    krossBookingMonthly: number,
  ) => void;
  onSyncAutomatedExpenses: () => import("@/lib/automation").AutomationPreview;
  onImportBookingCom: (
    propertyId: string,
    file: File,
  ) => Promise<
    import("@/lib/ota-import/booking-com").BookingComSyncPreview | {
      error: string;
    }
  >;
  onImportAirbnb: (
    propertyId: string,
    file: File,
    year: number,
    month: number,
  ) => Promise<
    import("@/lib/ota-import/airbnb").AirbnbSyncPreview | { error: string }
  >;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyRent, setNewPropertyRent] = useState("");
  const [newPlatformName, setNewPlatformName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  function showResult(error: string | null, success: string) {
    setMessage(error ?? success);
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className="rounded-xl border border-rc-gold/25 bg-rc-charcoal px-4 py-3 text-sm text-rc-ink">
          {message}
        </div>
      ) : null}

      <Card title="Configurazione dinamica">
        <p className="text-sm text-rc-muted">
          Personalizza appartamenti, piattaforme di prenotazione e categorie di
          spesa. Le modifiche sono subito disponibili in tutta la dashboard.
        </p>
      </Card>

      <Card title={`Obiettivi profitto mensili FY${FISCAL_YEAR}`}>
        <p className="mb-4 text-sm text-rc-muted">
          Imposta il profitto atteso per ogni mese. Panoramica e vista Mensile
          mostreranno il confronto obiettivo vs reale.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {MONTH_LABELS.map((label, index) => (
            <Field key={label} label={label}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={profitTargets[index] || ""}
                onChange={(event) =>
                  onUpdateProfitTarget(
                    index + 1,
                    Number(event.target.value || 0),
                  )
                }
                placeholder="0.00"
              />
            </Field>
          ))}
        </div>
        <p className="mt-4 text-sm text-rc-muted">
          Totale annuo:{" "}
          <span className="font-semibold text-rc-gold-dark">
            {formatCurrency(profitTargets.reduce((sum, value) => sum + value, 0))}
          </span>
        </p>
      </Card>

      <BookingImportPanel
        properties={properties}
        otaImportSnapshots={data.otaImportSnapshots}
        onImportBookingCom={onImportBookingCom}
        onMessage={(text) => showResult(null, text)}
      />

      <AirbnbImportPanel
        properties={properties}
        otaImportSnapshots={data.otaImportSnapshots}
        onImportAirbnb={onImportAirbnb}
        onMessage={(text) => showResult(null, text)}
      />

      <AutomationPanel
        data={data}
        bookings={bookings}
        properties={properties}
        onUpdateAutomation={onUpdateAutomation}
        onUpdatePropertyAutomation={(propertyId, cleaningCost, krossMonthly) => {
          onUpdatePropertyAutomation(propertyId, cleaningCost, krossMonthly);
          showResult(null, "Configurazione appartamento aggiornata.");
        }}
        onSyncAutomatedExpenses={onSyncAutomatedExpenses}
        onMessage={(text) => showResult(null, text)}
      />

      <ReportsPanel
        bookings={bookings}
        expenses={expenses}
        properties={properties}
        platforms={platforms}
        expenseCategories={expenseCategories}
        profitTargets={profitTargets}
        onMessage={(text) => showResult(null, text)}
      />

      <DataPurgePanel
        bookings={bookings}
        expenses={expenses}
        properties={properties}
        onPurge={onClearTransactions}
        onSuccess={(removed) => {
          const parts: string[] = [];
          if (removed.bookings > 0) {
            parts.push(`${removed.bookings} prenotazioni`);
          }
          if (removed.expenses > 0) {
            parts.push(`${removed.expenses} spese`);
          }
          showResult(null, `Rimosse ${parts.join(" e ")}.`);
        }}
      />

      <Card title="Backup e ripristino">
        <p className="mb-4 text-sm text-rc-muted">
          Esporta tutti i dati (prenotazioni, spese, configurazione) in un file
          JSON. Puoi reimportarlo in un altro browser o dopo un reset.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadBackup(data)}>
            Esporta backup JSON
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Importa backup JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }

              const reader = new FileReader();
              reader.onload = () => {
                const raw = reader.result;
                if (typeof raw !== "string") {
                  showResult("Il file non è leggibile.", "");
                  return;
                }

                const error = onImportBackup(raw);
                showResult(
                  error,
                  "Backup importato correttamente. I dati sono stati sostituiti.",
                );
              };
              reader.readAsText(file);
              event.target.value = "";
            }}
          />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={`Appartamenti (${properties.length}/${MAX_PROPERTIES})`}>
          <form
            className="mb-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const error = onAddProperty(
                newPropertyName,
                Number(newPropertyRent || 0),
              );
              if (!error) {
                setNewPropertyName("");
                setNewPropertyRent("");
              }
              showResult(error, "Appartamento aggiunto.");
            }}
          >
            <Field label="Nuovo appartamento">
              <Input
                value={newPropertyName}
                onChange={(event) => setNewPropertyName(event.target.value)}
                placeholder="Es. Via Nazionale 12"
                required
              />
            </Field>
            <Field label="Affitto mensile">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newPropertyRent}
                onChange={(event) => setNewPropertyRent(event.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Button type="submit">Aggiungi appartamento</Button>
          </form>

          <div className="space-y-3">
            {properties.map((property) => (
              <PropertyRow
                key={`${property.id}-${property.name}-${property.monthlyRent}`}
                property={property}
                onSave={(name, monthlyRent, airbnbCommissionRate) => {
                  const error = onUpdateProperty(
                    property.id,
                    name,
                    monthlyRent,
                    airbnbCommissionRate,
                  );
                  showResult(error, "Appartamento aggiornato.");
                }}
                onRemove={() => {
                  const linked = countPropertyLinkedTransactions(data, property.id);
                  const hasLinked =
                    linked.bookings > 0 || linked.expenses > 0;

                  if (
                    hasLinked &&
                    !window.confirm(
                      `Eliminare "${property.name}" e anche ${linked.bookings} prenotazioni e ${linked.expenses} spese collegate?`,
                    )
                  ) {
                    return;
                  }

                  const error = onRemoveProperty(property.id);
                  showResult(
                    error,
                    hasLinked
                      ? "Appartamento e movimenti collegati eliminati."
                      : "Appartamento eliminato.",
                  );
                }}
              />
            ))}
          </div>
        </Card>

        <Card title={`Piattaforme (${platforms.length}/${MAX_PLATFORMS})`}>
          <form
            className="mb-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const error = onAddPlatform(newPlatformName);
              if (!error) {
                setNewPlatformName("");
              }
              showResult(error, "Piattaforma aggiunta.");
            }}
          >
            <Field label="Nuova piattaforma">
              <Input
                value={newPlatformName}
                onChange={(event) => setNewPlatformName(event.target.value)}
                placeholder="Es. Expedia, Sito web, Agente locale"
                required
              />
            </Field>
            <Button type="submit">Aggiungi piattaforma</Button>
          </form>

          <div className="space-y-3">
            {platforms.map((platform) => (
              <NameRow
                key={`${platform.id}-${platform.name}`}
                name={platform.name}
                onSave={(name) => {
                  const error = onUpdatePlatform(platform.id, name);
                  showResult(error, "Piattaforma aggiornata.");
                }}
                onRemove={() => {
                  const error = onRemovePlatform(platform.id);
                  showResult(error, "Piattaforma eliminata.");
                }}
              />
            ))}
          </div>
        </Card>

        <Card
          title={`Categorie spesa (${expenseCategories.length}/${MAX_EXPENSE_CATEGORIES})`}
        >
          <form
            className="mb-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const error = onAddExpenseCategory(newCategoryName);
              if (!error) {
                setNewCategoryName("");
              }
              showResult(error, "Categoria aggiunta.");
            }}
          >
            <Field label="Nuova categoria">
              <Input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Es. Marketing, Software, Tasse"
                required
              />
            </Field>
            <Button type="submit">Aggiungi categoria</Button>
          </form>

          <div className="space-y-3">
            {expenseCategories.map((category) => (
              <NameRow
                key={`${category.id}-${category.name}`}
                name={category.name}
                onSave={(name) => {
                  const error = onUpdateExpenseCategory(category.id, name);
                  showResult(error, "Categoria aggiornata.");
                }}
                onRemove={() => {
                  const error = onRemoveExpenseCategory(category.id);
                  showResult(error, "Categoria eliminata.");
                }}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PropertyRow({
  property,
  onSave,
  onRemove,
}: {
  property: Property;
  onSave: (
    name: string,
    monthlyRent: number,
    airbnbCommissionRate: number,
  ) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(property.name);
  const [monthlyRent, setMonthlyRent] = useState(String(property.monthlyRent));
  const [airbnbCommissionPercent, setAirbnbCommissionPercent] = useState(
    String(
      (property.airbnbCommissionRate ?? DEFAULT_AIRBNB_COMMISSION_RATE) * 100,
    ),
  );

  return (
    <div className="space-y-2 rounded-xl border border-rc-gold/20 bg-rc-charcoal/70 p-3">
      <Input value={name} onChange={(event) => setName(event.target.value)} />
      <Input
        type="number"
        min="0"
        step="0.01"
        value={monthlyRent}
        onChange={(event) => setMonthlyRent(event.target.value)}
      />
      <Field label="Commissione Airbnb (%)">
        <Input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={airbnbCommissionPercent}
          onChange={(event) => setAirbnbCommissionPercent(event.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            onSave(
              name,
              Number(monthlyRent || 0),
              Number(airbnbCommissionPercent || 0) / 100,
            )
          }
        >
          Salva
        </Button>
        <Button variant="danger" onClick={onRemove}>
          Elimina
        </Button>
      </div>
      <p className="text-xs text-rc-muted">
        Affitto: {formatCurrency(Number(monthlyRent || 0))} / mese · Airbnb{" "}
        {airbnbCommissionPercent}% + IVA 22%
      </p>
    </div>
  );
}

function NameRow({
  name: initialName,
  onSave,
  onRemove,
}: {
  name: string;
  onSave: (name: string) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(initialName);

  return (
    <div className="space-y-2 rounded-xl border border-rc-gold/20 bg-rc-charcoal/70 p-3">
      <Input value={name} onChange={(event) => setName(event.target.value)} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => onSave(name)}>
          Salva
        </Button>
        <Button variant="danger" onClick={onRemove}>
          Elimina
        </Button>
      </div>
    </div>
  );
}
