"use client";

import { useCallback, useState } from "react";
import {
  refreshAutomatedCleaningExpenses,
  syncAutomatedExpenses,
  type AutomationPreview,
} from "@/lib/automation";
import { resyncPropertyBookingCleaningExpenses } from "@/lib/booking-cleaning";
import { normalizeBookingCommission } from "@/lib/booking-commission";
import {
  removeAllBookingLinkedExpenses,
  upsertAllBookingLinkedExpenses,
} from "@/lib/booking-vat";
import { parseBackup } from "@/lib/backup";
import {
  DEFAULT_KROSSBOOKING_MONTHLY,
  MAX_PLATFORMS,
  STORAGE_KEY,
} from "@/lib/constants";
import { createUniqueId, normalizeDashboardData } from "@/lib/migrate";
import { removePropertyFromDashboard } from "@/lib/property-removal";
import {
  getPurgePreview,
  purgeTransactions,
  type PurgeScope,
} from "@/lib/purge";
import {
  syncAirbnbReservations,
  type AirbnbSyncPreview,
} from "@/lib/ota-import/airbnb";
import {
  syncBookingComReservations,
  type BookingComSyncPreview,
} from "@/lib/ota-import/booking-com";
import {
  buildAirbnbSnapshot,
  buildBookingComSnapshot,
  upsertOtaImportSnapshot,
} from "@/lib/ota-import/snapshots";
import { createSeedData } from "@/lib/seed";
import type {
  AutomationSettings,
  Booking,
  DashboardData,
  Expense,
} from "@/lib/types";

const LEGACY_STORAGE_KEYS = [
  "hsp-dashboard-data-v1",
  "hsp-dashboard-data-v2",
  "hsp-dashboard-data-v3",
  "hsp-dashboard-data-v4",
  "hsp-dashboard-data-v7",
];

function readStorage(): DashboardData | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return normalizeDashboardData(JSON.parse(raw) as Partial<DashboardData>);
    } catch {
      return null;
    }
  }

  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    const legacyRaw = window.localStorage.getItem(legacyKey);
    if (!legacyRaw) {
      continue;
    }

    try {
      return normalizeDashboardData(JSON.parse(legacyRaw) as Partial<DashboardData>);
    } catch {
      return null;
    }
  }

  return null;
}

function writeStorage(data: DashboardData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadInitialData(): DashboardData {
  const stored = readStorage();
  if (stored) {
    writeStorage(stored);
    return stored;
  }

  const seed = createSeedData();
  writeStorage(seed);
  return seed;
}

export function useLocalDashboardStorage() {
  const [data, setData] = useState<DashboardData>(loadInitialData);

  const persist = useCallback((updater: (current: DashboardData) => DashboardData) => {
    setData((current) => {
      const next = normalizeDashboardData(updater(current));
      writeStorage(next);
      return next;
    });
  }, []);

  const addBooking = useCallback(
    (booking: Omit<Booking, "id">) => {
      persist((current) => {
        const id = crypto.randomUUID();
        const saved = {
          ...normalizeBookingCommission({
            ...booking,
            id,
            legacyIncomeAttribution: false,
            importedFromExcel: false,
          }),
          id,
        };

        return refreshAutomatedCleaningExpenses({
          ...current,
          bookings: [saved, ...current.bookings],
          expenses: upsertAllBookingLinkedExpenses(
            current.expenses,
            saved,
            current.expenseCategories,
            current.platforms,
            current.properties,
          ),
        });
      });
    },
    [persist],
  );

  const updateBooking = useCallback(
    (id: string, booking: Omit<Booking, "id">) => {
      persist((current) => {
        const existing = current.bookings.find((item) => item.id === id);
        const importedFromExcel =
          existing?.importedFromExcel ?? booking.importedFromExcel ?? false;
        const saved = {
          ...normalizeBookingCommission({
            ...booking,
            id,
            importedFromExcel,
            legacyIncomeAttribution: importedFromExcel
              ? true
              : (booking.legacyIncomeAttribution ??
                existing?.legacyIncomeAttribution ??
                false),
          }),
          id,
        };

        return refreshAutomatedCleaningExpenses({
          ...current,
          bookings: current.bookings.map((item) =>
            item.id === id ? saved : item,
          ),
          expenses: upsertAllBookingLinkedExpenses(
            current.expenses,
            saved,
            current.expenseCategories,
            current.platforms,
            current.properties,
          ),
        });
      });
    },
    [persist],
  );

  const duplicateBooking = useCallback(
    (id: string) => {
      persist((current) => {
        const source = current.bookings.find((booking) => booking.id === id);
        if (!source) {
          return current;
        }

        const copyId = crypto.randomUUID();
        const copy = {
          ...source,
          id: copyId,
          description: `${source.description} (copia)`,
          importedFromExcel: false,
          legacyIncomeAttribution: false,
        };

        return refreshAutomatedCleaningExpenses({
          ...current,
          bookings: [copy, ...current.bookings],
          expenses: upsertAllBookingLinkedExpenses(
            current.expenses,
            copy,
            current.expenseCategories,
            current.platforms,
            current.properties,
          ),
        });
      });
    },
    [persist],
  );

  const addExpense = useCallback(
    (expense: Omit<Expense, "id">) => {
      persist((current) => ({
        ...current,
        expenses: [{ ...expense, id: crypto.randomUUID() }, ...current.expenses],
      }));
    },
    [persist],
  );

  const updateExpense = useCallback(
    (id: string, expense: Omit<Expense, "id">) => {
      persist((current) => ({
        ...current,
        expenses: current.expenses.map((item) =>
          item.id === id ? { ...expense, id } : item,
        ),
      }));
    },
    [persist],
  );

  const duplicateExpense = useCallback(
    (id: string) => {
      persist((current) => {
        const source = current.expenses.find((expense) => expense.id === id);
        if (!source) {
          return current;
        }

        return {
          ...current,
          expenses: [
            {
              ...source,
              id: crypto.randomUUID(),
              description: `${source.description} (copia)`,
            },
            ...current.expenses,
          ],
        };
      });
    },
    [persist],
  );

  const removeBooking = useCallback(
    (id: string) => {
      persist((current) =>
        refreshAutomatedCleaningExpenses({
          ...current,
          bookings: current.bookings.filter((booking) => booking.id !== id),
          expenses: removeAllBookingLinkedExpenses(current.expenses, id),
        }),
      );
    },
    [persist],
  );

  const removeExpense = useCallback(
    (id: string) => {
      persist((current) => ({
        ...current,
        expenses: current.expenses.filter((expense) => expense.id !== id),
      }));
    },
    [persist],
  );

  const updateProfitTarget = useCallback(
    (month: number, value: number) => {
      persist((current) => ({
        ...current,
        profitTargets: current.profitTargets.map((target, index) =>
          index === month - 1 ? Math.max(0, value) : target,
        ),
      }));
    },
    [persist],
  );

  const setProfitTargets = useCallback(
    (targets: number[]) => {
      persist((current) => ({
        ...current,
        profitTargets: targets.map((value) => Math.max(0, value)),
      }));
    },
    [persist],
  );

  const importBackup = useCallback(
    (raw: string): string | null => {
      const parsed = parseBackup(raw);
      if (!parsed) {
        return "Il file di backup non è valido.";
      }

      persist(() => parsed);
      return null;
    },
    [persist],
  );

  const addProperty = useCallback(
    (name: string, monthlyRent: number): string | null => {
      const trimmed = name.trim();
      if (!trimmed) {
        return "Inserisci il nome dell'appartamento.";
      }

      let error: string | null = null;

      persist((current) => {
        if (current.properties.length >= 20) {
          error = "Puoi gestire al massimo 20 appartamenti.";
          return current;
        }

        const id = createUniqueId(
          trimmed,
          current.properties.map((property) => property.id),
        );

        return {
          ...current,
          properties: [
            ...current.properties,
            {
              id,
              name: trimmed,
              monthlyRent,
              cleaningCostPerCheckIn: 0,
              krossBookingMonthly: DEFAULT_KROSSBOOKING_MONTHLY,
            },
          ],
        };
      });

      return error;
    },
    [persist],
  );

  const updateProperty = useCallback(
    (id: string, name: string, monthlyRent: number): string | null => {
      const trimmed = name.trim();
      if (!trimmed) {
        return "Il nome non può essere vuoto.";
      }

      persist((current) => ({
        ...current,
        properties: current.properties.map((property) =>
          property.id === id
            ? { ...property, name: trimmed, monthlyRent }
            : property,
        ),
      }));

      return null;
    },
    [persist],
  );

  const removeProperty = useCallback(
    (id: string): string | null => {
      let error: string | null = null;

      persist((current) => {
        const result = removePropertyFromDashboard(current, id);
        error = result.error;
        return result.data;
      });

      return error;
    },
    [persist],
  );

  const addExpenseCategory = useCallback(
    (name: string): string | null => {
      const trimmed = name.trim();
      if (!trimmed) {
        return "Inserisci il nome della categoria.";
      }

      let error: string | null = null;

      persist((current) => {
        if (current.expenseCategories.length >= 20) {
          error = "Puoi gestire al massimo 20 categorie di spesa.";
          return current;
        }

        const id = createUniqueId(
          trimmed,
          current.expenseCategories.map((category) => category.id),
        );

        return {
          ...current,
          expenseCategories: [
            ...current.expenseCategories,
            { id, name: trimmed },
          ],
        };
      });

      return error;
    },
    [persist],
  );

  const updateExpenseCategory = useCallback(
    (id: string, name: string): string | null => {
      const trimmed = name.trim();
      if (!trimmed) {
        return "Il nome non può essere vuoto.";
      }

      persist((current) => ({
        ...current,
        expenseCategories: current.expenseCategories.map((category) =>
          category.id === id ? { ...category, name: trimmed } : category,
        ),
      }));

      return null;
    },
    [persist],
  );

  const addPlatform = useCallback(
    (name: string): string | null => {
      const trimmed = name.trim();
      if (!trimmed) {
        return "Inserisci il nome della piattaforma.";
      }

      let error: string | null = null;

      persist((current) => {
        if (current.platforms.length >= MAX_PLATFORMS) {
          error = `Puoi gestire al massimo ${MAX_PLATFORMS} piattaforme.`;
          return current;
        }

        const id = createUniqueId(
          trimmed,
          current.platforms.map((platform) => platform.id),
        );

        return {
          ...current,
          platforms: [...current.platforms, { id, name: trimmed }],
        };
      });

      return error;
    },
    [persist],
  );

  const updatePlatform = useCallback(
    (id: string, name: string): string | null => {
      const trimmed = name.trim();
      if (!trimmed) {
        return "Il nome non può essere vuoto.";
      }

      persist((current) => ({
        ...current,
        platforms: current.platforms.map((platform) =>
          platform.id === id ? { ...platform, name: trimmed } : platform,
        ),
      }));

      return null;
    },
    [persist],
  );

  const removePlatform = useCallback(
    (id: string): string | null => {
      let error: string | null = null;

      persist((current) => {
        const inUse = current.bookings.some(
          (booking) => booking.platformId === id,
        );

        if (inUse) {
          error =
            "Non puoi eliminare una piattaforma con prenotazioni collegate.";
          return current;
        }

        if (current.platforms.length <= 1) {
          error = "Devi mantenere almeno una piattaforma.";
          return current;
        }

        return {
          ...current,
          platforms: current.platforms.filter((platform) => platform.id !== id),
        };
      });

      return error;
    },
    [persist],
  );

  const removeExpenseCategory = useCallback(
    (id: string): string | null => {
      let error: string | null = null;

      persist((current) => {
        const inUse = current.expenses.some(
          (expense) => expense.categoryId === id,
        );

        if (inUse) {
          error =
            "Non puoi eliminare una categoria usata in spese esistenti.";
          return current;
        }

        if (current.expenseCategories.length <= 1) {
          error = "Devi mantenere almeno una categoria di spesa.";
          return current;
        }

        return {
          ...current,
          expenseCategories: current.expenseCategories.filter(
            (category) => category.id !== id,
          ),
        };
      });

      return error;
    },
    [persist],
  );

  const updateAutomation = useCallback(
    (settings: AutomationSettings) => {
      persist((current) =>
        refreshAutomatedCleaningExpenses({
          ...current,
          automation: settings,
        }),
      );
    },
    [persist],
  );

  const updatePropertyAutomation = useCallback(
    (
      propertyId: string,
      cleaningCostPerCheckIn: number,
      krossBookingMonthly: number,
    ) => {
      persist((current) =>
        resyncPropertyBookingCleaningExpenses(
          refreshAutomatedCleaningExpenses({
            ...current,
            properties: current.properties.map((property) =>
              property.id === propertyId
                ? {
                    ...property,
                    cleaningCostPerCheckIn: Math.max(0, cleaningCostPerCheckIn),
                    krossBookingMonthly: Math.max(0, krossBookingMonthly),
                  }
                : property,
            ),
          }),
          propertyId,
        ),
      );
    },
    [persist],
  );

  const syncAutomation = useCallback((): AutomationPreview => {
    let preview: AutomationPreview = {
      removedAutomated: 0,
      rentEntries: 0,
      rentTotal: 0,
      krossEntries: 0,
      krossTotal: 0,
      cleaningEntries: 0,
      cleaningCheckIns: 0,
      cleaningTotal: 0,
    };

    persist((current) => {
      const synced = syncAutomatedExpenses(current);
      preview = synced.preview;
      return {
        ...current,
        expenses: synced.expenses,
      };
    });

    return preview;
  }, [persist]);

  const importBookingCom = useCallback(
    async (
      propertyId: string,
      file: File,
    ): Promise<BookingComSyncPreview | { error: string }> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("propertyId", propertyId);

      const response = await fetch("/api/import/booking-com", {
        method: "POST",
        body: formData,
      });

      const raw = await response.text();
      let body: {
        error?: string;
        filename?: string;
        period?: BookingComSyncPreview["period"];
        reservations?: BookingComSyncPreview["reservations"];
      };

      try {
        body = JSON.parse(raw) as typeof body;
      } catch {
        return {
          error:
            raw.trim().slice(0, 200) ||
            `Import Booking.com non riuscito (HTTP ${response.status}).`,
        };
      }

      if (!response.ok || body.error || !body.period || !body.reservations) {
        return { error: body.error ?? "Import Booking.com non riuscito." };
      }

      let preview: BookingComSyncPreview = {
        scope: "",
        period: body.period,
        added: 0,
        updated: 0,
        removed: 0,
        locked: 0,
        removedGuests: [],
        reservations: body.reservations,
      };

      persist((current) => {
        const synced = syncBookingComReservations(
          current,
          propertyId,
          body.period!,
          body.reservations!,
        );
        preview = synced.preview;
        const snapshot = buildBookingComSnapshot(
          propertyId,
          body.filename ?? "upload.xls",
          synced.preview,
        );

        return normalizeDashboardData({
          ...synced.data,
          otaImportSnapshots: upsertOtaImportSnapshot(
            current.otaImportSnapshots,
            snapshot,
          ),
        });
      });

      return preview;
    },
    [persist],
  );

  const importAirbnb = useCallback(
    async (
      propertyId: string,
      file: File,
      year: number,
      month: number,
    ): Promise<AirbnbSyncPreview | { error: string }> => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("propertyId", propertyId);
      formData.append("year", String(year));
      formData.append("month", String(month));

      const response = await fetch("/api/import/airbnb", {
        method: "POST",
        body: formData,
      });

      const raw = await response.text();
      let body: {
        error?: string;
        filename?: string;
        period?: AirbnbSyncPreview["period"];
        reservations?: AirbnbSyncPreview["reservations"];
      };

      try {
        body = JSON.parse(raw) as typeof body;
      } catch {
        return {
          error:
            raw.trim().slice(0, 200) ||
            `Import Airbnb non riuscito (HTTP ${response.status}).`,
        };
      }

      if (!response.ok || body.error || !body.period || !body.reservations) {
        return { error: body.error ?? "Import Airbnb non riuscito." };
      }

      let preview: AirbnbSyncPreview = {
        scope: "",
        period: body.period,
        added: 0,
        updated: 0,
        removed: 0,
        locked: 0,
        removedGuests: [],
        reservations: body.reservations,
      };

      persist((current) => {
        const synced = syncAirbnbReservations(
          current,
          propertyId,
          body.period!,
          body.reservations!,
        );
        preview = synced.preview;
        const snapshot = buildAirbnbSnapshot(
          propertyId,
          body.filename ?? "upload.csv",
          synced.preview,
        );

        return normalizeDashboardData({
          ...synced.data,
          otaImportSnapshots: upsertOtaImportSnapshot(
            current.otaImportSnapshots,
            snapshot,
          ),
        });
      });

      return preview;
    },
    [persist],
  );

  const resetToSeed = useCallback(() => {
    persist(() => createSeedData());
  }, [persist]);

  const clearAll = useCallback(() => {
    persist((current) => ({
      bookings: [],
      expenses: [],
      properties: current.properties,
      platforms: current.platforms,
      expenseCategories: current.expenseCategories,
      profitTargets: current.profitTargets,
      automation: current.automation,
    }));
  }, [persist]);

  const clearTransactions = useCallback(
    (scope: PurgeScope) => {
      let preview = getPurgePreview([], [], scope);

      persist((current) => {
        preview = getPurgePreview(
          current.bookings,
          current.expenses,
          scope,
        );
        return purgeTransactions(current, scope);
      });

      return preview;
    },
    [persist],
  );

  return {
    data,
    loading: false,
    saving: false,
    error: null as string | null,
    refresh: async () => {},
    isCloud: false,
    bookings: data.bookings,
    expenses: data.expenses,
    properties: data.properties,
    platforms: data.platforms,
    expenseCategories: data.expenseCategories,
    profitTargets: data.profitTargets,
    automation: data.automation,
    addBooking,
    updateBooking,
    duplicateBooking,
    addExpense,
    updateExpense,
    duplicateExpense,
    removeBooking,
    removeExpense,
    updateProfitTarget,
    setProfitTargets,
    importBackup,
    addProperty,
    updateProperty,
    removeProperty,
    addExpenseCategory,
    updateExpenseCategory,
    removeExpenseCategory,
    addPlatform,
    updatePlatform,
    removePlatform,
    updateAutomation,
    updatePropertyAutomation,
    syncAutomation,
    importBookingCom,
    importAirbnb,
    resetToSeed,
    clearAll,
    clearTransactions,
  };
}
