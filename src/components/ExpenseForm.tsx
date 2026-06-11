"use client";

import { useState } from "react";
import { isLinkedCommissionExpense } from "@/lib/booking-commission";
import { isLinkedVatExpense } from "@/lib/booking-vat";
import type { Expense, ExpenseCategory, Property } from "@/lib/types";
import { Button, Card, Field, Input, Select } from "./ui";

export function ExpenseForm({
  properties,
  expenseCategories,
  editing,
  onSubmit,
  onCancelEdit,
}: {
  properties: Property[];
  expenseCategories: ExpenseCategory[];
  editing?: Expense | null;
  onSubmit: (expense: Omit<Expense, "id">) => void;
  onCancelEdit?: () => void;
}) {
  const [date, setDate] = useState(editing?.date ?? "2026-01-30");
  const [propertyId, setPropertyId] = useState(
    editing?.propertyId ?? properties[0]?.id ?? "",
  );
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ?? expenseCategories[0]?.id ?? "",
  );
  const [description, setDescription] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const value = Number(amount);
    if (
      !date ||
      !propertyId ||
      !categoryId ||
      !description.trim() ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      return;
    }

    onSubmit({
      date,
      propertyId,
      categoryId,
      description: description.trim(),
      amount: value,
      notes: notes.trim() || undefined,
    });

    if (!editing) {
      setDescription("");
      setAmount("");
      setNotes("");
    }
  }

  if (editing && (isLinkedCommissionExpense(editing) || isLinkedVatExpense(editing))) {
    return (
      <Card title="Spesa collegata a incasso">
        <p className="text-sm text-rc-muted">
          {isLinkedVatExpense(editing)
            ? "Questa IVA è collegata a una prenotazione Booking. Viene ricalcolata automaticamente dal lordo incassato."
            : "Questa commissione OTA è collegata a una prenotazione. Modifica l'importo dalla scheda Incassi aprendo la prenotazione corrispondente."}
        </p>
        {onCancelEdit ? (
          <div className="mt-4">
            <Button type="button" variant="secondary" onClick={onCancelEdit}>
              Chiudi
            </Button>
          </div>
        ) : null}
      </Card>
    );
  }

  if (properties.length === 0 || expenseCategories.length === 0) {
    return (
      <Card title="Spesa">
        <p className="text-sm text-rc-muted">
          Configura almeno un appartamento e una categoria in Impostazioni.
        </p>
      </Card>
    );
  }

  return (
    <Card title={editing ? "Modifica spesa" : "Nuova spesa"}>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <Field label="Data">
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </Field>

        <Field label="Proprietà">
          <Select
            value={propertyId || properties[0].id}
            onChange={(event) => setPropertyId(event.target.value)}
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Categoria">
          <Select
            value={categoryId || expenseCategories[0].id}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Oggetto">
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Es. Corrente, Piero, Affitto"
            required
          />
        </Field>

        <Field label="Importo (€)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            required
          />
        </Field>

        <Field label="Note">
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Opzionale"
          />
        </Field>

        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit">
            {editing ? "Salva modifiche" : "Aggiungi spesa"}
          </Button>
          {editing && onCancelEdit ? (
            <Button type="button" variant="secondary" onClick={onCancelEdit}>
              Annulla
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
