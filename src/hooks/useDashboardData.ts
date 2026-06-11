"use client";

import { useEffect, useState } from "react";
import { createSeedData } from "@/lib/seed";
import { useCloudDashboardStorage } from "./useCloudDashboardStorage";
import { useLocalDashboardStorage } from "./useLocalDashboardStorage";

type DashboardMode = "loading" | "cloud" | "local";

export function useDashboardData() {
  const [mode, setMode] = useState<DashboardMode>("loading");
  const local = useLocalDashboardStorage();
  const cloud = useCloudDashboardStorage(mode === "cloud");

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/config", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { cloud?: boolean }) => {
        if (!cancelled) {
          setMode(body.cloud ? "cloud" : "local");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMode("local");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (mode === "loading") {
    const empty = createSeedData();
    return {
      data: null,
      loading: true,
      saving: false,
      error: null,
      refresh: async () => {},
      isCloud: false,
      bookings: empty.bookings,
      expenses: empty.expenses,
      properties: empty.properties,
      platforms: empty.platforms,
      expenseCategories: empty.expenseCategories,
      profitTargets: empty.profitTargets,
      automation: empty.automation,
      addBooking: local.addBooking,
      updateBooking: local.updateBooking,
      duplicateBooking: local.duplicateBooking,
      addExpense: local.addExpense,
      updateExpense: local.updateExpense,
      duplicateExpense: local.duplicateExpense,
      removeBooking: local.removeBooking,
      removeExpense: local.removeExpense,
      updateProfitTarget: local.updateProfitTarget,
      setProfitTargets: local.setProfitTargets,
      importBackup: local.importBackup,
      addProperty: local.addProperty,
      updateProperty: local.updateProperty,
      removeProperty: local.removeProperty,
      addExpenseCategory: local.addExpenseCategory,
      updateExpenseCategory: local.updateExpenseCategory,
      removeExpenseCategory: local.removeExpenseCategory,
      addPlatform: local.addPlatform,
      updatePlatform: local.updatePlatform,
      removePlatform: local.removePlatform,
      updateAutomation: local.updateAutomation,
      updatePropertyAutomation: local.updatePropertyAutomation,
      syncAutomation: local.syncAutomation,
      importBookingCom: local.importBookingCom,
      importAirbnb: local.importAirbnb,
      resetToSeed: local.resetToSeed,
      clearAll: local.clearAll,
      clearTransactions: local.clearTransactions,
    };
  }

  if (mode === "local") {
    return local;
  }

  return cloud;
}
