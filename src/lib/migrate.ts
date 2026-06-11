import {
  DEFAULT_AUTOMATION_SETTINGS,
  pruneStaleRentKrossAutomation,
} from "./automation";
import {
  isExcelBaselineBooking,
  isExcelBaselineExpense,
} from "./excel-baseline";
import { syncMissingBookingCleaning } from "./booking-cleaning";
import {
  normalizeBookingCommission,
  syncMissingBookingCommissions,
} from "./booking-commission";
import { deduplicateOverlappingExpenses } from "./expense-dedup";
import { syncMissingBookingVat } from "./booking-vat";
import {
  createEmptyProfitTargets,
  DEFAULT_CLEANING_COSTS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_KROSSBOOKING_MONTHLY,
  DEFAULT_PLATFORMS,
  DEFAULT_PROPERTIES,
} from "./constants";
import type {
  AutomationSettings,
  Booking,
  DashboardData,
  Expense,
  ExpenseCategory,
  Platform,
  Property,
} from "./types";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function createUniqueId(name: string, existingIds: string[]): string {
  const base = slugify(name) || "item";
  let candidate = base;
  let index = 2;

  while (existingIds.includes(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}

function humanizeId(id: string): string {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeProperty(property: Property): Property {
  return {
    ...property,
    monthlyRent: Number(property.monthlyRent) || 0,
    cleaningCostPerCheckIn:
      property.cleaningCostPerCheckIn ??
      DEFAULT_CLEANING_COSTS[property.id] ??
      0,
    krossBookingMonthly:
      property.krossBookingMonthly ?? DEFAULT_KROSSBOOKING_MONTHLY,
  };
}

function ensureProperties(
  properties: Property[] | undefined,
  bookings: Booking[],
  expenses: Expense[],
): Property[] {
  const catalog = [...(properties ?? DEFAULT_PROPERTIES)].map(normalizeProperty);
  const knownIds = new Set(catalog.map((property) => property.id));

  for (const propertyId of [
    ...new Set([
      ...bookings.map((booking) => booking.propertyId),
      ...expenses.map((expense) => expense.propertyId),
    ]),
  ]) {
    if (!knownIds.has(propertyId)) {
      catalog.push(
        normalizeProperty({
          id: propertyId,
          name: humanizeId(propertyId),
          monthlyRent: 0,
          cleaningCostPerCheckIn: DEFAULT_CLEANING_COSTS[propertyId] ?? 0,
          krossBookingMonthly: DEFAULT_KROSSBOOKING_MONTHLY,
        }),
      );
      knownIds.add(propertyId);
    }
  }

  return catalog;
}

function ensureAutomation(
  automation: AutomationSettings | undefined,
): AutomationSettings {
  return {
    autoRent: automation?.autoRent ?? DEFAULT_AUTOMATION_SETTINGS.autoRent,
    autoKrossBooking:
      automation?.autoKrossBooking ??
      DEFAULT_AUTOMATION_SETTINGS.autoKrossBooking,
    autoCleaning:
      automation?.autoCleaning ?? DEFAULT_AUTOMATION_SETTINGS.autoCleaning,
  };
}

function ensurePlatforms(
  platforms: Platform[] | undefined,
  bookings: Booking[],
): Platform[] {
  const catalog = [...(platforms ?? DEFAULT_PLATFORMS)];
  const knownIds = new Set(catalog.map((platform) => platform.id));

  for (const platformId of new Set(bookings.map((booking) => booking.platformId))) {
    if (!knownIds.has(platformId)) {
      catalog.push({
        id: platformId,
        name: humanizeId(platformId),
      });
      knownIds.add(platformId);
    }
  }

  return catalog;
}

function ensureCategories(
  categories: ExpenseCategory[] | undefined,
  expenses: Expense[],
): ExpenseCategory[] {
  const catalog = [...(categories ?? DEFAULT_EXPENSE_CATEGORIES)];
  const knownIds = new Set(catalog.map((category) => category.id));

  for (const categoryId of new Set(expenses.map((expense) => expense.categoryId))) {
    if (!knownIds.has(categoryId)) {
      catalog.push({
        id: categoryId,
        name: humanizeId(categoryId),
      });
      knownIds.add(categoryId);
    }
  }

  return catalog;
}

export function normalizeDashboardData(
  raw: Partial<DashboardData> | null,
): DashboardData {
  const bookings = (raw?.bookings ?? []).map((booking) => {
    const normalized = normalizeBookingCommission(booking as Booking);
    const importedFromExcel = isExcelBaselineBooking(normalized);

    return {
      ...normalized,
      importedFromExcel,
      legacyIncomeAttribution: importedFromExcel
        ? true
        : (normalized.legacyIncomeAttribution ?? false),
    };
  });
  const expenses = (raw?.expenses ?? []).map((expense) => {
    const importedFromExcel = isExcelBaselineExpense(expense as Expense);

    return {
      ...expense,
      importedFromExcel,
    };
  });

  const profitTargets =
    Array.isArray(raw?.profitTargets) && raw.profitTargets.length === 12
      ? raw.profitTargets.map((value) => Number(value) || 0)
      : createEmptyProfitTargets();

  const normalized = {
    bookings,
    expenses,
    properties: ensureProperties(raw?.properties, bookings, expenses),
    platforms: ensurePlatforms(raw?.platforms, bookings),
    expenseCategories: ensureCategories(raw?.expenseCategories, expenses),
    profitTargets,
    automation: ensureAutomation(raw?.automation),
    otaImportSnapshots: Array.isArray(raw?.otaImportSnapshots)
      ? raw.otaImportSnapshots
      : [],
  };

  return pruneStaleRentKrossAutomation(
    deduplicateOverlappingExpenses(
      syncMissingBookingVat(
        syncMissingBookingCleaning(syncMissingBookingCommissions(normalized)),
      ),
    ),
  );
}
