"use client";

import { useMemo, useState } from "react";
import {
  formatDate,
  getBookingNetIncome,
  getBookingNights,
  getBookingTotal,
  getPlatformMonthlyMatrix,
} from "@/lib/calculations";
import { FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import { EMPTY_FILTERS, filterBookings } from "@/lib/filters";
import type { Booking, Platform, Property } from "@/lib/types";
import { BookingForm } from "../BookingForm";
import { TransactionFilters } from "../TransactionFilters";
import { Button, Card, DataRow, DataTable, EmptyState, Money } from "../ui";

export function IncomeView({
  bookings,
  properties,
  platforms,
  onAdd,
  onUpdate,
  onDuplicate,
  onRemove,
}: {
  bookings: Booking[];
  properties: Property[];
  platforms: Platform[];
  onAdd: (booking: Omit<Booking, "id">) => void;
  onUpdate: (id: string, booking: Omit<Booking, "id">) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Booking | null>(null);

  const filteredBookings = useMemo(
    () => filterBookings(bookings, filters),
    [bookings, filters],
  );

  const matrix = getPlatformMonthlyMatrix(bookings, platforms);
  const propertyMap = Object.fromEntries(
    properties.map((property) => [property.id, property.name]),
  );
  const platformMap = Object.fromEntries(
    platforms.map((platform) => [platform.id, platform.name]),
  );

  return (
    <div className="space-y-6">
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

      <Card title="Filtri prenotazioni">
        <TransactionFilters
          properties={properties}
          filters={filters}
          onChange={setFilters}
        />
      </Card>

      <Card title="Matrice incassi per piattaforma">
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

      <Card
        title={`Prenotazioni FY${FISCAL_YEAR}`}
        subtitle={
          filteredBookings.length !== bookings.length
            ? `${filteredBookings.length} di ${bookings.length} visibili`
            : undefined
        }
      >
        {filteredBookings.length === 0 ? (
          <EmptyState
            message={
              bookings.length === 0
                ? "Nessuna prenotazione inserita."
                : "Nessuna prenotazione corrisponde ai filtri."
            }
          />
        ) : (
          <DataTable
            headers={[
              "Prenotazione",
              "Proprietà",
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
                {filteredBookings.map((booking) => (
                  <DataRow key={booking.id}>
                    <td className="px-2 py-2">{booking.description}</td>
                    <td className="px-2 py-2">
                      {propertyMap[booking.propertyId] ?? booking.propertyId}
                    </td>
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
        )}
      </Card>
    </div>
  );
}
