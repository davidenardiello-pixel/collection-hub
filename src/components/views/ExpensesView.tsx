"use client";

import { useMemo, useState } from "react";
import {
  formatDate,
  formatCurrency,
  getCategoryMonthlyMatrix,
  getPeriodFromDate,
  groupExpensesByCategory,
  sumExpenses,
} from "@/lib/calculations";
import { isAutomatedExpense } from "@/lib/automation";
import { isLinkedCommissionExpense } from "@/lib/booking-commission";
import { isLinkedVatExpense } from "@/lib/booking-vat";
import { CHART_COLORS } from "@/lib/brand";
import { FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import {
  describeActiveFilters,
  EMPTY_FILTERS,
  filterExpenses,
  groupByPropertyAndMonth,
} from "@/lib/filters";
import type { PurgePreview, PurgeScope } from "@/lib/purge";
import type { Expense, ExpenseCategory, Property, Booking } from "@/lib/types";
import { ExpenseForm } from "../ExpenseForm";
import { MonthPropertyPurgeAction } from "../MonthPropertyPurgeAction";
import { TransactionFilters } from "../TransactionFilters";
import {
  BarChart,
  Button,
  Card,
  DataRow,
  DataTable,
  EmptyState,
  Money,
} from "../ui";

export function ExpensesView({
  expenses,
  bookings,
  properties,
  expenseCategories,
  onAdd,
  onUpdate,
  onDuplicate,
  onRemove,
  onClearTransactions,
}: {
  expenses: Expense[];
  bookings: Booking[];
  properties: Property[];
  expenseCategories: ExpenseCategory[];
  onAdd: (expense: Omit<Expense, "id">) => void;
  onUpdate: (id: string, expense: Omit<Expense, "id">) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onClearTransactions: (scope: PurgeScope) => PurgePreview;
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Expense | null>(null);

  const propertyMap = Object.fromEntries(
    properties.map((property) => [property.id, property.name]),
  );
  const categoryMap = Object.fromEntries(
    expenseCategories.map((category) => [category.id, category.name]),
  );

  const filteredExpenses = useMemo(
    () => filterExpenses(expenses, filters),
    [expenses, filters],
  );

  const matrix = getCategoryMonthlyMatrix(filteredExpenses, expenseCategories);
  const categories = groupExpensesByCategory(filteredExpenses, expenseCategories);
  const filteredTotal = sumExpenses(filteredExpenses);
  const activeFilterLabels = describeActiveFilters(filters, {
    properties: propertyMap,
    categories: categoryMap,
  });
  const propertyMonthGroups = useMemo(
    () =>
      groupByPropertyAndMonth(
        filteredExpenses,
        (expense) => expense.propertyId,
        (expense) => [getPeriodFromDate(expense.date).month],
        propertyMap,
        (items) =>
          [...items].sort((left, right) => left.date.localeCompare(right.date)),
      ),
    [filteredExpenses, propertyMap],
  );
  const showPropertySections = filters.propertyId === "all";
  const showMonthSections = filters.month === "all";

  return (
    <div className="space-y-6">
      <Card
        title={`Spese per appartamento · FY${FISCAL_YEAR}`}
        subtitle={
          activeFilterLabels.length > 0
            ? `Filtrata: ${activeFilterLabels.join(" · ")}`
            : "Ordinate per appartamento e mese"
        }
      >
        {filteredExpenses.length === 0 ? (
          <EmptyState
            message={
              expenses.length === 0
                ? "Nessuna spesa inserita."
                : "Nessuna spesa corrisponde ai filtri."
            }
          />
        ) : (
          <div className="space-y-10">
            {propertyMonthGroups.map((propertyGroup) => (
              <div key={propertyGroup.propertyId} className="space-y-6">
                {showPropertySections ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rc-gold/30 pb-2">
                    <h3 className="font-[family-name:var(--font-cormorant)] text-xl font-semibold text-rc-gold-light">
                      {propertyGroup.name}
                    </h3>
                    <p className="text-sm text-rc-muted">
                      {propertyGroup.months.reduce(
                        (count, month) => count + month.items.length,
                        0,
                      )}{" "}
                      spese ·{" "}
                      {formatCurrency(
                        sumExpenses(
                          propertyGroup.months.flatMap((month) => month.items),
                        ),
                      )}
                    </p>
                  </div>
                ) : null}

                {propertyGroup.months.map((monthGroup) => (
                  <div key={`${propertyGroup.propertyId}-${monthGroup.month}`}>
                    {showMonthSections ? (
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-rc-ink">
                          {monthGroup.label}
                        </h4>
                        <p className="text-sm text-rc-muted">
                          {monthGroup.items.length} spese ·{" "}
                          {formatCurrency(sumExpenses(monthGroup.items))}
                        </p>
                      </div>
                    ) : null}

                    <DataTable
                      headers={[
                        "Data",
                        ...(showPropertySections ? [] : ["Proprietà"]),
                        ...(showMonthSections ? [] : ["Mese"]),
                        "Categoria",
                        "Oggetto",
                        "Importo",
                        "",
                      ]}
                    >
                      {monthGroup.items.map((expense) => {
                        const linkedToBooking =
                          isLinkedCommissionExpense(expense) ||
                          isLinkedVatExpense(expense);

                        return (
                          <DataRow key={expense.id}>
                            <td className="px-2 py-2">
                              {formatDate(expense.date)}
                            </td>
                            {showPropertySections ? null : (
                              <td className="px-2 py-2">
                                {propertyMap[expense.propertyId] ??
                                  expense.propertyId}
                              </td>
                            )}
                            {showMonthSections ? null : (
                              <td className="px-2 py-2">
                                {MONTH_LABELS[
                                  getPeriodFromDate(expense.date).month - 1
                                ] ?? "—"}
                              </td>
                            )}
                            <td className="px-2 py-2">
                              {categoryMap[expense.categoryId] ??
                                expense.categoryId}
                            </td>
                            <td className="px-2 py-2">
                              <span className="inline-flex flex-wrap items-center gap-2">
                                {expense.description}
                                {isAutomatedExpense(expense) ? (
                                  <span className="rounded-full border border-rc-gold/30 bg-rc-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rc-gold-light">
                                    Auto
                                  </span>
                                ) : null}
                                {isLinkedVatExpense(expense) ? (
                                  <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                                    IVA auto
                                  </span>
                                ) : null}
                                {isLinkedCommissionExpense(expense) ? (
                                  <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                                    Da incasso
                                  </span>
                                ) : null}
                              </span>
                            </td>
                            <td className="px-2 py-2 font-medium">
                              <Money value={expense.amount} />
                            </td>
                            <td className="px-2 py-2">
                              {linkedToBooking ? (
                                <span className="text-xs text-rc-muted">
                                  Modifica dall&apos;incasso collegato
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  <Button
                                    variant="secondary"
                                    onClick={() => setEditing(expense)}
                                  >
                                    Modifica
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    onClick={() => onDuplicate(expense.id)}
                                  >
                                    Duplica
                                  </Button>
                                  <Button
                                    variant="danger"
                                    onClick={() => onRemove(expense.id)}
                                  >
                                    Elimina
                                  </Button>
                                </div>
                              )}
                            </td>
                          </DataRow>
                        );
                      })}
                    </DataTable>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>

      <ExpenseForm
        key={editing?.id ?? "new"}
        properties={properties}
        expenseCategories={expenseCategories}
        editing={editing}
        onSubmit={(expense) => {
          if (editing) {
            onUpdate(editing.id, expense);
            setEditing(null);
          } else {
            onAdd(expense);
          }
        }}
        onCancelEdit={() => setEditing(null)}
      />

      <Card title="Filtra spese">
        <p className="mb-4 text-sm text-rc-muted">
          Restringi per appartamento, mese, categoria o testo. Grafico e matrice
          seguono gli stessi filtri.
        </p>
        <TransactionFilters
          properties={properties}
          expenseCategories={expenseCategories}
          filters={filters}
          onChange={setFilters}
        />
        <div className="mt-4 rounded-xl border border-rc-gold/20 bg-rc-charcoal/40 px-4 py-3 text-sm text-rc-muted">
          <strong className="text-rc-ink">{filteredExpenses.length}</strong> di{" "}
          {expenses.length} spese · Totale{" "}
          <span className="font-semibold text-rc-gold-light">
            {formatCurrency(filteredTotal)}
          </span>
          {activeFilterLabels.length > 0 ? (
            <span> · {activeFilterLabels.join(" · ")}</span>
          ) : null}
        </div>
        <MonthPropertyPurgeAction
          filters={filters}
          bookings={bookings}
          expenses={expenses}
          propertyName={
            filters.propertyId === "all"
              ? ""
              : (propertyMap[filters.propertyId] ?? filters.propertyId)
          }
          onPurge={onClearTransactions}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Composizione spese"
          subtitle={
            activeFilterLabels.length > 0
              ? activeFilterLabels.join(" · ")
              : undefined
          }
        >
          <BarChart
            items={categories.map((category) => ({
              label: category.name,
              value: category.total,
              color: CHART_COLORS.category,
            }))}
          />
        </Card>

        <Card title="Matrice spese per categoria">
          <DataTable
            headers={[
              "Categoria",
              ...MONTH_LABELS.map((month) => month.slice(0, 3)),
              "Totale",
            ]}
          >
            {matrix.map((row) => (
              <DataRow key={row.id}>
                <td className="px-2 py-2 font-medium">{row.name}</td>
                {row.months.map((month) => (
                  <td key={month.period.month} className="px-2 py-2">
                    {month.total > 0 ? <Money value={month.total} /> : "—"}
                  </td>
                ))}
                <td className="px-2 py-2 font-semibold">
                  <Money value={row.total} />
                </td>
              </DataRow>
            ))}
          </DataTable>
        </Card>
      </div>
    </div>
  );
}
