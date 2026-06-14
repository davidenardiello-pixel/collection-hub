"use client";

import Image from "next/image";
import { useState } from "react";
import { formatCurrency, getAnnualSummary } from "@/lib/calculations";
import { BRAND } from "@/lib/brand";
import { FISCAL_YEAR } from "@/lib/constants";
import type { ViewId } from "@/lib/types";
import { useDashboardData } from "@/hooks/useDashboardData";
import { BrandTitle } from "./BrandTitle";
import { Button } from "./ui";
import { ExpensesView } from "./views/ExpensesView";
import { IncomeView } from "./views/IncomeView";
import { MonthlyView } from "./views/MonthlyView";
import { OverviewView } from "./views/OverviewView";
import { PropertyView } from "./views/PropertyView";
import { SettingsView } from "./views/SettingsView";

const TABS: { id: ViewId; label: string }[] = [
  { id: "overview", label: "Panoramica" },
  { id: "income", label: "Incassi" },
  { id: "expenses", label: "Spese" },
  { id: "monthly", label: "Mensile" },
  { id: "property", label: "Proprietà" },
  { id: "settings", label: "Impostazioni" },
];

export function Dashboard() {
  const [view, setView] = useState<ViewId>("overview");
  const {
    data,
    loading,
    saving,
    error,
    refresh,
    isCloud,
    bookings,
    expenses,
    properties,
    platforms,
    expenseCategories,
    profitTargets,
    addBooking,
    updateBooking,
    duplicateBooking,
    addExpense,
    updateExpense,
    duplicateExpense,
    removeBooking,
    removeExpense,
    updateProfitTarget,
    importBackup,
    addProperty,
    updateProperty,
    removeProperty,
    addPlatform,
    updatePlatform,
    removePlatform,
    addExpenseCategory,
    updateExpenseCategory,
    removeExpenseCategory,
    resetToSeed,
    clearAll,
    clearTransactions,
    updateAutomation,
    updatePropertyAutomation,
    syncAutomation,
    importBookingCom,
    importAirbnb,
  } = useDashboardData();

  const annual = getAnnualSummary(bookings, expenses, profitTargets);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 rc-main-pattern text-rc-muted">
        <p className="text-sm font-medium tracking-[0.18em] uppercase">
          Caricamento dati condivisi...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 rc-main-pattern px-4 text-center">
        <p className="text-sm text-rose-300">
          {error ?? "Impossibile caricare la dashboard condivisa."}
        </p>
        <Button onClick={() => void refresh()}>Riprova</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen rc-main-pattern">
      <header className="rc-header-pattern border-b-2 border-rc-gold/40 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:gap-6 sm:py-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="rc-logo-frame shrink-0 rounded-2xl bg-black/55 p-2 sm:p-3 md:p-4">
              <Image
                src="/brand/logo.png"
                alt={BRAND.name}
                width={180}
                height={180}
                className="h-20 w-20 object-contain sm:h-28 sm:w-28 md:h-36 md:w-36 lg:h-40 lg:w-40"
                priority
              />
            </div>
            <div>
              <BrandTitle size="lg" showTagline light />
              <h1 className="mt-3 font-[family-name:var(--font-cormorant)] text-2xl font-semibold tracking-wide text-white md:text-[2rem]">
                {BRAND.product.replace("+", "")}
                <span className="text-rc-gold">+</span>
              </h1>
              <p className="mt-1 text-sm text-rc-gold-light/75">
                {BRAND.productHint} · FY{FISCAL_YEAR}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="border-rc-gold/40 bg-black/30 text-rc-gold-light hover:bg-black/50"
              onClick={resetToSeed}
            >
              Importa dati Excel
            </Button>
            <Button variant="danger" onClick={clearAll}>
              Svuota transazioni
            </Button>
            {isCloud ? (
              <Button variant="ghost" onClick={() => void handleLogout()}>
                Esci
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-5">
          <div className="flex gap-2 overflow-x-auto rounded-2xl border border-rc-gold/35 bg-black/45 p-2 backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`shrink-0 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-wide transition sm:px-4 ${
                  view === tab.id
                    ? "rc-gold-gradient text-rc-black shadow-md"
                    : "text-rc-gold-light hover:bg-rc-gold/10 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {error ? (
          <div className="mb-4 rounded-xl border border-rose-500/35 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid gap-3 rounded-2xl border border-rc-gold/35 bg-rc-surface p-5 text-sm shadow-sm md:grid-cols-6">
          <Stat label="Appartamenti" value={String(properties.length)} />
          <Stat label="Piattaforme" value={String(platforms.length)} />
          <Stat label="Categorie" value={String(expenseCategories.length)} />
          <Stat label="Prenotazioni" value={String(bookings.length)} />
          <Stat
            label="Profitto YTD"
            value={formatCurrency(annual.ytdProfit)}
            highlight
          />
          <Stat
            label="Salvataggio"
            value={
              isCloud
                ? saving
                  ? "In corso..."
                  : "Cloud condiviso"
                : "Locale (browser)"
            }
            success={!saving}
          />
        </div>

        {view === "overview" ? (
          <OverviewView
            bookings={bookings}
            expenses={expenses}
            expenseCategories={expenseCategories}
            platforms={platforms}
            profitTargets={profitTargets}
          />
        ) : null}

        {view === "income" ? (
          <IncomeView
            bookings={bookings}
            expenses={expenses}
            properties={properties}
            platforms={platforms}
            onAdd={addBooking}
            onUpdate={updateBooking}
            onDuplicate={duplicateBooking}
            onRemove={removeBooking}
            onClearTransactions={clearTransactions}
          />
        ) : null}

        {view === "expenses" ? (
          <ExpensesView
            expenses={expenses}
            bookings={bookings}
            properties={properties}
            expenseCategories={expenseCategories}
            onAdd={addExpense}
            onUpdate={updateExpense}
            onDuplicate={duplicateExpense}
            onRemove={removeExpense}
            onClearTransactions={clearTransactions}
          />
        ) : null}

        {view === "monthly" ? (
          <MonthlyView
            bookings={bookings}
            expenses={expenses}
            properties={properties}
            expenseCategories={expenseCategories}
            platforms={platforms}
            profitTargets={profitTargets}
          />
        ) : null}

        {view === "property" ? (
          <PropertyView
            bookings={bookings}
            expenses={expenses}
            properties={properties}
            expenseCategories={expenseCategories}
            platforms={platforms}
          />
        ) : null}

        {view === "settings" ? (
          <SettingsView
            data={data}
            bookings={bookings}
            expenses={expenses}
            profitTargets={profitTargets}
            properties={properties}
            platforms={platforms}
            expenseCategories={expenseCategories}
            onAddProperty={addProperty}
            onUpdateProperty={updateProperty}
            onRemoveProperty={removeProperty}
            onAddPlatform={addPlatform}
            onUpdatePlatform={updatePlatform}
            onRemovePlatform={removePlatform}
            onAddExpenseCategory={addExpenseCategory}
            onUpdateExpenseCategory={updateExpenseCategory}
            onRemoveExpenseCategory={removeExpenseCategory}
            onUpdateProfitTarget={updateProfitTarget}
            onImportBackup={importBackup}
            onClearTransactions={clearTransactions}
            onUpdateAutomation={updateAutomation}
            onUpdatePropertyAutomation={updatePropertyAutomation}
            onSyncAutomatedExpenses={syncAutomation}
            onImportBookingCom={importBookingCom}
            onImportAirbnb={importAirbnb}
          />
        ) : null}
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  success = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  success?: boolean;
}) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-rc-gold/90">
        {label}
      </span>
      <p
        className={`mt-1 font-[family-name:var(--font-cormorant)] text-xl font-semibold ${
          success
            ? "text-emerald-400"
            : highlight
              ? "text-rc-gold"
              : "text-rc-gold-light"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
