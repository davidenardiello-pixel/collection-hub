import { normalizeDashboardData } from "./migrate";
import { resyncAirbnbOtaBookings } from "./ota-import/airbnb";
import { createSeedData } from "./seed";
import { formatStoreError } from "./store-errors";
import { getSupabaseAdmin } from "./supabase/server";
import type { Booking, DashboardData } from "./types";

const ROW_ID = "main";

function airbnbResyncChangedBookings(
  before: Booking[],
  after: Booking[],
): boolean {
  if (before.length !== after.length) {
    return true;
  }

  const afterById = new Map(after.map((booking) => [booking.id, booking]));

  return before.some((booking) => {
    const next = afterById.get(booking.id);
    if (!next) {
      return true;
    }

    return (
      booking.grossIncome !== next.grossIncome ||
      booking.otaCommission !== next.otaCommission ||
      booking.notes !== next.notes
    );
  });
}

function bookingsNeedAirbnbResync(
  payload: Partial<DashboardData>,
): boolean {
  const bookings = payload.bookings ?? [];
  const properties = payload.properties ?? [];
  const resynced = resyncAirbnbOtaBookings(bookings as Booking[], properties);
  return airbnbResyncChangedBookings(bookings as Booking[], resynced);
}

export async function loadDashboardFromStore(): Promise<{
  data: DashboardData;
  updatedAt: string;
}> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("dashboard_data")
    .select("payload, updated_at")
    .eq("id", ROW_ID)
    .maybeSingle();

  if (error) {
    throw new Error(formatStoreError(error));
  }

  if (!data) {
    const seed = createSeedData();
    const saved = await saveDashboardToStore(seed);
    return saved;
  }

  const payload = data.payload as Partial<DashboardData>;
  const hasTransactions =
    Array.isArray(payload.bookings) && payload.bookings.length > 0;

  if (!hasTransactions && (!payload.properties || payload.properties.length === 0)) {
    const seed = createSeedData();
    const saved = await saveDashboardToStore(seed);
    return saved;
  }

  const normalized = normalizeDashboardData(payload);

  if (bookingsNeedAirbnbResync(payload)) {
    return saveDashboardToStore(normalized);
  }

  return {
    data: normalized,
    updatedAt: data.updated_at,
  };
}

export async function saveDashboardToStore(
  dashboard: DashboardData,
): Promise<{ data: DashboardData; updatedAt: string }> {
  const supabase = getSupabaseAdmin();
  const normalized = normalizeDashboardData(dashboard);
  const updatedAt = new Date().toISOString();

  const { error } = await supabase.from("dashboard_data").upsert({
    id: ROW_ID,
    payload: normalized,
    updated_at: updatedAt,
  });

  if (error) {
    throw new Error(formatStoreError(error));
  }

  return {
    data: normalized,
    updatedAt,
  };
}
