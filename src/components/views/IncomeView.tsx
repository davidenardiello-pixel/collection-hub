"use client";

import { useMemo, useState } from "react";
import {
  formatDate,
  formatCurrency,
  getBookingNetIncome,
  getBookingNights,
  getBookingTotal,
  getPlatformMonthlyMatrix,
  sumBookings,
} from "@/lib/calculations";
import { FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import {
  describeActiveFilters,
  EMPTY_FILTERS,
  filterBookings,
  groupByProperty,
} from "@/lib/filters";
import type { PurgePreview, PurgeScope } from "@/lib/purge";
import type { Booking, Expense, Platform, Property } from "@/lib/types";
import { BookingForm } from "../BookingForm";
import { MonthPropertyPurgeAction } from "../MonthPropertyPurgeAction";
import { TransactionFilters } from "../TransactionFilters";
import { Button, Card, DataRow, DataTable, EmptyState, Money } from "../ui";

export function IncomeView({
  bookings,
  expenses,
  properties,
  platforms,
  onAdd,
  onUpdate,
  onDuplicate,
  onRemove,
  onClearTransactions,
}: {
  bookings: Booking[];
  expenses: Expense[];
  properties: Property[];
  platforms: Platform[];
  onAdd: (booking: Omit<Booking, "id">) => void;
  onUpdate: (id: string, booking: Omit<Booking, "id">) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onClearTransactions: (scope: PurgeScope) => PurgePreview;
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Booking | null>(null);

  const propertyMap = Object.fromEntries(
    properties.map((property) => [property.id, property.name]),
  );
  const platformMap = Object.fromEntries(
    platforms.map((platform) => [platform.id, platform.name]),
  );

  const filteredBookings = useMemo(
    () => filterBookings(bookings, filters),
    [bookings, filters],
  );

  const matrix = getPlatformMonthlyMatrix(filteredBookings, platforms);
  const filteredTotal = sumBookings(filteredBookings);
  const activeFilterLabels = describeActiveFilters(filters, {
    properties: propertyMap,
    platforms: platformMap,
  });
  const groupedBookings = useMemo(
    () =>
      groupByProperty(
        filteredBookings,
        (booking) => booking.propertyId,
        propertyMap,
      ),
    [filteredBookings, propertyMap],
  );
  const showPropertySections = filters.propertyId === "all" && groupedBookings.length > 1;

  return (
    <div className="space-y-6">
      <Card title="Filtra incassi">
        <p className="mb-4 text-sm text-rc-muted">
          Restringi la lista per appartamento, mese, piattaforma o testo. La
          matrice sotto segue gli stessi filtri.
        </p>
        <TransactionFilters
          properties={properties}
          platforms={platforms}
          filters={filters}
          onChange={setFilters}
        />
        <div className="mt-4 rounded-xl border border-rc-gold/20 bg-rc-charcoal/40 px-4 py-3 text-sm text-rc-muted">
          <strong className="text-rc-ink">{filteredBookings.length}</strong> di{" "}
          {bookings.length} prenotazioni · Totale lordo{" "}
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

      <BookingForm
        key={editing?.id ?? "new"}
        properties={properties}
        platforms={platforms}
        editing={editing}
        onSubmit={(booking) => {
          if (editing) {
            onUpdate(editing.id, booking);
            setEditing(null);
          } else {
            onAdd(booking);
          }
        }}
        onCancelEdit={() => setEditing(null)}
      />

      <Card
        title="Matrice incassi per piattaforma"
        subtitle={
          activeFilterLabels.length > 0
            ? `Filtrata: ${activeFilterLabels.join(" · ")}`
            : `Tutti gli incassi FY${FISCAL_YEAR}`
        }
      >
        <DataTable
          headers={[
            "Piattaforma",
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

      <Card title={`Prenotazioni FY${FISCAL_YEAR}`}>
        {filteredBookings.length === 0 ? (
          <EmptyState
            message={
              bookings.length === 0
                ? "Nessuna prenotazione inserita."
                : "Nessuna prenotazione corrisponde ai filtri."
            }
          />
        ) : (
          <div className="space-y-8">
            {groupedBookings.map((group) => (
              <div key={group.propertyId} className="space-y-3">
                {showPropertySections ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rc-gold/25 pb-2">
                    <h3 className="font-[family-name:var(--font-cormorant)] text-lg font-semibold text-rc-gold-light">
                      {group.name}
                    </h3>
                    <p className="text-sm text-rc-muted">
                      {group.items.length} prenotazioni ·{" "}
                      {formatCurrency(sumBookings(group.items))}
                    </p>
                  </div>
                ) : null}

                <DataTable
                  headers={[
                    "Prenotazione",
                    ...(showPropertySections ? [] : ["Proprietà"]),
                    "Piattaforma",
                    "Check-in",
                    "Check-out",
                    "Notti",
                    "Lordo",
                    "Commissione",
                    "Netto",
                    "Totale",
                    "",
                  ]}
                >
                  {group.items.map((booking) => (
                    <DataRow key={booking.id}>
                      <td className="px-2 py-2">{booking.description}</td>
                      {showPropertySections ? null : (
                        <td className="px-2 py-2">
                          {propertyMap[booking.propertyId] ?? booking.propertyId}
                        </td>
                      )}
                      <td className="px-2 py-2">
                        {platformMap[booking.platformId] ?? booking.platformId}
                      </td>
                      <td className="px-2 py-2">{formatDate(booking.checkIn)}</td>
                      <td className="px-2 py-2">{formatDate(booking.checkOut)}</td>
                      <td className="px-2 py-2">{getBookingNights(booking)}</td>
                      <td className="px-2 py-2">
                        <Money value={booking.grossIncome} />
                      </td>
                      <td className="px-2 py-2">
                        <Money value={booking.otaCommission ?? 0} />
                      </td>
                      <td className="px-2 py-2">
                        <Money value={getBookingNetIncome(booking)} />
                      </td>
                      <td className="px-2 py-2 font-medium">
                        <Money value={getBookingTotal(booking)} />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="secondary"
                            onClick={() => setEditing(booking)}
                          >
                            Modifica
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => onDuplicate(booking.id)}
                          >
                            Duplica
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() => onRemove(booking.id)}
                          >
                            Elimina
                          </Button>
                        </div>
                      </td>
                    </DataRow>
                  ))}
                </DataTable>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
