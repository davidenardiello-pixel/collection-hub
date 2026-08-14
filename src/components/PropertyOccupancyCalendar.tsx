"use client";

import { useMemo } from "react";
import {
  buildPropertyMonthCalendar,
  getMonthGridPadding,
  type CalendarDayCell,
  type DayOccupancyStatus,
} from "@/lib/occupancy";
import type { Booking, MonthPeriod } from "@/lib/types";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function statusClass(status: DayOccupancyStatus, isToday: boolean): string {
  const base =
    status === "occupied"
      ? "bg-rc-gold/85 text-rc-black font-semibold"
      : status === "free-future"
        ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/35"
        : "bg-rc-charcoal/80 text-rc-muted ring-1 ring-rc-gold/15";

  return isToday
    ? `${base} ring-2 ring-rc-gold-light ring-offset-1 ring-offset-rc-surface`
    : base;
}

function statusLabel(status: DayOccupancyStatus): string {
  switch (status) {
    case "occupied":
      return "Occupato";
    case "free-future":
      return "Libero (da oggi)";
    case "free-past":
      return "Libero (passato)";
  }
}

function DayCell({
  cell,
  compact,
}: {
  cell: CalendarDayCell;
  compact: boolean;
}) {
  const label = cell.date
    ? `${new Date(cell.date + "T12:00:00").toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })} · ${statusLabel(cell.status)}`
    : "";

  return (
    <div
      title={label}
      aria-label={label || undefined}
      className={`flex items-center justify-center rounded-md text-center transition ${compact ? "h-7 text-[10px]" : "h-9 text-xs sm:h-10 sm:text-sm"} ${cell.date ? statusClass(cell.status, cell.isToday) : "bg-transparent"}`}
    >
      {cell.day > 0 ? cell.day : ""}
    </div>
  );
}

export function PropertyOccupancyCalendar({
  bookings,
  period,
  propertyId,
  propertyName,
  compact = false,
}: {
  bookings: Booking[];
  period: MonthPeriod;
  propertyId: string;
  propertyName?: string;
  compact?: boolean;
}) {
  const cells = useMemo(
    () => buildPropertyMonthCalendar(bookings, period, propertyId),
    [bookings, period, propertyId],
  );
  const padding = useMemo(() => getMonthGridPadding(period), [period]);

  const gridCells: Array<CalendarDayCell | null> = [
    ...Array.from({ length: padding }, () => null),
    ...cells,
  ];

  while (gridCells.length % 7 !== 0) {
    gridCells.push(null);
  }

  const occupied = cells.filter((cell) => cell.status === "occupied").length;
  const freeFuture = cells.filter((cell) => cell.status === "free-future").length;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {propertyName ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p
            className={
              compact
                ? "text-sm font-semibold text-rc-gold-light"
                : "text-base font-semibold text-rc-gold-light"
            }
          >
            {propertyName}
          </p>
          <p className="text-xs text-rc-muted">
            {occupied} occ. · {freeFuture} liberi
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className={`text-center font-medium uppercase text-rc-muted ${compact ? "text-[9px]" : "text-[10px] sm:text-xs"}`}
          >
            {label}
          </div>
        ))}
        {gridCells.map((cell, index) =>
          cell ? (
            <DayCell key={cell.date} cell={cell} compact={compact} />
          ) : (
            <div key={`pad-${index}`} className={compact ? "h-7" : "h-9 sm:h-10"} />
          ),
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-[10px] text-rc-muted sm:text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-rc-gold/85" />
          Occupato
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500/20 ring-1 ring-emerald-500/35" />
          Libero (futuro)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-rc-charcoal/80 ring-1 ring-rc-gold/15" />
          Libero (passato)
        </span>
      </div>
    </div>
  );
}
