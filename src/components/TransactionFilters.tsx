"use client";

import { MONTH_LABELS, PROPERTY_CITIES } from "@/lib/constants";
import {
  EMPTY_FILTERS,
  type TransactionFilters as Filters,
} from "@/lib/filters";
import {
  filterPropertiesByCity,
  groupPropertiesByCity,
} from "@/lib/property-cities";
import type { ExpenseCategory, Platform, Property } from "@/lib/types";
import { Button, Field, Input, Select } from "./ui";

export function TransactionFilters({
  properties,
  filters,
  onChange,
  expenseCategories,
  platforms,
}: {
  properties: Property[];
  filters: Filters;
  onChange: (filters: Filters) => void;
  expenseCategories?: ExpenseCategory[];
  platforms?: Platform[];
}) {
  const visibleProperties = filterPropertiesByCity(properties, filters.city);
  const groupedProperties = groupPropertiesByCity(visibleProperties);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
      <Field label="Città">
        <Select
          value={filters.city}
          onChange={(event) => {
            const city = event.target.value as Filters["city"];
            onChange({
              ...filters,
              city,
              propertyId:
                filters.propertyId !== "all" &&
                !filterPropertiesByCity(properties, city).some(
                  (property) => property.id === filters.propertyId,
                )
                  ? "all"
                  : filters.propertyId,
            });
          }}
        >
          <option value="all">Tutte le città</option>
          {PROPERTY_CITIES.map((city) => (
            <option key={city.id} value={city.id}>
              {city.label}
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
          <option value="all">Tutti gli appartamenti</option>
          {filters.city === "all"
            ? groupedProperties.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </optgroup>
              ))
            : visibleProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
        </Select>
      </Field>

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

      {expenseCategories ? (
        <Field label="Categoria">
          <Select
            value={filters.categoryId}
            onChange={(event) =>
              onChange({ ...filters, categoryId: event.target.value })
            }
          >
            <option value="all">Tutte le categorie</option>
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {platforms ? (
        <Field label="Piattaforma">
          <Select
            value={filters.platformId}
            onChange={(event) =>
              onChange({ ...filters, platformId: event.target.value })
            }
          >
            <option value="all">Tutte le piattaforme</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="Cerca testo">
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
