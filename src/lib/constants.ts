import type { ExpenseCategory, Platform, Property } from "./types";

export const FISCAL_YEAR = 2026;
export const FISCAL_YEAR_START = `${FISCAL_YEAR}-01-01`;

/** Da questo mese le metriche occupazione / ADR sono considerate attendibili. */
export const OCCUPANCY_METRICS_START_MONTH = 6;

export const DEFAULT_CLEANING_COSTS: Record<string, number> = {
  "regina-cappellari": 30,
  "re-di-roma": 50,
};

export const DEFAULT_KROSSBOOKING_MONTHLY = 30;
export const DEFAULT_AIRBNB_COMMISSION_RATE = 0.155;

export const DEFAULT_PROPERTIES: Property[] = [
  {
    id: "regina-cappellari",
    name: "Regina Cappellari",
    monthlyRent: 2550,
    cleaningCostPerCheckIn: 30,
    krossBookingMonthly: DEFAULT_KROSSBOOKING_MONTHLY,
  },
  {
    id: "mistangelo",
    name: "Mistangelo",
    monthlyRent: 1558.34,
    cleaningCostPerCheckIn: 0,
    krossBookingMonthly: DEFAULT_KROSSBOOKING_MONTHLY,
  },
  {
    id: "re-di-roma",
    name: "Re Di Roma",
    monthlyRent: 1500,
    cleaningCostPerCheckIn: 50,
    krossBookingMonthly: DEFAULT_KROSSBOOKING_MONTHLY,
  },
  {
    id: "cipro",
    name: "Cipro",
    monthlyRent: 1700,
    cleaningCostPerCheckIn: 0,
    krossBookingMonthly: DEFAULT_KROSSBOOKING_MONTHLY,
  },
  {
    id: "palombini",
    name: "Palombini",
    monthlyRent: 1600,
    cleaningCostPerCheckIn: 0,
    krossBookingMonthly: DEFAULT_KROSSBOOKING_MONTHLY,
  },
  {
    id: "porto-fluviale",
    name: "Porto Fluviale",
    monthlyRent: 1450,
    cleaningCostPerCheckIn: 0,
    krossBookingMonthly: DEFAULT_KROSSBOOKING_MONTHLY,
  },
  {
    id: "gregorio-vii",
    name: "Gregorio VII",
    monthlyRent: 1950,
    cleaningCostPerCheckIn: 0,
    krossBookingMonthly: DEFAULT_KROSSBOOKING_MONTHLY,
  },
  {
    id: "hallo-claudia",
    name: "Hallo Claudia",
    monthlyRent: 0,
    cleaningCostPerCheckIn: 0,
    krossBookingMonthly: 0,
  },
];

export const DEFAULT_PLATFORMS: Platform[] = [
  { id: "booking", name: "Booking" },
  { id: "airbnb", name: "Airbnb" },
  { id: "diretta", name: "Diretta" },
  { id: "vrbo", name: "VRBO" },
  { id: "prenotazione-diretta", name: "Prenotazione diretta" },
  { id: "rome-collection", name: "Rome Collection" },
];

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "utenze", name: "Utenze" },
  { id: "krossbooking", name: "KrossBooking" },
  { id: "pulizie", name: "Pulizie" },
  { id: "wifi", name: "Wi-fi" },
  { id: "tassa-rifiuti", name: "Tassa rifiuti" },
  { id: "tassa-acqua", name: "Tassa acqua" },
  { id: "biancheria", name: "Biancheria" },
  { id: "arredamento", name: "Arredamento" },
  { id: "condominio", name: "Condominio" },
  { id: "mutuo", name: "Mutuo" },
  { id: "gas", name: "Gas" },
  { id: "revenue-management", name: "Revenue Managment" },
  { id: "assicurazioni", name: "Assicurazioni" },
  { id: "manutenzione", name: "manutenzione" },
  { id: "affitto", name: "Affitto" },
  { id: "com-booking", name: "Com. Booking" },
  { id: "com-airbnb", name: "Com.Airbnb" },
  { id: "commissioni-ota", name: "Commissioni OTA" },
  { id: "iva", name: "IVA" },
  { id: "lavanderia", name: "Lavanderia" },
];

export const MAX_PROPERTIES = 20;
export const MAX_PLATFORMS = 20;
export const MAX_EXPENSE_CATEGORIES = 20;

export const MONTH_LABELS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
] as const;

export const STORAGE_KEY = "hsp-dashboard-data-v8";

export function createEmptyProfitTargets(): number[] {
  return Array.from({ length: 12 }, () => 0);
}
