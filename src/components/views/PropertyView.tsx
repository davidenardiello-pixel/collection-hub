"use client";

import { useMemo, useState } from "react";
import {
  formatCurrency,
  formatPercent,
  getPropertyMonthlyCategoryMatrix,
  getPropertyMonthlyPlatformMatrix,
  getPropertySummary,
  getScopedCategoryBreakdown,
  getScopedPlatformBreakdown,
} from "@/lib/calculations";
import { CHART_COLORS } from "@/lib/brand";
import type {
  Booking,
  Expense,
  ExpenseCategory,
  Platform,
  Property,
} from "@/lib/types";
import { MonthlyTrendChart, RingGauge } from "../charts";
import {
  MonthlyVoiceMatrix,
  VoiceListTable,
} from "../VoiceBreakdown";
import { Card, DataRow, DataTable, KpiCard, Money, TabPill } from "../ui";

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
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    properties[0]?.id ?? "",
  );

  const activePropertyId =
    properties.find((property) => property.id === selectedPropertyId)?.id ??
    properties[0]?.id ??
    "";

  const summary = useMemo(
    () =>
      getPropertySummary(
        activePropertyId,
        bookings,
        expenses,
        properties,
        expenseCategories,
        platforms,
      ),
    [activePropertyId, bookings, expenses, properties, expenseCategories, platforms],
  );

  const annualPlatforms = useMemo(
    () =>
      getScopedPlatformBreakdown(
        bookings,
        platforms,
        undefined,
        activePropertyId,
      ),
    [activePropertyId, bookings, platforms],
  );

  const annualCategories = useMemo(
    () =>
      getScopedCategoryBreakdown(
        expenses,
        expenseCategories,
        undefined,
        activePropertyId,
      ),
    [activePropertyId, expenseCategories, expenses],
  );

  const platformMatrix = useMemo(
    () =>
      getPropertyMonthlyPlatformMatrix(activePropertyId, bookings, platforms),
    [activePropertyId, bookings, platforms],
  );

  const categoryMatrix = useMemo(
    () =>
      getPropertyMonthlyCategoryMatrix(
        activePropertyId,
        expenses,
        expenseCategories,
      ),
    [activePropertyId, expenseCategories, expenses],
  );

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
        <div className="flex flex-wrap gap-2">
          {properties.map((property) => (
            <TabPill
              key={property.id}
              active={activePropertyId === property.id}
              onClick={() => setSelectedPropertyId(property.id)}
            >
              {property.name}
            </TabPill>
          ))}
        </div>
      </Card>

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
            summary.property
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
        <Card title={`${summary.property?.name ?? "Proprietà"} — incassi per OTA (anno)`}>
          <VoiceListTable
            title="OTA"
            description="Ricavi annuali suddivisi per tipo di prenotazione."
            headers={["OTA", "Importo", "Quota"]}
            rows={annualPlatforms}
            total={summary.income}
          />
        </Card>

        <Card title={`${summary.property?.name ?? "Proprietà"} — spese per voce (anno)`}>
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

      <Card title={`${summary.property?.name ?? "Proprietà"} — incassi per OTA mese per mese`}>
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

      <Card title={`${summary.property?.name ?? "Proprietà"} — spese per voce mese per mese`}>
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
