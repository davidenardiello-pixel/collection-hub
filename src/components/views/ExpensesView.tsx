"use client";

import { useMemo, useState } from "react";
import {
  formatDate,
  getCategoryMonthlyMatrix,
  groupExpensesByCategory,
} from "@/lib/calculations";
import { isAutomatedExpense } from "@/lib/automation";
import { isLinkedCommissionExpense } from "@/lib/booking-commission";
import { isLinkedVatExpense } from "@/lib/booking-vat";
import { CHART_COLORS } from "@/lib/brand";
import { FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import { EMPTY_FILTERS, filterExpenses } from "@/lib/filters";
import type { Expense, ExpenseCategory, Property } from "@/lib/types";
import { ExpenseForm } from "../ExpenseForm";
import { TransactionFilters } from "../TransactionFilters";
import { BarChart, Button, Card, DataRow, DataTable, EmptyState, Money } from "../ui";

export function ExpensesView({
  expenses,
  properties,
  expenseCategories,
  onAdd,
  onUpdate,
  onDuplicate,
  onRemove,
}: {
  expenses: Expense[];
  properties: Property[];
  expenseCategories: ExpenseCategory[];
  onAdd: (expense: Omit<Expense, "id">) => void;
  onUpdate: (id: string, expense: Omit<Expense, "id">) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Expense | null>(null);

  const filteredExpenses = useMemo(
    () => filterExpenses(expenses, filters),
    [expenses, filters],
  );

  const matrix = getCategoryMonthlyMatrix(expenses, expenseCategories);
  const categories = groupExpensesByCategory(expenses, expenseCategories);
  const propertyMap = Object.fromEntries(
    properties.map((property) => [property.id, property.name]),
  );
  const categoryMap = Object.fromEntries(
    expenseCategories.map((category) => [category.id, category.name]),
  );

  return (
    <div className="space-y-6">
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

      <Card title="Filtri spese">
        <TransactionFilters
          properties={properties}
          filters={filters}
          onChange={setFilters}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Composizione spese">
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

      <Card
        title={`Spese FY${FISCAL_YEAR}`}
        subtitle={
          filteredExpenses.length !== expenses.length
            ? `${filteredExpenses.length} di ${expenses.length} visibili`
            : undefined
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
          <DataTable
            headers={[
              "Data",
              "Proprietà",
              "Categoria",
              "Oggetto",
              "Importo",
              "",
            ]}
          >
                {filteredExpenses.map((expense) => {
                  const linkedToBooking =
                    isLinkedCommissionExpense(expense) ||
                    isLinkedVatExpense(expense);

                  return (
                  <DataRow key={expense.id}>
                    <td className="px-2 py-2">{formatDate(expense.date)}</td>
                    <td className="px-2 py-2">
                      {propertyMap[expense.propertyId] ?? expense.propertyId}
                    </td>
                    <td className="px-2 py-2">
                      {categoryMap[expense.categoryId] ?? expense.categoryId}
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
        )}
      </Card>
    </div>
  );
}
