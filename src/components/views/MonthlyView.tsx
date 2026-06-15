"use client";

import { useMemo, useState } from "react";
import {
  formatCurrency,
  formatPercent,
  getMonthlyDetail,
  getMonthlySummaries,
  getPropertiesMonthBreakdown,
  getPropertiesMonthCategoryMatrix,
  getPropertiesMonthPlatformMatrix,
  getPropertiesMonthlyMatrix,
  getPropertyMonthlyCategoryMatrix,
  getPropertyMonthlyPlatformMatrix,
  getScopedCategoryBreakdown,
  getScopedPlatformBreakdown,
} from "@/lib/calculations";
import { CHART_COLORS } from "@/lib/brand";
import {
  FISCAL_YEAR,
  OCCUPANCY_METRICS_START_MONTH,
} from "@/lib/constants";
import {
  getPropertyMonthOccupancy,
  occupancyMetricsAvailable,
} from "@/lib/occupancy";
import type {
  Booking,
  Expense,
  ExpenseCategory,
  Platform,
  Property,
} from "@/lib/types";
import { MonthlyTrendChart } from "../charts";
import {
  MonthlyVoiceMatrix,
  PropertyVoiceMatrix,
  VoiceListTable,
} from "../VoiceBreakdown";
import {
  Card,
  DataRow,
  DataTable,
  KpiCard,
  Money,
  Percent,
  TabPill,
} from "../ui";

export function MonthlyView({
  bookings,
  expenses,
  properties,
  expenseCategories,
  platforms,
  profitTargets,
}: {
  bookings: Booking[];
  expenses: Expense[];
  properties: Property[];
  expenseCategories: ExpenseCategory[];
  platforms: Platform[];
  profitTargets: number[];
}) {
  const months = getMonthlySummaries(bookings, expenses, profitTargets);
  const firstActiveMonth =
    months.find((month) => month.income > 0 || month.expenses > 0)?.period
      .month ?? 1;
  const hasJuneData = months.some(
    (month) =>
      month.period.month >= OCCUPANCY_METRICS_START_MONTH &&
      (month.income > 0 || month.expenses > 0),
  );
  const initialMonth =
    hasJuneData && firstActiveMonth < OCCUPANCY_METRICS_START_MONTH
      ? OCCUPANCY_METRICS_START_MONTH
      : firstActiveMonth;

  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");

  const detail = useMemo(
    () =>
      getMonthlyDetail(
        { year: FISCAL_YEAR, month: selectedMonth },
        bookings,
        expenses,
        properties,
        expenseCategories,
        platforms,
        profitTargets,
      ),
    [
      bookings,
      expenses,
      properties,
      expenseCategories,
      platforms,
      profitTargets,
      selectedMonth,
    ],
  );

  const propertiesMonthBreakdown = useMemo(
    () =>
      getPropertiesMonthBreakdown(
        { year: FISCAL_YEAR, month: selectedMonth },
        bookings,
        expenses,
        properties,
      ),
    [bookings, expenses, properties, selectedMonth],
  );

  const propertiesMatrix = useMemo(
    () => getPropertiesMonthlyMatrix(bookings, expenses, properties),
    [bookings, expenses, properties],
  );

  const annualPropertyId =
    selectedPropertyId === "all"
      ? (propertiesMatrix[0]?.id ?? "")
      : selectedPropertyId;

  const activeProperty =
    propertiesMatrix.find((property) => property.id === annualPropertyId) ??
    propertiesMatrix[0];

  const monthTotals = propertiesMonthBreakdown.reduce(
    (totals, property) => ({
      income: totals.income + property.income,
      expenses: totals.expenses + property.expenses,
      profit: totals.profit + property.profit,
    }),
    { income: 0, expenses: 0, profit: 0 },
  );

  const monthPeriod = useMemo(
    () => ({ year: FISCAL_YEAR, month: selectedMonth }),
    [selectedMonth],
  );

  const scopedPropertyId =
    selectedPropertyId === "all" ? undefined : selectedPropertyId;

  const scopedPlatforms = useMemo(
    () =>
      getScopedPlatformBreakdown(
        bookings,
        platforms,
        monthPeriod,
        scopedPropertyId,
      ),
    [bookings, platforms, monthPeriod, scopedPropertyId],
  );

  const scopedCategories = useMemo(
    () =>
      getScopedCategoryBreakdown(
        expenses,
        expenseCategories,
        monthPeriod,
        scopedPropertyId,
      ),
    [expenses, expenseCategories, monthPeriod, scopedPropertyId],
  );

  const scopedTotals = useMemo(() => {
    if (!scopedPropertyId) {
      return {
        income: detail.income,
        expenses: detail.expenses,
        profit: detail.profit,
        margin: detail.margin,
      };
    }

    const row = propertiesMonthBreakdown.find(
      (property) => property.id === scopedPropertyId,
    );

    return {
      income: row?.income ?? 0,
      expenses: row?.expenses ?? 0,
      profit: row?.profit ?? 0,
      margin: row?.margin ?? 0,
    };
  }, [scopedPropertyId, detail, propertiesMonthBreakdown]);

  const propertyOccupancy = useMemo(() => {
    if (!occupancyMetricsAvailable(selectedMonth) || !scopedPropertyId) {
      return null;
    }

    return getPropertyMonthOccupancy(bookings, monthPeriod, scopedPropertyId);
  }, [bookings, monthPeriod, scopedPropertyId, selectedMonth]);

  const showOccupancyMetrics = occupancyMetricsAvailable(selectedMonth);
  const selectedPropertyName =
    scopedPropertyId
      ? (properties.find((property) => property.id === scopedPropertyId)?.name ??
        scopedPropertyId)
      : "Tutti gli appartamenti";

  const totalPlatforms = scopedPlatforms;
  const totalCategories = scopedCategories;

  const propertyPlatformMatrix = useMemo(
    () =>
      getPropertiesMonthPlatformMatrix(
        monthPeriod,
        bookings,
        properties,
        platforms,
      ),
    [bookings, properties, platforms, monthPeriod],
  );

  const propertyCategoryMatrix = useMemo(
    () =>
      getPropertiesMonthCategoryMatrix(
        monthPeriod,
        expenses,
        properties,
        expenseCategories,
      ),
    [expenses, properties, expenseCategories, monthPeriod],
  );

  const activePropertyPlatforms = useMemo(
    () =>
      activeProperty
        ? getPropertyMonthlyPlatformMatrix(
            activeProperty.id,
            bookings,
            platforms,
          )
        : null,
    [activeProperty, bookings, platforms],
  );

  const activePropertyCategories = useMemo(
    () =>
      activeProperty
        ? getPropertyMonthlyCategoryMatrix(
            activeProperty.id,
            expenses,
            expenseCategories,
          )
        : null,
    [activeProperty, expenseCategories, expenses],
  );

  return (
    <div className="space-y-6">
      <Card title="Seleziona il mese">
        <div className="flex flex-wrap gap-2">
          {months.map((month) => (
            <TabPill
              key={month.label}
              active={selectedMonth === month.period.month}
              onClick={() => setSelectedMonth(month.period.month)}
            >
              {month.label}
              {month.target > 0 && month.targetMet !== null ? (
                <span
                  className={`ml-1.5 inline-block h-2 w-2 rounded-full ${
                    month.targetMet ? "bg-emerald-600" : "bg-rose-600"
                  }`}
                />
              ) : null}
            </TabPill>
          ))}
        </div>
        {!showOccupancyMetrics ? (
          <p className="mt-3 text-xs text-rc-muted">
            Occupazione, giorni liberi e prezzo medio sono disponibili da{" "}
            {OCCUPANCY_METRICS_START_MONTH === 6 ? "giugno" : `mese ${OCCUPANCY_METRICS_START_MONTH}`}.
          </p>
        ) : null}
      </Card>

      <Card title={`Appartamento — ${detail.label}`}>
        <p className="mb-4 text-sm text-rc-muted">
          Filtra ricavi e costi del mese per singolo appartamento o tutti insieme.
        </p>
        <div className="flex flex-wrap gap-2">
          <TabPill
            active={selectedPropertyId === "all"}
            onClick={() => setSelectedPropertyId("all")}
          >
            Tutti
          </TabPill>
          {properties.map((property) => (
            <TabPill
              key={property.id}
              active={selectedPropertyId === property.id}
              onClick={() => setSelectedPropertyId(property.id)}
            >
              {property.name}
            </TabPill>
          ))}
        </div>
      </Card>

      {propertyOccupancy ? (
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            label="Occupazione"
            value={formatPercent(propertyOccupancy.occupancyRate)}
            hint={`${propertyOccupancy.bookedNights} / ${propertyOccupancy.daysInMonth} giorni`}
            tone="neutral"
            progress={propertyOccupancy.occupancyRate}
            progressMax={1}
            progressLabel="Notti occupate sul mese"
          />
          <KpiCard
            label="Giorni ancora liberi"
            value={String(propertyOccupancy.availableNights)}
            hint={`Su ${propertyOccupancy.daysInMonth} giorni del mese`}
            tone="neutral"
          />
          <KpiCard
            label="Prezzo medio vendita"
            value={formatCurrency(propertyOccupancy.averageDailyRate)}
            hint="Lordo allocato ÷ notti prenotate"
            tone="income"
          />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label={`Incassi ${detail.label}`}
          value={formatCurrency(scopedTotals.income)}
          tone="income"
          progress={scopedTotals.income}
          progressMax={scopedTotals.income + scopedTotals.expenses || 1}
          progressLabel={selectedPropertyName}
          sparklineColor={CHART_COLORS.income}
        />
        <KpiCard
          label={`Spese ${detail.label}`}
          value={formatCurrency(scopedTotals.expenses)}
          tone="expense"
          progress={scopedTotals.expenses}
          progressMax={scopedTotals.income + scopedTotals.expenses || 1}
          progressLabel={selectedPropertyName}
          sparklineColor={CHART_COLORS.expense}
        />
        <KpiCard
          label="Profitto"
          value={formatCurrency(scopedTotals.profit)}
          tone={scopedTotals.profit >= 0 ? "positive" : "negative"}
          progress={Math.max(scopedTotals.profit, 0)}
          progressMax={scopedTotals.income || 1}
          progressLabel="Su incassi"
        />
        <KpiCard
          label="Obiettivo"
          value={
            detail.target > 0 ? formatCurrency(detail.target) : "Non impostato"
          }
          hint={
            detail.target > 0
              ? `Gap ${formatCurrency(detail.targetGap)}`
              : "Configura in Impostazioni"
          }
          tone={
            detail.target > 0
              ? detail.targetMet
                ? "positive"
                : "negative"
              : "neutral"
          }
          progress={scopedTotals.profit}
          progressMax={detail.target}
          progressLabel="Obiettivo mese"
        />
        <KpiCard
          label="Margine"
          value={formatPercent(scopedTotals.margin)}
          tone="neutral"
          progress={scopedTotals.margin}
          progressMax={1}
          progressLabel="Margine operativo"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title={`Incassi per voce — ${detail.label}`}
          subtitle={selectedPropertyName}
        >
          <VoiceListTable
            title="OTA"
            description="Ricavi per piattaforma nel mese selezionato."
            headers={["Voce", "Importo", "Quota"]}
            rows={totalPlatforms.filter((row) => row.total > 0)}
            total={scopedTotals.income}
          />
        </Card>

        <Card
          title={`Spese per voce — ${detail.label}`}
          subtitle={selectedPropertyName}
        >
          <VoiceListTable
            title="Voci"
            description="Costi per categoria nel mese selezionato."
            headers={["Voce", "Importo", "Quota"]}
            rows={totalCategories.filter((row) => row.total > 0)}
            total={scopedTotals.expenses}
          />
        </Card>
      </div>

      {selectedPropertyId === "all" ? (
        <Card title={`Appartamenti — ${detail.label}`}>
          <p className="mb-4 text-sm text-rc-muted">
            Incassi, spese e profitto di ogni appartamento nel mese selezionato.
            {showOccupancyMetrics
              ? " Da giugno: occupazione, giorni liberi e prezzo medio."
              : ""}
          </p>
          <DataTable
            headers={
              showOccupancyMetrics
                ? [
                    "Appartamento",
                    "Incassi",
                    "Spese",
                    "Profitto",
                    "Margine",
                    "Occupazione",
                    "Giorni liberi",
                    "Prezzo medio",
                  ]
                : [
                    "Appartamento",
                    "Incassi",
                    "Spese",
                    "Profitto",
                    "Margine",
                  ]
            }
          >
            {propertiesMonthBreakdown.map((property) => {
              const occupancy = showOccupancyMetrics
                ? getPropertyMonthOccupancy(
                    bookings,
                    monthPeriod,
                    property.id,
                  )
                : null;

              return (
                <DataRow key={property.id}>
                  <td className="px-2 py-2 font-medium text-rc-ink">
                    <button
                      type="button"
                      className="text-left transition hover:text-rc-gold-light"
                      onClick={() => setSelectedPropertyId(property.id)}
                    >
                      {property.name}
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <Money value={property.income} />
                  </td>
                  <td className="px-2 py-2">
                    <Money value={property.expenses} />
                  </td>
                  <td className="px-2 py-2">
                    <Money value={property.profit} />
                  </td>
                  <td className="px-2 py-2">
                    <Percent value={property.margin} />
                  </td>
                  {occupancy ? (
                    <>
                      <td className="px-2 py-2">
                        <Percent value={occupancy.occupancyRate} />
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {occupancy.availableNights}
                      </td>
                      <td className="px-2 py-2">
                        {occupancy.averageDailyRate > 0 ? (
                          <Money value={occupancy.averageDailyRate} />
                        ) : (
                          "—"
                        )}
                      </td>
                    </>
                  ) : null}
                </DataRow>
              );
            })}
            <DataRow>
              <td className="px-2 py-2 font-semibold text-rc-gold-light">
                Totale mese
              </td>
              <td className="px-2 py-2 font-semibold">
                <Money value={monthTotals.income} />
              </td>
              <td className="px-2 py-2 font-semibold">
                <Money value={monthTotals.expenses} />
              </td>
              <td className="px-2 py-2 font-semibold">
                <Money value={monthTotals.profit} />
              </td>
              <td className="px-2 py-2 font-semibold">
                <Percent
                  value={
                    monthTotals.income > 0
                      ? monthTotals.profit / monthTotals.income
                      : 0
                  }
                />
              </td>
              {showOccupancyMetrics ? (
                <>
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2" />
                </>
              ) : null}
            </DataRow>
          </DataTable>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`Incassi per appartamento e OTA — ${detail.label}`}>
          <PropertyVoiceMatrix
            rowLabel="Appartamento"
            columns={platforms}
            rows={propertyPlatformMatrix.map((property) => ({
              id: property.id,
              name: property.name,
              total: property.income,
              values: property.platforms,
            }))}
            rowTotal={(row) => row.total}
            valueTone="income"
          />
        </Card>

        <Card title={`Spese per appartamento e voce — ${detail.label}`}>
          <PropertyVoiceMatrix
            rowLabel="Appartamento"
            columns={expenseCategories}
            rows={propertyCategoryMatrix.map((property) => ({
              id: property.id,
              name: property.name,
              total: property.expenses,
              values: property.categories,
            }))}
            rowTotal={(row) => row.total}
            valueTone="expense"
          />
        </Card>
      </div>

      <Card title="Dettaglio annuo per appartamento">
        <p className="mb-4 text-sm text-rc-muted">
          Per ogni appartamento, incassi, spese e profitto mese per mese nell&apos;anno
          fiscale.
        </p>
        {properties.length === 0 ? (
          <p className="text-sm text-rc-muted">
            Aggiungi almeno un appartamento dalla sezione Impostazioni.
          </p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <TabPill
                active={selectedPropertyId === "all"}
                onClick={() => setSelectedPropertyId("all")}
              >
                Tutti
              </TabPill>
              {properties.map((property) => (
                <TabPill
                  key={property.id}
                  active={selectedPropertyId === property.id}
                  onClick={() => setSelectedPropertyId(property.id)}
                >
                  {property.name}
                </TabPill>
              ))}
            </div>

            {activeProperty ? (
              <div className="grid gap-6 xl:grid-cols-2">
                <div>
                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-rc-gold/20 bg-rc-charcoal/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-rc-muted">
                        Incassi anno
                      </p>
                      <p className="mt-1 text-lg font-semibold text-rc-gold-light">
                        {formatCurrency(activeProperty.income)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-rc-gold/20 bg-rc-charcoal/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-rc-muted">
                        Spese anno
                      </p>
                      <p className="mt-1 text-lg font-semibold text-amber-400">
                        {formatCurrency(activeProperty.expenses)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-rc-gold/20 bg-rc-charcoal/40 p-3">
                      <p className="text-xs uppercase tracking-wide text-rc-muted">
                        Profitto anno
                      </p>
                      <p
                        className={`mt-1 text-lg font-semibold ${
                          activeProperty.profit >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {formatCurrency(activeProperty.profit)}
                      </p>
                    </div>
                  </div>

                  <DataTable
                    headers={[
                      "Mese",
                      "Incassi",
                      "Spese",
                      "Profitto",
                      "Margine",
                    ]}
                  >
                    {activeProperty.months.map((month) => (
                      <DataRow key={month.label}>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            className={`text-left transition hover:text-rc-gold-light ${
                              selectedMonth === month.period.month
                                ? "font-semibold text-rc-gold-light"
                                : ""
                            }`}
                            onClick={() => setSelectedMonth(month.period.month)}
                          >
                            {month.label}
                          </button>
                        </td>
                        <td className="px-2 py-2">
                          <Money value={month.income} />
                        </td>
                        <td className="px-2 py-2">
                          <Money value={month.expenses} />
                        </td>
                        <td className="px-2 py-2">
                          <Money value={month.profit} />
                        </td>
                        <td className="px-2 py-2">
                          <Percent value={month.margin} />
                        </td>
                      </DataRow>
                    ))}
                    <DataRow>
                      <td className="px-2 py-2 font-semibold text-rc-gold-light">
                        Totale
                      </td>
                      <td className="px-2 py-2 font-semibold">
                        <Money value={activeProperty.income} />
                      </td>
                      <td className="px-2 py-2 font-semibold">
                        <Money value={activeProperty.expenses} />
                      </td>
                      <td className="px-2 py-2 font-semibold">
                        <Money value={activeProperty.profit} />
                      </td>
                      <td className="px-2 py-2 font-semibold">
                        <Percent value={activeProperty.margin} />
                      </td>
                    </DataRow>
                  </DataTable>
                </div>

                <MonthlyTrendChart months={activeProperty.months} />
              </div>
            ) : null}

            {activeProperty && activePropertyPlatforms && activePropertyCategories ? (
              <div className="mt-6 grid gap-6">
                <Card title={`${activeProperty.name} — incassi per OTA mese per mese`}>
                  <MonthlyVoiceMatrix
                    rowLabel="Mese"
                    columns={platforms}
                    months={activePropertyPlatforms.months}
                    monthValues={(month) =>
                      activePropertyPlatforms.months
                        .find((item) => item.period.month === month)
                        ?.platforms.map((platform) => ({
                          id: platform.id,
                          total: platform.total,
                        })) ?? []
                    }
                    monthTotal={(month) =>
                      activePropertyPlatforms.months.find(
                        (item) => item.period.month === month,
                      )?.income ?? 0
                    }
                    columnTotals={activePropertyPlatforms.platforms}
                    valueTone="income"
                  />
                </Card>

                <Card title={`${activeProperty.name} — spese per voce mese per mese`}>
                  <MonthlyVoiceMatrix
                    rowLabel="Mese"
                    columns={expenseCategories}
                    months={activePropertyCategories.months}
                    monthValues={(month) =>
                      activePropertyCategories.months
                        .find((item) => item.period.month === month)
                        ?.categories.map((category) => ({
                          id: category.id,
                          total: category.total,
                        })) ?? []
                    }
                    monthTotal={(month) =>
                      activePropertyCategories.months.find(
                        (item) => item.period.month === month,
                      )?.expenses ?? 0
                    }
                    columnTotals={activePropertyCategories.categories}
                    valueTone="expense"
                  />
                </Card>
              </div>
            ) : null}
          </>
        )}
      </Card>

      {propertiesMatrix.length > 0 ? (
        <Card title="Confronto tutti gli appartamenti">
          <p className="mb-4 text-sm text-rc-muted">
            Matrice annuale: per ogni mese, incassi, spese e profitto di ogni
            appartamento.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-rc-gold/35 text-left text-rc-gold-light/80">
                  <th className="sticky left-0 z-10 bg-rc-charcoal px-2 py-2 font-semibold uppercase tracking-wide">
                    Appartamento
                  </th>
                  {propertiesMatrix[0].months.map((month) => (
                    <th
                      key={month.label}
                      colSpan={3}
                      className="border-l border-rc-gold/20 px-2 py-2 text-center font-semibold uppercase tracking-wide"
                    >
                      {month.label}
                    </th>
                  ))}
                  <th
                    colSpan={3}
                    className="border-l border-rc-gold/20 px-2 py-2 text-center font-semibold uppercase tracking-wide"
                  >
                    Totale
                  </th>
                </tr>
                <tr className="border-b border-rc-gold/20 text-rc-muted">
                  <th className="sticky left-0 z-10 bg-rc-charcoal px-2 py-1" />
                  {propertiesMatrix[0].months.map((month) => (
                    <MonthMatrixSubHeaders key={`sub-${month.label}`} />
                  ))}
                  <MonthMatrixSubHeaders key="sub-total" />
                </tr>
              </thead>
              <tbody>
                {propertiesMatrix.map((property) => (
                  <tr
                    key={property.id}
                    className="border-b border-rc-gold/15 transition hover:bg-rc-gold/8"
                  >
                    <td className="sticky left-0 z-10 bg-rc-charcoal px-2 py-2 font-medium text-rc-ink">
                      {property.name}
                    </td>
                    {property.months.map((month) => (
                      <MonthMatrixCells
                        key={`${property.id}-${month.label}`}
                        month={month}
                      />
                    ))}
                    <MonthMatrixCells
                      month={{
                        income: property.income,
                        expenses: property.expenses,
                        profit: property.profit,
                      }}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function MonthMatrixSubHeaders() {
  return (
    <>
      <th className="border-l border-rc-gold/15 px-1 py-1 text-right font-medium">
        Inc
      </th>
      <th className="px-1 py-1 text-right font-medium">Spe</th>
      <th className="px-1 py-1 text-right font-medium">Pro</th>
    </>
  );
}

function MonthMatrixCells({
  month,
}: {
  month: { income: number; expenses: number; profit: number };
}) {
  return (
    <>
      <td className="border-l border-rc-gold/15 px-1 py-2 text-right tabular-nums text-rc-gold-light">
        {month.income > 0 ? formatCurrency(month.income) : "—"}
      </td>
      <td className="px-1 py-2 text-right tabular-nums text-amber-400">
        {month.expenses > 0 ? formatCurrency(month.expenses) : "—"}
      </td>
      <td
        className={`px-1 py-2 text-right tabular-nums ${
          month.profit >= 0 ? "text-emerald-400" : "text-rose-400"
        }`}
      >
        {month.income > 0 || month.expenses > 0
          ? formatCurrency(month.profit)
          : "—"}
      </td>
    </>
  );
}
