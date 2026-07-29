"use client";

import { Fragment, useMemo, useState } from "react";
import {
  formatCurrency,
  formatDate,
  getBookingTotal,
} from "@/lib/calculations";
import { getBankAccountLabel, getPropertyBankAccount } from "@/lib/bank-accounts";
import { BANK_ACCOUNT_OPTIONS, FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import {
  applyExpectedPayoutFields,
  buildPayoutReconciliation,
  getBookingNetBankDeposit,
  type PayoutBatchStatus,
} from "@/lib/ota-payout";
import { getPropertyCityLabel, normalizePropertyCity } from "@/lib/property-cities";
import { convertParsedLinesToPayouts } from "@/lib/bank-reconciliation";
import { parseBankStatementCsv } from "@/lib/bank-statement-import";
import {
  getBankInstitutionLabel,
  getInstitutionsForAccount,
} from "@/lib/bank-ledger";
import type {
  BankAccountId,
  BankInstitutionId,
  BankPayoutReceived,
  Booking,
  Platform,
  Property,
} from "@/lib/types";
import { Button, Card, DataRow, DataTable, Money, TabPill } from "../ui";

function statusLabel(status: PayoutBatchStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "difference":
      return "Differenza";
    case "missing":
      return "Mancante";
    default:
      return "In attesa";
  }
}

function statusClass(status: PayoutBatchStatus): string {
  switch (status) {
    case "ok":
      return "text-emerald-400";
    case "difference":
      return "text-amber-400";
    case "missing":
      return "text-rose-400";
    default:
      return "text-rc-muted";
  }
}

export function PayoutsView({
  bookings,
  properties,
  platforms,
  bankPayouts,
  onAddBankPayout,
  onRemoveBankPayout,
  onImportBankPayouts,
}: {
  bookings: Booking[];
  properties: Property[];
  platforms: Platform[];
  bankPayouts: BankPayoutReceived[];
  onAddBankPayout: (payout: Omit<BankPayoutReceived, "id">) => void;
  onRemoveBankPayout: (id: string) => void;
  onImportBankPayouts: (
    payouts: Omit<BankPayoutReceived, "id">[],
  ) => { added: number; skipped: number };
}) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [importAccountId, setImportAccountId] = useState<BankAccountId>("dsep");
  const [importInstitution, setImportInstitution] =
    useState<BankInstitutionId>("finom");
  const [importPreview, setImportPreview] = useState<
    Omit<BankPayoutReceived, "id">[] | null
  >(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const institutionOptions = useMemo(
    () => getInstitutionsForAccount(importAccountId),
    [importAccountId],
  );
  const [payoutForm, setPayoutForm] = useState({
    bankAccountId: BANK_ACCOUNT_OPTIONS[0].id as BankAccountId,
    bankInstitution: "finom" as BankInstitutionId,
    receivedDate: formatIsoToday(),
    amount: "",
    expectedPayoutBatch: "",
    reference: "",
    notes: "",
  });

  const propertyMap = Object.fromEntries(
    properties.map((property) => [property.id, property.name]),
  );
  const platformMap = Object.fromEntries(
    platforms.map((platform) => [platform.id, platform.name]),
  );

  const reconciliation = useMemo(
    () =>
      buildPayoutReconciliation(
        bookings,
        properties,
        platforms,
        bankPayouts,
        { year: FISCAL_YEAR, month: selectedMonth },
      ),
    [bankPayouts, bookings, platforms, properties, selectedMonth],
  );

  const monthBookings = useMemo(() => {
    return bookings
      .map(applyExpectedPayoutFields)
      .filter((booking) => {
        if (!booking.expectedPayoutDate) {
          return false;
        }
        const date = new Date(booking.expectedPayoutDate);
        return (
          date.getFullYear() === FISCAL_YEAR &&
          date.getMonth() + 1 === selectedMonth
        );
      })
      .sort((left, right) =>
        (left.expectedPayoutDate ?? "").localeCompare(
          right.expectedPayoutDate ?? "",
        ),
      );
  }, [bookings, selectedMonth]);

  return (
    <div className="space-y-6">
      <Card title="Gestione incassi OTA e riconciliazione">
        <p className="mb-4 text-sm text-rc-muted">
          Per ogni prenotazione calcoliamo{" "}
          <strong className="text-rc-ink">Expected Payout Date</strong> e{" "}
          <strong className="text-rc-ink">Batch</strong>: Booking.com dal
          check-out (bonifico il giovedì successivo alla settimana gio–mer);
          Airbnb e Vrbo dal giorno lavorativo dopo il check-in. Registra i
          bonifici ricevuti per confrontare importi attesi e incassati.
        </p>
        <div className="flex flex-wrap gap-2">
          {MONTH_LABELS.map((label, index) => (
            <TabPill
              key={label}
              active={selectedMonth === index + 1}
              onClick={() => setSelectedMonth(index + 1)}
            >
              {label}
            </TabPill>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Batch attesi">
          <p className="text-2xl font-semibold text-rc-gold-light">
            {reconciliation.batches.length}
          </p>
        </Card>
        <Card title="Mancanti">
          <p className="text-2xl font-semibold text-rose-400">
            {reconciliation.missingBatchCount}
          </p>
        </Card>
        <Card title="Con differenza">
          <p className="text-2xl font-semibold text-amber-400">
            {reconciliation.differenceBatchCount}
          </p>
        </Card>
        <Card title="Bonifici non abbinati">
          <p className="text-2xl font-semibold text-rc-ink">
            {formatCurrency(reconciliation.unmatchedReceivedTotal)}
          </p>
        </Card>
      </div>

      <Card title={`Bonifici attesi per batch — ${MONTH_LABELS[selectedMonth - 1]} ${FISCAL_YEAR}`}>
        {reconciliation.batches.length === 0 ? (
          <p className="text-sm text-rc-muted">
            Nessun accredito OTA atteso in questo mese (Booking, Airbnb, Vrbo).
          </p>
        ) : (
          <DataTable
            headers={[
              "Stato",
              "OTA",
              "Data attesa",
              "Batch",
              "Conto/i",
              "Prenot.",
              "Lordo",
              "Commissioni",
              "Netto atteso",
              "Ricevuto",
              "Diff.",
              "",
            ]}
          >
            {reconciliation.batches.map((batch) => (
              <Fragment key={batch.batchId}>
                <DataRow>
                  <td
                    className={`px-2 py-2 text-sm font-semibold ${statusClass(batch.status)}`}
                  >
                    {statusLabel(batch.status)}
                  </td>
                  <td className="px-2 py-2">{batch.platformName}</td>
                  <td className="px-2 py-2 text-sm">
                    {formatDate(batch.expectedPayoutDate)}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-rc-muted">
                    {batch.batchId}
                  </td>
                  <td className="px-2 py-2 text-sm text-rc-muted">
                    {batch.bankAccountLabels.join(" · ")}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {batch.bookingCount}
                  </td>
                  <td className="px-2 py-2">
                    <Money value={batch.grossTotal} />
                  </td>
                  <td className="px-2 py-2">
                    <Money value={batch.commissionTotal} />
                  </td>
                  <td className="px-2 py-2 font-medium">
                    <Money value={batch.netExpected} />
                  </td>
                  <td className="px-2 py-2">
                    <Money value={batch.receivedTotal} />
                  </td>
                  <td className="px-2 py-2">
                    <Money value={batch.difference} />
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      variant="secondary"
                      className="text-xs"
                      onClick={() =>
                        setExpandedBatch(
                          expandedBatch === batch.batchId
                            ? null
                            : batch.batchId,
                        )
                      }
                    >
                      {expandedBatch === batch.batchId ? "Chiudi" : "Dettaglio"}
                    </Button>
                  </td>
                </DataRow>
                {expandedBatch === batch.batchId ? (
                  <DataRow key={`${batch.batchId}-detail`}>
                    <td colSpan={12} className="bg-rc-charcoal/30 px-4 py-4">
                      <PayoutBatchBookingTable
                        batchBookings={batch.bookings}
                        propertyMap={propertyMap}
                      />
                    </td>
                  </DataRow>
                ) : null}
              </Fragment>
            ))}
          </DataTable>
        )}
      </Card>

      <Card title={`Dettaglio prenotazioni — ${MONTH_LABELS[selectedMonth - 1]}`}>
        {monthBookings.length === 0 ? (
          <p className="text-sm text-rc-muted">
            Nessuna prenotazione con accredito atteso in questo mese.
          </p>
        ) : (
          <DataTable
            headers={[
              "Ospite / rif.",
              "Appartamento",
              "OTA",
              "Check-in",
              "Check-out",
              "Conto",
              "Lordo",
              "Comm.",
              "Netto",
              "Data attesa",
              "Batch",
            ]}
          >
            {monthBookings.map((booking) => (
              <DataRow key={booking.id}>
                <td className="px-2 py-2 font-medium">{booking.description}</td>
                <td className="px-2 py-2 text-sm">
                  {propertyMap[booking.propertyId] ?? booking.propertyId}
                  <span className="ml-1 text-xs text-rc-muted">
                    (
                    {getPropertyCityLabel(
                      normalizePropertyCity(
                        properties.find((p) => p.id === booking.propertyId)
                          ?.city,
                      ),
                    )}
                    )
                  </span>
                </td>
                <td className="px-2 py-2 text-sm">
                  {platformMap[booking.platformId] ?? booking.platformId}
                </td>
                <td className="px-2 py-2 text-sm">
                  {formatDate(booking.checkIn)}
                </td>
                <td className="px-2 py-2 text-sm">
                  {formatDate(booking.checkOut)}
                </td>
                <td className="px-2 py-2 text-sm text-rc-muted">
                  {getBankAccountLabel(
                    getPropertyBankAccount(booking.propertyId, properties),
                  )}
                </td>
                <td className="px-2 py-2">
                  <Money value={getBookingTotal(booking)} />
                </td>
                <td className="px-2 py-2">
                  <Money value={booking.otaCommission} />
                </td>
                <td className="px-2 py-2">
                  <Money value={getBookingNetBankDeposit(booking)} />
                </td>
                <td className="px-2 py-2 text-sm">
                  {booking.expectedPayoutDate
                    ? formatDate(booking.expectedPayoutDate)
                    : "—"}
                </td>
                <td className="px-2 py-2 font-mono text-xs text-rc-muted">
                  {booking.expectedPayoutBatch ?? "—"}
                </td>
              </DataRow>
            ))}
          </DataTable>
        )}
      </Card>

      <Card title="Bonifici ricevuti (estratto conto)">
        <p className="mb-4 text-sm text-rc-muted">
          Importa CSV <strong className="text-rc-ink">Finom</strong> o{" "}
          <strong className="text-rc-ink">BPER</strong>. Indica prima il{" "}
          <strong className="text-rc-ink">conto dashboard</strong> (HSP / DSEP /
          D&D) e l&apos;<strong className="text-rc-ink">istituto</strong> del
          file: DSEP → Finom o BPER; HSP → BPER; D&D → Finom. Vengono importati
          solo accrediti OTA (Airbnb / Booking); il sistema prova ad abbinare
          ogni riga alle prenotazioni tramite ID OTA o importo/data.
        </p>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="text-rc-muted">Conto dashboard</span>
            <select
              className="mt-1 w-full rounded-lg border border-rc-gold/30 bg-rc-charcoal px-3 py-2"
              value={importAccountId}
              onChange={(event) => {
                const bankAccountId = event.target.value as BankAccountId;
                const allowed = getInstitutionsForAccount(bankAccountId);
                setImportAccountId(bankAccountId);
                setImportInstitution(allowed[0] ?? "finom");
                setImportPreview(null);
                setImportStatus(null);
              }}
            >
              {BANK_ACCOUNT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-rc-muted">Banca del file CSV</span>
            <select
              className="mt-1 w-full rounded-lg border border-rc-gold/30 bg-rc-charcoal px-3 py-2"
              value={importInstitution}
              onChange={(event) => {
                setImportInstitution(event.target.value as BankInstitutionId);
                setImportPreview(null);
                setImportStatus(null);
              }}
            >
              {institutionOptions.map((id) => (
                <option key={id} value={id}>
                  {getBankInstitutionLabel(id)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col justify-end text-sm">
            <span className="text-rc-muted">File estratto conto</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="mt-1 w-full text-sm text-rc-muted file:mr-3 file:rounded-lg file:border-0 file:bg-rc-gold/20 file:px-3 file:py-2 file:text-rc-ink"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) {
                  return;
                }
                void file.text().then((text) => {
                  const parsed = parseBankStatementCsv(text, {
                    bankAccountId: importAccountId,
                    bankInstitution: importInstitution,
                  });
                  if (parsed.lines.length === 0) {
                    setImportPreview(null);
                    setImportStatus(
                      "Nessun accredito OTA riconosciuto nel file. Controlla formato Finom/BPER e conto selezionato.",
                    );
                    return;
                  }
                  const rows = convertParsedLinesToPayouts(
                    parsed.lines,
                    bookings,
                    properties,
                    importAccountId,
                    importInstitution,
                  );
                  setImportPreview(rows);
                  setImportStatus(
                    `Trovati ${rows.length} accrediti OTA (${parsed.format.toUpperCase()}). Righe ignorate: ${parsed.skippedRows}.`,
                  );
                });
              }}
            />
          </label>
        </div>

        {importStatus ? (
          <p className="mb-4 text-sm text-rc-muted">{importStatus}</p>
        ) : null}

        {importPreview && importPreview.length > 0 ? (
          <div className="mb-6 space-y-3">
            <DataTable
              headers={[
                "Data",
                "Importo",
                "Canale",
                "Batch",
                "Match",
              ]}
            >
              {importPreview.slice(0, 12).map((row, index) => (
                <DataRow key={`${row.importFingerprint ?? index}`}>
                  <td className="px-2 py-2 text-sm">
                    {formatDate(row.receivedDate)}
                  </td>
                  <td className="px-2 py-2">
                    <Money value={row.amount} />
                  </td>
                  <td className="px-2 py-2 text-sm uppercase text-rc-muted">
                    {row.otaChannel ?? "—"}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {row.expectedPayoutBatch ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-xs text-rc-muted">
                    {row.matchReason ?? "—"}
                  </td>
                </DataRow>
              ))}
            </DataTable>
            {importPreview.length > 12 ? (
              <p className="text-xs text-rc-muted">
                Anteprima: prime 12 righe su {importPreview.length}.
              </p>
            ) : null}
            <Button
              onClick={() => {
                const result = onImportBankPayouts(importPreview);
                setImportPreview(null);
                setImportStatus(
                  `Import completato: ${result.added} aggiunti, ${result.skipped} duplicati ignorati.`,
                );
              }}
            >
              Conferma import ({importPreview.length} righe)
            </Button>
          </div>
        ) : null}

        <p className="mb-3 text-sm font-medium text-rc-gold-light">
          Inserimento manuale
        </p>
        <form
          className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const amount = Number(payoutForm.amount.replace(",", "."));
            if (!Number.isFinite(amount) || amount <= 0) {
              return;
            }
            onAddBankPayout({
              bankAccountId: payoutForm.bankAccountId,
              bankInstitution: payoutForm.bankInstitution,
              receivedDate: payoutForm.receivedDate,
              amount: Math.round(amount * 100) / 100,
              expectedPayoutBatch: payoutForm.expectedPayoutBatch.trim() || undefined,
              reference: payoutForm.reference.trim() || undefined,
              notes: payoutForm.notes.trim() || undefined,
              source: "manual",
            });
            setPayoutForm((current) => ({
              ...current,
              amount: "",
              expectedPayoutBatch: "",
              reference: "",
              notes: "",
            }));
          }}
        >
          <label className="text-sm">
            <span className="text-rc-muted">Conto dashboard</span>
            <select
              className="mt-1 w-full rounded-lg border border-rc-gold/30 bg-rc-charcoal px-3 py-2"
              value={payoutForm.bankAccountId}
              onChange={(event) => {
                const bankAccountId = event.target.value as BankAccountId;
                const allowed = getInstitutionsForAccount(bankAccountId);
                setPayoutForm((current) => ({
                  ...current,
                  bankAccountId,
                  bankInstitution: allowed.includes(current.bankInstitution)
                    ? current.bankInstitution
                    : (allowed[0] ?? "finom"),
                }));
              }}
            >
              {BANK_ACCOUNT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-rc-muted">Banca</span>
            <select
              className="mt-1 w-full rounded-lg border border-rc-gold/30 bg-rc-charcoal px-3 py-2"
              value={payoutForm.bankInstitution}
              onChange={(event) =>
                setPayoutForm((current) => ({
                  ...current,
                  bankInstitution: event.target.value as BankInstitutionId,
                }))
              }
            >
              {getInstitutionsForAccount(payoutForm.bankAccountId).map((id) => (
                <option key={id} value={id}>
                  {getBankInstitutionLabel(id)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-rc-muted">Data accredito</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-rc-gold/30 bg-rc-charcoal px-3 py-2"
              value={payoutForm.receivedDate}
              onChange={(event) =>
                setPayoutForm((current) => ({
                  ...current,
                  receivedDate: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-sm">
            <span className="text-rc-muted">Importo €</span>
            <input
              className="mt-1 w-full rounded-lg border border-rc-gold/30 bg-rc-charcoal px-3 py-2"
              value={payoutForm.amount}
              onChange={(event) =>
                setPayoutForm((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
              placeholder="1234,56"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="text-rc-muted">Batch ID (opzionale)</span>
            <input
              className="mt-1 w-full rounded-lg border border-rc-gold/30 bg-rc-charcoal px-3 py-2 font-mono text-sm"
              value={payoutForm.expectedPayoutBatch}
              onChange={(event) =>
                setPayoutForm((current) => ({
                  ...current,
                  expectedPayoutBatch: event.target.value,
                }))
              }
              placeholder="BK-2026-07-09"
            />
          </label>
          <label className="text-sm">
            <span className="text-rc-muted">Riferimento</span>
            <input
              className="mt-1 w-full rounded-lg border border-rc-gold/30 bg-rc-charcoal px-3 py-2"
              value={payoutForm.reference}
              onChange={(event) =>
                setPayoutForm((current) => ({
                  ...current,
                  reference: event.target.value,
                }))
              }
            />
          </label>
          <div className="flex items-end">
            <Button type="submit">Registra bonifico</Button>
          </div>
        </form>

        {bankPayouts.length === 0 ? (
          <p className="text-sm text-rc-muted">Nessun bonifico registrato.</p>
        ) : (
          <DataTable
            headers={[
              "Data",
              "Conto",
              "Banca",
              "Importo",
              "Batch collegato",
              "Match",
              "Riferimento",
              "",
            ]}
          >
            {bankPayouts.map((payout) => (
              <DataRow key={payout.id}>
                <td className="px-2 py-2">{formatDate(payout.receivedDate)}</td>
                <td className="px-2 py-2 text-sm">
                  {getBankAccountLabel(payout.bankAccountId)}
                </td>
                <td className="px-2 py-2 text-sm">
                  {getBankInstitutionLabel(payout.bankInstitution)}
                </td>
                <td className="px-2 py-2 font-medium">
                  <Money value={payout.amount} />
                </td>
                <td className="px-2 py-2 font-mono text-xs text-rc-muted">
                  {payout.expectedPayoutBatch ?? "—"}
                </td>
                <td className="px-2 py-2 text-xs text-rc-muted">
                  {payout.matchReason ?? (payout.source === "import" ? "Import" : "—")}
                </td>
                <td className="px-2 py-2 text-sm text-rc-muted">
                  {payout.reference ?? "—"}
                </td>
                <td className="px-2 py-2">
                  <Button
                    variant="secondary"
                    className="text-xs"
                    onClick={() => onRemoveBankPayout(payout.id)}
                  >
                    Elimina
                  </Button>
                </td>
              </DataRow>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}

function PayoutBatchBookingTable({
  batchBookings,
  propertyMap,
}: {
  batchBookings: Booking[];
  propertyMap: Record<string, string>;
}) {
  return (
    <DataTable
      headers={[
        "Prenotazione",
        "Appartamento",
        "Check-in",
        "Check-out",
        "Lordo",
        "Commissioni",
        "Netto in banca",
      ]}
    >
      {batchBookings.map((booking) => (
        <DataRow key={booking.id}>
          <td className="px-2 py-2">{booking.description}</td>
          <td className="px-2 py-2 text-sm">
            {propertyMap[booking.propertyId] ?? booking.propertyId}
          </td>
          <td className="px-2 py-2 text-sm">{formatDate(booking.checkIn)}</td>
          <td className="px-2 py-2 text-sm">{formatDate(booking.checkOut)}</td>
          <td className="px-2 py-2">
            <Money value={getBookingTotal(booking)} />
          </td>
          <td className="px-2 py-2">
            <Money value={booking.otaCommission} />
          </td>
          <td className="px-2 py-2">
            <Money value={getBookingNetBankDeposit(booking)} />
          </td>
        </DataRow>
      ))}
    </DataTable>
  );
}

function formatIsoToday(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
