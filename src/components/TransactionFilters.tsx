"use client";

import { MONTH_LABELS } from "@/lib/constants";
import {
  EMPTY_FILTERS,
  type TransactionFilters as Filters,
} from "@/lib/filters";
import type { Property } from "@/lib/types";
import { Button, Field, Input, Select } from "./ui";

export function TransactionFilters({
  properties,
  filters,
  onChange,
}: {
  properties: Property[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Field label="Mese">
        <Select
          value={String(filters.month)}
          onChange={(event) => {
            const value = event.target.value;
            onChange({
              ...filters,
              month: value === "all" ? "all" : Number(value),
            });
          }}
        >
          <option value="all">Tutti i mesi</option>
          {MONTH_LABELS.map((month, index) => (
            <option key={month} value={index + 1}>
              {month}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Appartamento">
        <Select
          value={filters.propertyId}
          onChange={(event) =>
            onChange({ ...filters, propertyId: event.target.value })
          }
        >
          <option value="all">Tutti</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Cerca">
        <Input
          value={filters.search}
          onChange={(event) =>
            onChange({ ...filters, search: event.target.value })
          }
          placeholder="Descrizione o note"
        />
      </Field>

      <div className="flex items-end">
        <Button variant="secondary" onClick={() => onChange(EMPTY_FILTERS)}>
          Reset filtri
        </Button>
      </div>
    </div>
  );
}
