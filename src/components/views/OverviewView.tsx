import {
  formatCurrency,
  formatPercent,
  getAnnualSummary,
  getMonthlySummaries,
  groupBookingsByPlatform,
  groupExpensesByCategory,
} from "@/lib/calculations";
import { CHART_COLORS } from "@/lib/brand";
import { FISCAL_YEAR } from "@/lib/constants";
import type { Booking, Expense, ExpenseCategory, Platform } from "@/lib/types";
import { DonutChart, MonthlyTrendChart, RingGauge } from "../charts";
import { BarChart, Card, DataRow, DataTable, KpiCard, Money } from "../ui";

export function OverviewView({
  bookings,
  expenses,
  expenseCategories,
  platforms,
  profitTargets,
}: {
  bookings: Booking[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  platforms: Platform[];
  profitTargets: number[];
}) {
  const annual = getAnnualSummary(bookings, expenses, profitTargets);
  const months = getMonthlySummaries(bookings, expenses, profitTargets);
  const platformTotals = groupBookingsByPlatform(bookings, platforms);
  const categories = groupExpensesByCategory(
    expenses,
    expenseCategories,
  ).slice(0, 6);

  const incomeTrend = months.map((month) => month.income);
  const expenseTrend = months.map((month) => month.expenses);
  const profitTrend = months.map((month) => month.profit);
  const targetTrend = months.map((month) => month.target);
  const targetProgress =
    annual.ytdTarget > 0
      ? Math.max(0, annual.ytdProfit) / annual.ytdTarget
      : 0;
  const projectionProgress =
    annual.totalTarget > 0
      ? Math.max(0, annual.projectedProfit) / annual.totalTarget
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Incassi lordi"
          value={formatCurrency(annual.income)}
          hint={`Media mensile ${formatCurrency(annual.avgMonthlyIncome)}`}
          tone="income"
          sparkline={incomeTrend}
          sparklineColor={CHART_COLORS.income}
        />
        <KpiCard
          label="Spese totali"
          value={formatCurrency(annual.expenses)}
          hint={`Media mensile ${formatCurrency(annual.avgMonthlyExpenses)}`}
          tone="expense"
          sparkline={expenseTrend}
          sparklineColor={CHART_COLORS.expense}
        />
        <KpiCard
          label="Profitto YTD"
          value={formatCurrency(annual.ytdProfit)}
          hint={
            annual.elapsedMonths > 0
              ? `Gen–${months[annual.elapsedMonths - 1]?.label ?? "—"} · media ${formatCurrency(annual.ytdProfit / annual.elapsedMonths)}`
              : `Media mensile ${formatCurrency(annual.avgMonthlyProfit)}`
          }
          tone={annual.ytdProfit >= 0 ? "positive" : "negative"}
          sparkline={profitTrend.slice(0, annual.elapsedMonths)}
        />
        <KpiCard
          label="Obiettivo YTD"
          value={formatCurrency(annual.ytdTarget)}
          hint={
            annual.ytdTarget > 0
              ? `Gap ${formatCurrency(annual.ytdTargetGap)} su ${annual.elapsedMonths} mesi`
              : "Imposta obiettivi in Impostazioni"
          }
          tone={
            annual.ytdTarget > 0
              ? annual.ytdTargetGap >= 0
                ? "positive"
                : "negative"
              : "neutral"
          }
          sparkline={targetTrend.slice(0, annual.elapsedMonths)}
          progress={annual.ytdProfit}
          progressMax={annual.ytdTarget}
          progressLabel="Profitto YTD vs obiettivo YTD"
        />
        <KpiCard
          label="Proiezione fine anno"
          value={formatCurrency(annual.projectedProfit)}
          hint={
            annual.totalTarget > 0
              ? `Run-rate · gap annuo ${formatCurrency(annual.projectedTargetGap)}`
              : "Estrapolazione dal trend YTD"
          }
          tone={
            annual.projectedProfit >= 0
              ? annual.projectedTargetGap >= 0
                ? "positive"
                : "negative"
              : "negative"
          }
          progress={annual.projectedProfit}
          progressMax={annual.totalTarget}
          progressLabel="Proiezione vs obiettivo annuo"
        />
        <KpiCard
          label="Margine"
          value={formatPercent(annual.margin)}
          hint={`${annual.nights} notti prenotate`}
          tone="neutral"
          progress={annual.margin}
          progressMax={1}
          progressLabel="Margine operativo"
          sparklineColor={CHART_COLORS.income}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Composizione economica">
          <DonutChart
            segments={[
              {
                label: "Incassi YTD",
                value: annual.ytdIncome,
                color: CHART_COLORS.income,
              },
              {
                label: "Spese YTD",
                value: annual.ytdExpenses,
                color: CHART_COLORS.expense,
              },
            ]}
            centerLabel={formatCurrency(annual.ytdProfit)}
            centerSub="Profitto YTD"
          />
        </Card>

        <Card title="Indicatori chiave">
          <div className="flex flex-wrap items-center justify-around gap-6 py-2">
            <RingGauge
              value={annual.margin}
              label="Margine"
              sublabel="Su incassi lordi"
              color={CHART_COLORS.income}
            />
            <RingGauge
              value={targetProgress}
              max={1}
              label="Obiettivo YTD"
              sublabel={
                annual.ytdTarget > 0
                  ? `${formatPercent(targetProgress)} raggiunto`
                  : "Non impostato"
              }
              color={
                annual.ytdTargetGap >= 0
                  ? CHART_COLORS.profit
                  : CHART_COLORS.loss
              }
            />
            <RingGauge
              value={projectionProgress}
              max={1}
              label="Proiezione"
              sublabel={
                annual.totalTarget > 0
                  ? `${formatPercent(projectionProgress)} obiettivo annuo`
                  : "Estrapolazione YTD"
              }
              color={
                annual.projectedTargetGap >= 0
                  ? CHART_COLORS.profit
                  : CHART_COLORS.loss
              }
            />
            <RingGauge
              value={annual.monthsWithData}
              max={12}
              label="Copertura"
              sublabel={`${annual.monthsWithData}/12 mesi con dati`}
              format="number"
              color={CHART_COLORS.platform}
            />
          </div>
        </Card>

        <Card title="Trend incassi · spese · profitto">
          <MonthlyTrendChart months={months} />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={`Trend mensile FY${FISCAL_YEAR}`}>
          <DataTable
            headers={[
              "Mese",
              "Incassi",
              "Spese",
              "Profitto",
              "Obiettivo",
              "Gap",
              "Margine",
            ]}
          >
            {months.map((month) => (
              <DataRow key={month.label}>
                <td className="px-2 py-2 font-medium">{month.label}</td>
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
                  {month.target > 0 ? <Money value={month.target} /> : "—"}
                </td>
                <td
                  className={`px-2 py-2 ${
                    month.target > 0
                      ? month.targetGap >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                      : ""
                  }`}
                >
                  {month.target > 0 ? (
                    <Money value={month.targetGap} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-2">{formatPercent(month.margin)}</td>
              </DataRow>
            ))}
          </DataTable>
        </Card>

        <Card title="Profitto mensile">
          <BarChart
            items={months
              .filter((month) => month.income > 0 || month.expenses > 0)
              .map((month) => ({
                label: month.label,
                value: month.profit,
                color:
                  month.profit >= 0 ? CHART_COLORS.profit : CHART_COLORS.loss,
              }))}
          />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Incassi per piattaforma">
          <BarChart
            items={platformTotals.map((platform) => ({
              label: platform.name,
              value: platform.total,
              color: CHART_COLORS.platform,
            }))}
          />
        </Card>

        <Card title="Spese per categoria">
          <BarChart
            items={categories.map((category) => ({
              label: category.name,
              value: category.total,
              color: CHART_COLORS.category,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
