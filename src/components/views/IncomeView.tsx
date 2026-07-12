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
  sumBookingsInPeriod,
} from "@/lib/calculations";
import { getAllocatedBookingAmount } from "@/lib/booking-allocation";
import {
  getBankAccountLabel,
  getIncomeChannelSummary,
  getPropertyBankAccount,
} from "@/lib/bank-accounts";
import { FISCAL_YEAR, MONTH_LABELS } from "@/lib/constants";
import {
  describeActiveFilters,
  EMPTY_FILTERS,
  filterBookings,
  getBookingDisplayMonths,
  groupByPropertyAndMonth,
} from "@/lib/filters";
import type { PurgePreview, PurgeScope } from "@/lib/purge";
import type { Booking, Expense, Platform, Property } from "@/lib/types";
import { BookingForm } from "../BookingForm";
import { IncomeChannelSummaryCard } from "../IncomeChannelSummaryCard";
import { MonthPropertyPurgeAction } from "../MonthPropertyPurgeAction";
import { TransactionFilters } from "../TransactionFilters";
import { Button, Card, DataRow, DataTable, EmptyState, Money } from "../ui";

function uniqueBookings(bookings: Booking[]): Booking[] {
  const byId = new Map<string, Booking>();

  for (const booking of bookings) {
    byId.set(booking.id, booking);
  }

  return Array.from(byId.values());
}

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
  const channelSummary = useMemo(() => {
    const period =
      filters.month === "all"
        ? undefined
        : { year: FISCAL_YEAR, month: filters.month };

    return getIncomeChannelSummary(
      filteredBookings,
      properties,
      platforms,
      period,
    );
  }, [filteredBookings, filters.month, platforms, properties]);
  const activeFilterLabels = describeActiveFilters(filters, {
    properties: propertyMap,
    platforms: platformMap,
  });
  const propertyMonthGroups = useMemo(
    () =>
      groupByPropertyAndMonth(
        filteredBookings,
        (booking) => booking.propertyId,
        getBookingDisplayMonths,
        propertyMap,
        (items) =>
          [...items].sort((left, right) =>
            left.checkIn.localeCompare(right.checkIn),
          ),
      ),
    [filteredBookings, propertyMap],
  );
  const showPropertySections = filters.propertyId === "all";
  const showMonthSections = filters.month === "all";

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

      <Card title="Filtra incassi">
        <p className="mb-4 text-sm text-rc-muted">
          Restringi la vista per appartamento, mese, piattaforma o testo. La
          lista e la matrice seguono gli stessi filtri.
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
          {" · "}
          Netto in banca{" "}
          <span className="font-semibold text-emerald-400">
            {formatCurrency(channelSummary.bankNet)}
          </span>
          {channelSummary.cashTotal > 0 ? (
            <>
              {" · "}
              Contanti{" "}
              <span className="font-semibold text-rc-gold-light">
                {formatCurrency(channelSummary.cashTotal)}
              </span>
            </>
          ) : null}
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

      <IncomeChannelSummaryCard
        summary={channelSummary}
        subtitle={
          activeFilterLabels.length > 0
            ? `Filtrata: ${activeFilterLabels.join(" · ")}`
            : undefined
        }
      />

      <Card
        title={`Incassi per appartamento · FY${FISCAL_YEAR}`}
        subtitle={
          activeFilterLabels.length > 0
            ? `Filtrata: ${activeFilterLabels.join(" · ")}`
            : "Ordinati per appartamento e mese"
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
          <div className="space-y-10">
            {propertyMonthGroups.map((propertyGroup) => (
              <div key={propertyGroup.propertyId} className="space-y-6">
                {showPropertySections ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rc-gold/30 pb-2">
                    <h3 className="font-[family-name:var(--font-cormorant)] text-xl font-semibold text-rc-gold-light">
                      {propertyGroup.name}
                      <span className="ml-2 text-sm font-normal text-rc-muted">
                        ·{" "}
                        {getBankAccountLabel(
                          getPropertyBankAccount(
                            propertyGroup.propertyId,
                            properties,
                          ),
                        )}
                      </span>
                    </h3>
                    <p className="text-sm text-rc-muted">
                      {uniqueBookings(
                        propertyGroup.months.flatMap((month) => month.items),
                      ).length}{" "}
                      prenotazioni ·{" "}
                      {formatCurrency(
                        sumBookings(
                          uniqueBookings(
                            propertyGroup.months.flatMap(
                              (month) => month.items,
                            ),
                          ),
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
                          {monthGroup.items.length} prenotazioni ·{" "}
                          {formatCurrency(
                            sumBookingsInPeriod(monthGroup.items, {
                              year: FISCAL_YEAR,
                              month: monthGroup.month,
                            }),
                          )}
                        </p>
                      </div>
                    ) : null}

                    <DataTable
                      headers={[
                        "Prenotazione",
                        ...(showPropertySections ? [] : ["Proprietà"]),
                        ...(showMonthSections ? [] : ["Mese"]),
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
                      {monthGroup.items.map((booking) => {
                        const period = {
                          year: FISCAL_YEAR,
                          month: monthGroup.month,
                        };

                        return (
                        <DataRow key={`${monthGroup.month}-${booking.id}`}>
                          <td className="px-2 py-2">{booking.description}</td>
                          {showPropertySections ? null : (
                            <td className="px-2 py-2">
                              {propertyMap[booking.propertyId] ??
                                booking.propertyId}
                            </td>
                          )}
                          {showMonthSections ? null : (
                            <td className="px-2 py-2">
                              {MONTH_LABELS[
                                getBookingDisplayMonths(booking)[0] - 1
                              ] ?? "—"}
                            </td>
                          )}
                          <td className="px-2 py-2">
                            {platformMap[booking.platformId] ??
                              booking.platformId}
                          </td>
                          <td className="px-2 py-2">
                            {formatDate(booking.checkIn)}
                          </td>
                          <td className="px-2 py-2">
                            {formatDate(booking.checkOut)}
                          </td>
                          <td className="px-2 py-2">
                            {getBookingNights(booking)}
                          </td>
                          <td className="px-2 py-2">
                            <Money
                              value={getAllocatedBookingAmount(
                                booking,
                                period,
                                booking.grossIncome,
                              )}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Money
                              value={getAllocatedBookingAmount(
                                booking,
                                period,
                                booking.otaCommission ?? 0,
                              )}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Money
                              value={getAllocatedBookingAmount(
                                booking,
                                period,
                                getBookingNetIncome(booking),
                              )}
                            />
                          </td>
                          <td className="px-2 py-2 font-medium">
                            <Money
                              value={getAllocatedBookingAmount(
                                booking,
                                period,
                                getBookingTotal(booking),
                              )}
                            />
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

      <Card
        title="Matrice incassi per piattaforma (lordo)"
        subtitle={
          activeFilterLabels.length > 0
            ? `Filtrata: ${activeFilterLabels.join(" · ")} · vedi sopra il netto in banca per conto`
            : `Lordo FY${FISCAL_YEAR} · vedi sopra il netto in banca per conto`
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
    </div>
  );
}
