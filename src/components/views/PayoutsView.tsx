"use client";

import { Fragment, useMemo, useState } from "react";
import {
  formatCurrency,
  formatDate,
  getBookingTotal,
} from "@/lib/calculations";
import { getBankAccountLabel } from "@/lib/bank-accounts";
import { BANK_ACCOUNT_OPTIONS, FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import {
  buildPayoutReconciliation,
  getBookingNetBankDeposit,
  type PayoutBatchStatus,
} from "@/lib/ota-payout";
import {
  bookingPayoutStatusClass,
  bookingPayoutStatusLabel,
  buildCompanyPayoutDashboard,
  buildOtaCollectionOverview,
  sumBankDepositsByOtaChannel,
} from "@/lib/payout-dashboard";
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
  onRemoveBankPayout,
  onImportBankPayouts,
  onClearBankPayouts,
}: {
  bookings: Booking[];
  properties: Property[];
  platforms: Platform[];
  bankPayouts: BankPayoutReceived[];
  onRemoveBankPayout: (id: string) => void;
  onImportBankPayouts: (
    payouts: Omit<BankPayoutReceived, "id">[],
  ) => { added: number; skipped: number };
  onClearBankPayouts: () => void;
}) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedCompany, setSelectedCompany] = useState<BankAccountId>("dsep");
  const [selectedOta, setSelectedOta] = useState<string | "all">("all");
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

  const propertyMap = Object.fromEntries(
    properties.map((property) => [property.id, property.name]),
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

  const dashboard = useMemo(
    () =>
      buildCompanyPayoutDashboard(
        bookings,
        properties,
        platforms,
        bankPayouts,
        { year: FISCAL_YEAR, month: selectedMonth },
      ),
    [bankPayouts, bookings, platforms, properties, selectedMonth],
  );

  const activeCompany =
    dashboard.companies.find(
      (company) => company.accountId === selectedCompany,
    ) ?? dashboard.companies[0];

  const detailRows = useMemo(() => {
    if (!activeCompany) {
      return [];
    }
    if (selectedOta === "all") {
      return activeCompany.otaGroups.flatMap((group) => group.bookings);
    }
    return (
      activeCompany.otaGroups.find((group) => group.platformId === selectedOta)
        ?.bookings ?? []
    );
  }, [activeCompany, selectedOta]);

  const activeOtaGroup =
    selectedOta === "all"
      ? null
      : activeCompany?.otaGroups.find((group) => group.platformId === selectedOta);

  const otaOverview = useMemo(() => {
    if (!activeCompany) {
      return null;
    }
    return buildOtaCollectionOverview(activeCompany, bankPayouts, {
      year: FISCAL_YEAR,
      month: selectedMonth,
    });
  }, [activeCompany, bankPayouts, selectedMonth]);

  const bankDepositsInMonth = useMemo(
    () =>
      sumBankDepositsByOtaChannel(bankPayouts, selectedCompany, {
        year: FISCAL_YEAR,
        month: selectedMonth,
      }),
    [bankPayouts, selectedCompany, selectedMonth],
  );

  return (
    <div className="space-y-6">
      <Card title="Riconciliazione incassi OTA per azienda">
        <p className="mb-4 text-sm text-rc-muted">
          Mese del <strong className="text-rc-ink">pagamento atteso in banca</strong>{" "}
          (regole: Booking = giovedì dopo il check-out; Airbnb/Vrbo = primo giorno
          lavorativo dopo il check-in). Non coincide con la ripartizione per{" "}
          <strong className="text-rc-ink">notti nel mese</strong> in Incassi.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {BANK_ACCOUNT_OPTIONS.map((option) => (
            <TabPill
              key={option.id}
              active={selectedCompany === option.id}
              onClick={() => {
                setSelectedCompany(option.id);
                setSelectedOta("all");
              }}
            >
              {option.label}
            </TabPill>
          ))}
        </div>
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

      {activeCompany && otaOverview ? (
        <Card
          title={`Vista rapida OTA — ${activeCompany.label}`}
          subtitle={`${MONTH_LABELS[selectedMonth - 1]} ${FISCAL_YEAR} · netto in banca (dopo commissioni OTA)`}
        >
          {otaOverview.totals.otaBookingsMissingCommission > 0 ? (
            <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {otaOverview.totals.otaBookingsMissingCommission} prenotazioni OTA senza
              commissione in dashboard: l&apos;atteso potrebbe essere troppo alto
              (lordo invece di netto). Controlla import OTA o commissioni in Incassi.
            </p>
          ) : null}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="rounded-lg border border-rc-gold/20 bg-rc-charcoal/30 p-3">
              <p className="text-xs uppercase text-rc-muted">Lordo (mese)</p>
              <p className="text-lg font-semibold text-rc-muted">
                {formatCurrency(otaOverview.totals.grossMonth)}
              </p>
            </div>
            <div className="rounded-lg border border-rc-gold/20 bg-rc-charcoal/30 p-3">
              <p className="text-xs uppercase text-rc-muted">Commissioni OTA</p>
              <p className="text-lg font-semibold text-amber-400/90">
                −{formatCurrency(otaOverview.totals.commissionMonth)}
              </p>
            </div>
            <div className="rounded-lg border border-rc-gold/20 bg-rc-charcoal/30 p-3">
              <p className="text-xs uppercase text-rc-muted">Atteso netto</p>
              <p className="text-lg font-semibold text-rc-gold-light">
                {formatCurrency(otaOverview.totals.netExpectedMonth)}
              </p>
            </div>
            <div className="rounded-lg border border-rc-gold/20 bg-rc-charcoal/30 p-3">
              <p className="text-xs uppercase text-rc-muted">Già scaduto</p>
              <p className="text-lg font-semibold text-rc-ink">
                {formatCurrency(otaOverview.totals.dueByTodayAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-rc-charcoal/30 p-3">
              <p className="text-xs uppercase text-rc-muted">Incassato (netto)</p>
              <p className="text-lg font-semibold text-emerald-400">
                {formatCurrency(otaOverview.totals.receivedAttributed)}
              </p>
            </div>
            <div className="rounded-lg border border-rose-500/30 bg-rc-charcoal/30 p-3">
              <p className="text-xs uppercase text-rc-muted">Manca ancora</p>
              <p className="text-lg font-semibold text-rose-400">
                {formatCurrency(otaOverview.totals.stillOwedAmount)}
              </p>
            </div>
            <div className="rounded-lg border border-rc-gold/20 bg-rc-charcoal/30 p-3">
              <p className="text-xs uppercase text-rc-muted">In CSV (mese)</p>
              <p className="text-lg font-semibold text-rc-ink">
                {formatCurrency(otaOverview.totals.bankCsvMonth)}
              </p>
            </div>
          </div>

          {otaOverview.rows.length === 0 ? (
            <p className="text-sm text-rc-muted">
              Nessun pagamento OTA atteso per {activeCompany.label} in questo mese.
            </p>
          ) : (
            <div className="space-y-4">
              {otaOverview.rows.map((row) => {
                const progress =
                  row.dueByTodayAmount > 0
                    ? Math.min(
                        100,
                        (row.receivedAttributed / row.dueByTodayAmount) * 100,
                      )
                    : row.receivedAttributed > 0
                      ? 100
                      : 0;
                return (
                  <div
                    key={row.platformId}
                    className="rounded-xl border border-rc-gold/15 bg-rc-charcoal/25 p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                      <p className="text-base font-semibold text-rc-gold-light">
                        {row.platformName}
                      </p>
                      <p className="text-xs text-rc-muted">
                        {row.dueByTodayCount} pag. scaduti ·{" "}
                        <span className="text-rose-400">{row.missingCount}</span>{" "}
                        mancanti
                        {row.pendingCount > 0
                          ? ` · ${row.pendingCount} in arrivo`
                          : ""}
                      </p>
                    </div>
                    <div className="mb-3 h-2 overflow-hidden rounded-full bg-rc-charcoal">
                      <div
                        className="h-full rounded-full bg-emerald-500/80 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-7">
                      <div>
                        <p className="text-xs text-rc-muted">Lordo</p>
                        <p className="font-medium text-rc-muted">
                          {formatCurrency(row.grossMonth)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-rc-muted">Comm. OTA</p>
                        <p className="font-medium text-amber-400/90">
                          −{formatCurrency(row.commissionMonth)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-rc-muted">Netto atteso</p>
                        <p className="font-medium">
                          {formatCurrency(row.netExpectedMonth)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-rc-muted">Scaduto</p>
                        <p className="font-medium">
                          {formatCurrency(row.dueByTodayAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-rc-muted">Incassato netto</p>
                        <p className="font-medium text-emerald-400">
                          {formatCurrency(row.receivedAttributed)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-rc-muted">Manca</p>
                        <p className="font-medium text-rose-400">
                          {formatCurrency(row.stillOwedAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-rc-muted">In arrivo</p>
                        <p className="font-medium text-rc-muted">
                          {formatCurrency(row.pendingAmount)}
                          {row.nextPendingDate
                            ? ` · da ${formatDate(row.nextPendingDate)}`
                            : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-rc-muted">CSV banca</p>
                        <p className="font-medium">
                          {formatCurrency(row.bankCsvMonth)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {otaOverview.missingItems.length > 0 ? (
            <div className="mt-8">
              <p className="mb-3 text-sm font-medium text-rose-300">
                Da incassare (scaduto o parziale)
              </p>
              <DataTable
                headers={[
                  "Data attesa",
                  "OTA",
                  "Ospite",
                  "Appartamento",
                  "Importo mancante",
                ]}
              >
                {otaOverview.missingItems.slice(0, 20).map((item, index) => (
                  <DataRow key={`${item.platformId}-${item.expectedPayoutDate}-${index}`}>
                    <td className="px-2 py-2 text-sm">
                      {formatDate(item.expectedPayoutDate)}
                    </td>
                    <td className="px-2 py-2 text-sm">{item.platformName}</td>
                    <td className="px-2 py-2">{item.guest}</td>
                    <td className="px-2 py-2 text-sm text-rc-muted">
                      {item.propertyName}
                    </td>
                    <td className="px-2 py-2 font-medium text-rose-400">
                      <Money value={item.netStillOwed} />
                    </td>
                  </DataRow>
                ))}
              </DataTable>
              {otaOverview.missingItems.length > 20 ? (
                <p className="mt-2 text-xs text-rc-muted">
                  Mostrati i primi 20 di {otaOverview.missingItems.length} — usa il
                  dettaglio prenotazioni sotto per l&apos;elenco completo.
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Atteso netto (mese pagamento)">
          <p className="text-2xl font-semibold text-rc-gold-light">
            {formatCurrency(dashboard.netExpected)}
          </p>
          <p className="mt-1 text-xs text-rc-muted">
            Prenotazioni con pagamento atteso in{" "}
            {MONTH_LABELS[selectedMonth - 1]} ({dashboard.bookingCount} OTA)
          </p>
        </Card>
        <Card title="Abbinato alle prenotazioni">
          <p className="text-2xl font-semibold text-emerald-400">
            {formatCurrency(dashboard.receivedTotal)}
          </p>
          <p className="mt-1 text-xs text-rc-muted">
            Solo il mese del pagamento atteso, non tutto il CSV
          </p>
        </Card>
        <Card title="Accrediti CSV (data in banca)">
          <p className="text-2xl font-semibold text-rc-ink">
            {formatCurrency(bankDepositsInMonth.total)}
          </p>
          <p className="mt-1 text-xs text-rc-muted">
            Booking {formatCurrency(bankDepositsInMonth.booking)} · Airbnb{" "}
            {formatCurrency(bankDepositsInMonth.airbnb)}
            {bankDepositsInMonth.vrbo > 0
              ? ` · Vrbo ${formatCurrency(bankDepositsInMonth.vrbo)}`
              : ""}
          </p>
        </Card>
        <Card title="Gap atteso − abbinato">
          <p
            className={`text-2xl font-semibold ${
              Math.abs(dashboard.difference) <= 0.02
                ? "text-emerald-400"
                : "text-amber-400"
            }`}
          >
            {formatCurrency(dashboard.difference)}
          </p>
        </Card>
      </div>

      <Card title={`Aziende — ${MONTH_LABELS[selectedMonth - 1]} ${FISCAL_YEAR}`}>
        <div className="grid gap-4 lg:grid-cols-3">
          {dashboard.companies.map((company) => {
            const active = company.accountId === selectedCompany;
            return (
              <button
                key={company.accountId}
                type="button"
                onClick={() => {
                  setSelectedCompany(company.accountId);
                  setSelectedOta("all");
                }}
                className={`rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-rc-gold bg-rc-gold/10 shadow-md shadow-rc-gold/10"
                    : "border-rc-gold/20 bg-rc-charcoal/40 hover:border-rc-gold/40"
                }`}
              >
                <p className="text-lg font-semibold text-rc-gold-light">
                  {company.label}
                </p>
                <p className="mt-2 text-sm text-rc-muted">
                  {company.bookingCount} prenotazioni · {company.paidCount}{" "}
                  incassate ·{" "}
                  <span className="text-rose-400">{company.missingCount}</span>{" "}
                  mancanti
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs uppercase text-rc-muted">Atteso</p>
                    <p className="font-medium text-rc-ink">
                      {formatCurrency(company.netExpected)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-rc-muted">Ricevuto</p>
                    <p className="font-medium text-emerald-400">
                      {formatCurrency(company.receivedTotal)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {activeCompany ? (
        <>
          <Card
            title={`${activeCompany.label} — per OTA`}
            subtitle={
              selectedOta === "all"
                ? "Totale tutte le piattaforme"
                : activeOtaGroup?.platformName
            }
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <TabPill
                active={selectedOta === "all"}
                onClick={() => setSelectedOta("all")}
              >
                Tutte le OTA
              </TabPill>
              {activeCompany.otaGroups.map((group) => (
                <TabPill
                  key={group.platformId}
                  active={selectedOta === group.platformId}
                  onClick={() => setSelectedOta(group.platformId)}
                >
                  {group.platformName} ({group.bookingCount})
                </TabPill>
              ))}
            </div>

            {activeCompany.otaGroups.length === 0 ? (
              <p className="text-sm text-rc-muted">
                Nessun pagamento OTA atteso per {activeCompany.label} in questo
                mese.
              </p>
            ) : (
              <DataTable
                headers={[
                  "OTA",
                  "Prenot.",
                  "Netto atteso",
                  "Ricevuto",
                  "Diff.",
                  "Incassate",
                  "Mancanti",
                ]}
              >
                {(selectedOta === "all"
                  ? activeCompany.otaGroups
                  : activeCompany.otaGroups.filter(
                      (group) => group.platformId === selectedOta,
                    )
                ).map((group) => (
                  <DataRow key={group.platformId}>
                    <td className="px-2 py-2 font-medium">{group.platformName}</td>
                    <td className="px-2 py-2 text-center">{group.bookingCount}</td>
                    <td className="px-2 py-2">
                      <Money value={group.netExpected} />
                    </td>
                    <td className="px-2 py-2">
                      <Money value={group.receivedTotal} />
                    </td>
                    <td className="px-2 py-2">
                      <Money value={group.difference} />
                    </td>
                    <td className="px-2 py-2 text-emerald-400">
                      {group.paidCount}
                    </td>
                    <td className="px-2 py-2 text-rose-400">
                      {group.missingCount}
                    </td>
                  </DataRow>
                ))}
              </DataTable>
            )}
          </Card>

          <Card
            title={`Dettaglio prenotazioni — ${activeCompany.label}`}
            subtitle={`${MONTH_LABELS[selectedMonth - 1]} · pagamento atteso nel mese`}
          >
            {detailRows.length === 0 ? (
              <p className="text-sm text-rc-muted">
                Nessuna prenotazione per i filtri selezionati.
              </p>
            ) : (
              <DataTable
                headers={[
                  "Stato",
                  "Ospite",
                  "Appartamento",
                  "OTA",
                  "Check-in",
                  "Check-out",
                  "Lordo",
                  "Comm.",
                  "Netto atteso",
                  "Data pag. attesa",
                  "Batch",
                  "Ricevuto",
                  "Data accredito",
                ]}
              >
                {detailRows.map((row) => (
                  <DataRow key={row.bookingId}>
                    <td
                      className={`px-2 py-2 text-xs font-semibold ${bookingPayoutStatusClass(row.status)}`}
                    >
                      {bookingPayoutStatusLabel(row.status)}
                    </td>
                    <td className="px-2 py-2 font-medium">{row.guest}</td>
                    <td className="px-2 py-2 text-sm">{row.propertyName}</td>
                    <td className="px-2 py-2 text-sm">{row.platformName}</td>
                    <td className="px-2 py-2 text-sm">
                      {formatDate(row.checkIn)}
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {formatDate(row.checkOut)}
                    </td>
                    <td className="px-2 py-2">
                      <Money value={row.gross} />
                    </td>
                    <td className="px-2 py-2">
                      <Money value={row.commission} />
                    </td>
                    <td className="px-2 py-2 font-medium">
                      <Money value={row.netExpected} />
                    </td>
                    <td className="px-2 py-2 text-sm">
                      {formatDate(row.expectedPayoutDate)}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs text-rc-muted">
                      {row.expectedPayoutBatch}
                    </td>
                    <td className="px-2 py-2">
                      <Money value={row.receivedAmount} />
                    </td>
                    <td className="px-2 py-2 text-sm text-rc-muted">
                      {row.receivedDate ? formatDate(row.receivedDate) : "—"}
                    </td>
                  </DataRow>
                ))}
              </DataTable>
            )}
          </Card>
        </>
      ) : null}

      <details className="rounded-xl border border-rc-gold/20 bg-rc-charcoal/20 p-4">
        <summary className="cursor-pointer text-sm font-medium text-rc-gold-light">
          Vista tecnica per batch bonifico (Booking settimanale / Airbnb per data)
        </summary>
        <div className="mt-4 space-y-4">
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
        </div>
      </details>

      <Card title="Carica estratto conto CSV (Finom / BPER)">
        <p className="mb-4 text-sm text-rc-muted">
          Qui carichi solo ciò che è <strong className="text-rc-ink">arrivato in banca</strong>.
          Il confronto con quanto <strong className="text-rc-ink">devi ricevere</strong>{" "}
          è già calcolato sopra dalle prenotazioni. Scegli{" "}
          <strong className="text-rc-ink">azienda</strong> (HSP / DSEP / D&D) e{" "}
          <strong className="text-rc-ink">banca del file</strong> (DSEP: Finom o BPER;
          HSP: BPER; D&D: Finom). Dopo l&apos;import il sistema abbina le righe alle
          prenotazioni (ID Booking o importo/data).
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (
                bankPayouts.length === 0 ||
                window.confirm(
                  "Rimuovere tutti i bonifici importati dagli estratti conto? Gli importi attesi dalle prenotazioni restano invariati.",
                )
              ) {
                if (bankPayouts.length > 0) {
                  onClearBankPayouts();
                  setImportPreview(null);
                  setImportStatus("Elenco bonifici da CSV svuotato.");
                }
              }
            }}
          >
            Svuota bonifici da CSV
          </Button>
        </div>

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
                    const detail =
                      parsed.format === "unknown"
                        ? "Formato non riconosciuto: usa CSV Finom (virgola) o movimenti BPER (punto e virgola, colonne Contabile/Descrizione/Importo)."
                        : parsed.format === "bper"
                          ? `BPER riconosciuto, ma nessuna riga «BONIFICI ESTERI» Airbnb/Booking. Righe saltate: ${parsed.skippedRows}.`
                          : `Finom riconosciuto, ma nessun accredito Airbnb/Booking/Vrbo. Righe saltate: ${parsed.skippedRows}.`;
                    setImportStatus(detail);
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
                  const bookingTotal = rows
                    .filter((row) => row.otaChannel === "booking")
                    .reduce((sum, row) => sum + row.amount, 0);
                  const airbnbTotal = rows
                    .filter((row) => row.otaChannel === "airbnb")
                    .reduce((sum, row) => sum + row.amount, 0);
                  setImportStatus(
                    `Trovati ${rows.length} accrediti OTA (${parsed.format.toUpperCase()}). ` +
                      `Booking ${formatCurrency(bookingTotal)} · Airbnb ${formatCurrency(airbnbTotal)}. ` +
                      `Righe ignorate nel file: ${parsed.skippedRows}.`,
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

        <p className="mb-3 mt-8 text-sm font-medium text-rc-gold-light">
          Bonifici importati da CSV
        </p>

        {bankPayouts.length === 0 ? (
          <p className="text-sm text-rc-muted">
            Nessun estratto conto caricato. Gli importi attesi restano visibili
            nelle tabelle sopra.
          </p>
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
                  {payout.matchReason ?? "—"}
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
