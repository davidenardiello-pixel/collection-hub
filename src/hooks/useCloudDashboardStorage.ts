"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const SYNC_INTERVAL_MS = 20_000;

async function fetchDashboard(): Promise<{
  data: DashboardData;
  updatedAt: string;
}> {
  const response = await fetch("/api/dashboard", { cache: "no-store" });
  const body = (await response.json()) as {
    data?: DashboardData;
    updatedAt?: string;
    error?: string;
  };

  if (!response.ok || !body.data || !body.updatedAt) {
    throw new Error(body.error ?? "Caricamento dati non riuscito.");
  }

  return {
    data: normalizeDashboardData(body.data),
    updatedAt: body.updatedAt,
  };
}

async function saveDashboard(data: DashboardData): Promise<string> {
  const response = await fetch("/api/dashboard", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const body = (await response.json()) as {
    updatedAt?: string;
    error?: string;
  };

  if (!response.ok || !body.updatedAt) {
    throw new Error(body.error ?? "Salvataggio non riuscito.");
  }

  return body.updatedAt;
}

export function useCloudDashboardStorage(enabled: boolean) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updatedAtRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  const applyDashboard = useCallback(
    (result: { data: DashboardData; updatedAt: string }) => {
      updatedAtRef.current = result.updatedAt;
      setData(result.data);
      setError(null);
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const result = await fetchDashboard();
      applyDashboard(result);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Errore di caricamento.",
      );
    } finally {
      setLoading(false);
    }
  }, [applyDashboard]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    void fetchDashboard()
      .then((result) => {
        if (!cancelled) {
          applyDashboard(result);
        }
      })
      .catch((refreshError) => {
        if (!cancelled) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "Errore di caricamento.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyDashboard, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const interval = window.setInterval(() => {
      if (savingRef.current) {
        return;
      }

      void fetchDashboard()
        .then((result) => {
          if (
            updatedAtRef.current &&
            result.updatedAt !== updatedAtRef.current
          ) {
            applyDashboard(result);
          }
        })
        .catch(() => {
          // Ignora errori di sync silenziosa
        });
    }, SYNC_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [applyDashboard, enabled]);

  const persist = useCallback(
    (updater: (current: DashboardData) => DashboardData) => {
      setData((current) => {
        if (!current) {
          return current;
        }

        const next = normalizeDashboardData(updater(current));

        savingRef.current = true;
        setSaving(true);
        void saveDashboard(next)
          .then((updatedAt) => {
            updatedAtRef.current = updatedAt;
            setError(null);
          })
          .catch((saveError) => {
            setError(
              saveError instanceof Error
                ? saveError.message
                : "Salvataggio non riuscito.",
            );
            void fetchDashboard()
              .then(applyDashboard)
              .catch(() => undefined);
          })
          .finally(() => {
            savingRef.current = false;
            setSaving(false);
          });

        return next;
      });
    },
    [],
  );

  const addBooking = useCallback(
    (booking: Omit<Booking, "id">) => {
      persist((current) => {
        if (!current) {
          return current;
        }

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
        if (!current) {
          return current;
        }

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
        if (!current) {
          return current;
        }

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
      persist((current) => {
        if (!current) {
          return current;
        }

        return refreshAutomatedCleaningExpenses({
          ...current,
          bookings: current.bookings.filter((booking) => booking.id !== id),
          expenses: removeAllBookingLinkedExpenses(current.expenses, id),
        });
      });
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
      persist((current) => {
        if (!current) {
          return current;
        }

        return refreshAutomatedCleaningExpenses({
          ...current,
          automation: settings,
        });
      });
    },
    [persist],
  );

  const updatePropertyAutomation = useCallback(
    (
      propertyId: string,
      cleaningCostPerCheckIn: number,
      krossBookingMonthly: number,
    ) => {
      persist((current) => {
        if (!current) {
          return current;
        }

        return resyncPropertyBookingCleaningExpenses(
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
        );
      });
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
      if (!current) {
        return current;
      }

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
        if (!current) {
          return current;
        }

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
        if (!current) {
          return current;
        }

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
    persist((current) => {
      if (!current) {
        return current;
      }

      return {
        bookings: [],
        expenses: [],
        properties: current.properties,
        platforms: current.platforms,
        expenseCategories: current.expenseCategories,
        profitTargets: current.profitTargets,
        automation: current.automation,
      };
    });
  }, [persist]);

  const clearTransactions = useCallback(
    (scope: PurgeScope) => {
      let preview = getPurgePreview([], [], scope);

      persist((current) => {
        if (!current) {
          return current;
        }

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

  const empty = createSeedData();

  return {
    data,
    loading,
    saving,
    error,
    refresh,
    isCloud: true as const,
    bookings: data?.bookings ?? empty.bookings,
    expenses: data?.expenses ?? empty.expenses,
    properties: data?.properties ?? empty.properties,
    platforms: data?.platforms ?? empty.platforms,
    expenseCategories: data?.expenseCategories ?? empty.expenseCategories,
    profitTargets: data?.profitTargets ?? empty.profitTargets,
    automation: data?.automation ?? empty.automation,
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
