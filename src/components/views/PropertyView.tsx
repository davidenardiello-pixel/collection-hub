"use client";

import { useMemo, useState } from "react";
import {
  formatCurrency,
  formatPercent,
  filterByPropertyScope,
  getAllPropertiesMonthlyCategoryMatrix,
  getAllPropertiesMonthlyPlatformMatrix,
  getPropertiesScopeSummary,
  getPropertyMonthlyCategoryMatrix,
  getPropertyMonthlyPlatformMatrix,
  getScopedCategoryBreakdown,
  getScopedPlatformBreakdown,
} from "@/lib/calculations";
import { CHART_COLORS } from "@/lib/brand";
import {
  FISCAL_YEAR,
  MONTH_LABELS,
  OCCUPANCY_METRICS_START_MONTH,
  PROPERTY_CITIES,
} from "@/lib/constants";
import { filterPropertiesByCity } from "@/lib/property-cities";
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
  PropertyCityId,
} from "@/lib/types";
import { MonthlyTrendChart, RingGauge } from "../charts";
import { PropertyOccupancyCalendar } from "../PropertyOccupancyCalendar";
import {
  MonthlyVoiceMatrix,
  VoiceListTable,
} from "../VoiceBreakdown";
import { Card, DataRow, DataTable, KpiCard, Money, TabPill } from "../ui";

function defaultOccupancyMonth(): number {
  const now = new Date();
  if (now.getFullYear() === FISCAL_YEAR) {
    return Math.max(OCCUPANCY_METRICS_START_MONTH, now.getMonth() + 1);
  }
  return OCCUPANCY_METRICS_START_MONTH;
}

export function PropertyView({
  bookings,
  expenses,
  properties,
  expenseCategories,
  platforms,
}: {
  bookings: Booking[];
  expenses: Expense[];
  properties: Property[];
  expenseCategories: ExpenseCategory[];
  platforms: Platform[];
}) {
  const [selectedCity, setSelectedCity] = useState<PropertyCityId | "all">(
    "all",
  );
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | "all">(
    "all",
  );
  const [occupancyMonth, setOccupancyMonth] = useState(defaultOccupancyMonth);

  const visibleProperties = useMemo(
    () => filterPropertiesByCity(properties, selectedCity),
    [properties, selectedCity],
  );

  const scopedPropertyIds = useMemo(() => {
    if (selectedPropertyId === "all") {
      return visibleProperties.map((property) => property.id);
    }

    return visibleProperties.some((property) => property.id === selectedPropertyId)
      ? [selectedPropertyId]
      : visibleProperties.map((property) => property.id);
  }, [selectedPropertyId, visibleProperties]);

  const propertyScope = useMemo(
    () =>
      scopedPropertyIds.length === 1 ? scopedPropertyIds[0] : scopedPropertyIds,
    [scopedPropertyIds],
  );

  const scopedBookings = useMemo(
    () => filterByPropertyScope(bookings, propertyScope),
    [bookings, propertyScope],
  );

  const scopedExpenses = useMemo(
    () => filterByPropertyScope(expenses, propertyScope),
    [expenses, propertyScope],
  );

  const scopeLabel = useMemo(() => {
    if (selectedPropertyId !== "all") {
      return (
        visibleProperties.find((property) => property.id === selectedPropertyId)
          ?.name ?? "Proprietà"
      );
    }

    if (selectedCity === "all") {
      return "Tutte le città";
    }

    return (
      PROPERTY_CITIES.find((city) => city.id === selectedCity)?.label ??
      selectedCity
    );
  }, [selectedCity, selectedPropertyId, visibleProperties]);

  const summary = useMemo(
    () =>
      getPropertiesScopeSummary(
        scopedPropertyIds,
        bookings,
        expenses,
        properties,
        expenseCategories,
        platforms,
      ),
    [
      scopedPropertyIds,
      bookings,
      expenses,
      properties,
      expenseCategories,
      platforms,
    ],
  );

  const annualPlatforms = useMemo(
    () =>
      getScopedPlatformBreakdown(
        scopedBookings,
        platforms,
        undefined,
        propertyScope,
      ),
    [scopedBookings, platforms, propertyScope],
  );

  const annualCategories = useMemo(
    () =>
      getScopedCategoryBreakdown(
        scopedExpenses,
        expenseCategories,
        undefined,
        propertyScope,
      ),
    [scopedExpenses, expenseCategories, propertyScope],
  );

  const platformMatrix = useMemo(() => {
    if (scopedPropertyIds.length === 1) {
      return getPropertyMonthlyPlatformMatrix(
        scopedPropertyIds[0],
        bookings,
        platforms,
      );
    }

    return getAllPropertiesMonthlyPlatformMatrix(scopedBookings, platforms);
  }, [scopedPropertyIds, bookings, platforms, scopedBookings]);

  const categoryMatrix = useMemo(() => {
    if (scopedPropertyIds.length === 1) {
      return getPropertyMonthlyCategoryMatrix(
        scopedPropertyIds[0],
        expenses,
        expenseCategories,
      );
    }

    return getAllPropertiesMonthlyCategoryMatrix(
      scopedExpenses,
      expenseCategories,
    );
  }, [scopedPropertyIds, expenses, expenseCategories, scopedExpenses]);

  const occupancyPeriod = useMemo(
    () => ({ year: FISCAL_YEAR, month: occupancyMonth }),
    [occupancyMonth],
  );

  const showOccupancyCalendars = occupancyMetricsAvailable(occupancyMonth);

  const singlePropertyId =
    scopedPropertyIds.length === 1 ? scopedPropertyIds[0] : null;

  const singlePropertyOccupancy = useMemo(() => {
    if (!showOccupancyCalendars || !singlePropertyId) {
      return null;
    }

    return getPropertyMonthOccupancy(bookings, occupancyPeriod, singlePropertyId);
  }, [
    bookings,
    occupancyPeriod,
    showOccupancyCalendars,
    singlePropertyId,
  ]);

  if (properties.length === 0) {
    return (
      <Card title="Proprietà">
        <p className="text-sm text-rc-muted">
          Aggiungi almeno un appartamento dalla sezione Impostazioni.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card title="Seleziona proprietà">
        <div className="mb-4 flex flex-wrap gap-2">
          <TabPill
            active={selectedCity === "all"}
            onClick={() => {
              setSelectedCity("all");
              setSelectedPropertyId("all");
            }}
          >
            Tutte le città
          </TabPill>
          {PROPERTY_CITIES.map((city) => (
            <TabPill
              key={city.id}
              active={selectedCity === city.id}
              onClick={() => {
                setSelectedCity(city.id);
                setSelectedPropertyId("all");
              }}
            >
              {city.label}
            </TabPill>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <TabPill
            active={selectedPropertyId === "all"}
            onClick={() => setSelectedPropertyId("all")}
          >
            Tutti ({scopeLabel})
          </TabPill>
          {visibleProperties.map((property) => (
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

      {showOccupancyCalendars ? (
        <Card
          title="Calendario occupazione"
          subtitle={`${MONTH_LABELS[occupancyMonth - 1]} ${FISCAL_YEAR} — giorni occupati e liberi per check-in`}
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {MONTH_LABELS.map((label, index) => {
              const month = index + 1;
              if (!occupancyMetricsAvailable(month)) {
                return null;
              }

              return (
                <TabPill
                  key={label}
                  active={occupancyMonth === month}
                  onClick={() => setOccupancyMonth(month)}
                >
                  {label}
                </TabPill>
              );
            })}
          </div>

          {singlePropertyId && singlePropertyOccupancy ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <KpiCard
                  label="Occupazione"
                  value={formatPercent(singlePropertyOccupancy.occupancyRate)}
                  hint={`${singlePropertyOccupancy.bookedNights} / ${singlePropertyOccupancy.daysInMonth} giorni`}
                  tone="neutral"
                  progress={singlePropertyOccupancy.occupancyRate}
                  progressMax={1}
                />
                <KpiCard
                  label="Giorni liberi"
                  value={String(singlePropertyOccupancy.availableNights)}
                  hint={`${singlePropertyOccupancy.potentialBookableDays} ancora occupabili`}
                  tone="neutral"
                />
                <KpiCard
                  label="Prezzo medio"
                  value={formatCurrency(singlePropertyOccupancy.averageDailyRate)}
                  hint="Lordo mese ÷ giorni occupati"
                  tone="income"
                />
              </div>
              <PropertyOccupancyCalendar
                bookings={bookings}
                period={occupancyPeriod}
                propertyId={singlePropertyId}
                propertyName={scopeLabel}
              />
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProperties.map((property) => (
                <div
                  key={property.id}
                  className="rounded-xl border border-rc-gold/20 bg-rc-charcoal/40 p-3"
                >
                  <PropertyOccupancyCalendar
                    bookings={bookings}
                    period={occupancyPeriod}
                    propertyId={property.id}
                    propertyName={property.name}
                    compact
                  />
                  <button
                    type="button"
                    className="mt-2 text-xs text-rc-gold-light underline-offset-2 hover:underline"
                    onClick={() => setSelectedPropertyId(property.id)}
                  >
                    Apri solo questo appartamento
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Totale incassi"
          value={formatCurrency(summary.income)}
          tone="income"
          sparkline={summary.monthly.map((month) => month.income)}
          sparklineColor={CHART_COLORS.income}
        />
        <KpiCard
          label="Totale spese"
          value={formatCurrency(summary.expenses)}
          tone="expense"
          sparkline={summary.monthly.map((month) => month.expenses)}
          sparklineColor={CHART_COLORS.expense}
        />
        <KpiCard
          label="Profitto"
          value={formatCurrency(summary.profit)}
          tone={summary.profit >= 0 ? "positive" : "negative"}
          sparkline={summary.monthly.map((month) => month.profit)}
        />
        <KpiCard
          label="Margine"
          value={formatPercent(summary.margin)}
          tone="neutral"
          progress={summary.margin}
          progressMax={1}
          progressLabel="Margine proprietà"
        />
        <KpiCard
          label="Tasso / Affitto"
          value={formatPercent(summary.rate)}
          hint={
            selectedPropertyId === "all"
              ? selectedCity === "all"
                ? "Somma affitti mensili del portafoglio"
                : `Affitti mensili — ${scopeLabel}`
              : summary.property
                ? `Affitto ${formatCurrency(summary.property.monthlyRent)}/mese`
                : undefined
          }
          tone="neutral"
          progress={summary.rate}
          progressMax={1}
          progressLabel="Rendimento vs affitto"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`${scopeLabel} — incassi per OTA (anno)`}>
          <VoiceListTable
            title="OTA"
            description="Ricavi annuali suddivisi per tipo di prenotazione."
            headers={["OTA", "Importo", "Quota"]}
            rows={annualPlatforms}
            total={summary.income}
          />
        </Card>

        <Card title={`${scopeLabel} — spese per voce (anno)`}>
          <VoiceListTable
            title="Voci"
            description="Costi annuali suddivisi per tutte le categorie di spesa."
            headers={["Voce", "Importo", "Quota"]}
            rows={annualCategories}
            total={summary.expenses}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Performance">
          <div className="flex flex-wrap items-center justify-around gap-6 py-4">
            <RingGauge
              value={summary.margin}
              label="Margine"
              color={CHART_COLORS.income}
            />
            <RingGauge
              value={summary.rate}
              label="Tasso"
              sublabel="Vs affitto mensile"
              color={CHART_COLORS.property}
            />
          </div>
        </Card>

        <Card title="Trend mensile proprietà" className="xl:col-span-2">
          <MonthlyTrendChart months={summary.monthly} />
        </Card>
      </div>

      <Card title="Sintesi mensile — incassi, spese e profitto">
        <DataTable headers={["Mese", "Incassi", "Spese", "Profitto", "Margine"]}>
          {summary.monthly.map((month) => (
            <DataRow key={month.label}>
              <td className="px-2 py-2">{month.label}</td>
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
                {formatPercent(
                  month.income > 0 ? month.profit / month.income : 0,
                )}
              </td>
            </DataRow>
          ))}
        </DataTable>
      </Card>

      <Card title={`${scopeLabel} — incassi per OTA mese per mese`}>
        <MonthlyVoiceMatrix
          rowLabel="Mese"
          columns={platforms}
          months={platformMatrix.months}
          monthValues={(month) =>
            platformMatrix.months
              .find((item) => item.period.month === month)
              ?.platforms.map((platform) => ({
                id: platform.id,
                total: platform.total,
              })) ?? []
          }
          monthTotal={(month) =>
            platformMatrix.months.find((item) => item.period.month === month)
              ?.income ?? 0
          }
          columnTotals={platformMatrix.platforms}
          valueTone="income"
        />
      </Card>

      <Card title={`${scopeLabel} — spese per voce mese per mese`}>
        <MonthlyVoiceMatrix
          rowLabel="Mese"
          columns={expenseCategories}
          months={categoryMatrix.months}
          monthValues={(month) =>
            categoryMatrix.months
              .find((item) => item.period.month === month)
              ?.categories.map((category) => ({
                id: category.id,
                total: category.total,
              })) ?? []
          }
          monthTotal={(month) =>
            categoryMatrix.months.find((item) => item.period.month === month)
              ?.expenses ?? 0
          }
          columnTotals={categoryMatrix.categories}
          valueTone="expense"
        />
      </Card>
    </div>
  );
}
