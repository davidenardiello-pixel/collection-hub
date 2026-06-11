import type { AirbnbSyncPreview } from "./airbnb";
import type { BookingComSyncPreview } from "./booking-com";
import type { OtaImportSnapshot } from "../types";

export type { OtaImportSnapshot };

export function buildBookingComSnapshot(
  propertyId: string,
  filename: string,
  preview: BookingComSyncPreview,
): OtaImportSnapshot {
  const reservations = preview.reservations;

  return {
    platform: "booking-com",
    propertyId,
    scope: preview.scope,
    filename,
    importedAt: new Date().toISOString(),
    reservationCount: reservations.length,
    grossTotal: sumReservationMoney(
      reservations.map((item) => item.grossIncome),
    ),
    commissionTotal: sumReservationMoney(
      reservations.map((item) => item.otaCommission),
    ),
    added: preview.added,
    updated: preview.updated,
    removed: preview.removed,
    removedGuests: preview.removedGuests,
    guests: reservations.map((item) => item.guestName),
  };
}

export function upsertOtaImportSnapshot(
  snapshots: OtaImportSnapshot[] | undefined,
  snapshot: OtaImportSnapshot,
): OtaImportSnapshot[] {
  const catalog = [...(snapshots ?? [])].filter(
    (item) =>
      !(
        item.platform === snapshot.platform &&
        item.propertyId === snapshot.propertyId &&
        item.scope === snapshot.scope
      ),
  );

  return [snapshot, ...catalog];
}

export function buildAirbnbSnapshot(
  propertyId: string,
  filename: string,
  preview: AirbnbSyncPreview,
): OtaImportSnapshot {
  const reservations = preview.reservations;

  return {
    platform: "airbnb",
    propertyId,
    scope: preview.scope,
    filename,
    importedAt: new Date().toISOString(),
    reservationCount: reservations.length,
    grossTotal: sumReservationMoney(
      reservations.map((item) => item.netEarnings),
    ),
    commissionTotal: 0,
    added: preview.added,
    updated: preview.updated,
    removed: preview.removed,
    removedGuests: preview.removedGuests,
    guests: reservations.map((item) => item.guestName),
  };
}

export function getLatestBookingComSnapshot(
  snapshots: OtaImportSnapshot[] | undefined,
  propertyId: string,
): OtaImportSnapshot | undefined {
  return (snapshots ?? []).find(
    (item) => item.platform === "booking-com" && item.propertyId === propertyId,
  );
}

export function getLatestAirbnbSnapshot(
  snapshots: OtaImportSnapshot[] | undefined,
  propertyId: string,
  year: number,
  month: number,
): OtaImportSnapshot | undefined {
  const scopeSuffix = `${year}-${String(month).padStart(2, "0")}`;

  return (snapshots ?? []).find(
    (item) =>
      item.platform === "airbnb" &&
      item.propertyId === propertyId &&
      item.scope.endsWith(scopeSuffix),
  );
}

/** Somma importi con precisione del file, arrotondamento solo sul totale. */
export function sumReservationMoney(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total * 100) / 100;
}
