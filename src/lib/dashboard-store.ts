import { normalizeDashboardData } from "./migrate";
import { createSeedData } from "./seed";
import { getSupabaseAdmin } from "./supabase/server";
import type { DashboardData } from "./types";

const ROW_ID = "main";

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
    throw new Error(error.message);
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

  return {
    data: normalizeDashboardData(payload),
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
    throw new Error(error.message);
  }

  return {
    data: normalized,
    updatedAt,
  };
}
