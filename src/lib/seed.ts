import { DEFAULT_AUTOMATION_SETTINGS } from "./automation";
import excelData from "./excel-data.json";
import {
  createEmptyProfitTargets,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_PLATFORMS,
  DEFAULT_PROPERTIES,
  FISCAL_YEAR,
} from "./constants";
import type { Booking, DashboardData, Expense } from "./types";

function withIds<T extends Omit<Booking, "id"> | Omit<Expense, "id">>(
  items: T[],
): (T & { id: string })[] {
  return items.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
  }));
}

export function createSeedData(): DashboardData {
  const bookings = withIds(
    (excelData.bookings as Omit<Booking, "id">[]).map((booking) => ({
      ...booking,
      otaCommission: booking.otaCommission ?? 0,
      legacyIncomeAttribution: true,
      importedFromExcel: true,
    })),
  );

  const expenses = withIds(
    (excelData.expenses as Omit<Expense, "id">[])
      .filter((expense) => expense.date.startsWith(String(FISCAL_YEAR)))
      .map((expense) => ({
        ...expense,
        importedFromExcel: true,
      })),
  );

  return {
    bookings,
    expenses,
    properties: [...DEFAULT_PROPERTIES],
    platforms: [...DEFAULT_PLATFORMS],
    expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
    profitTargets: createEmptyProfitTargets(),
    automation: { ...DEFAULT_AUTOMATION_SETTINGS },
    otaImportSnapshots: [],
  };
}
