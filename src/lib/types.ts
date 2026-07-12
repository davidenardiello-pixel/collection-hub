export type BankAccountId = "hsp" | "dsep" | "dd";

export interface Property {
  id: string;
  name: string;
  monthlyRent: number;
  cleaningCostPerCheckIn: number;
  krossBookingMonthly: number;
  /** Conto bancario di accredito (HSP, DSEP, D&D). */
  bankAccount?: BankAccountId;
  /** Commissione Airbnb imponibile (es. 0,155 = 15,5% o 0,03 = 3%). Default 15,5%. */
  airbnbCommissionRate?: number;
}

export interface AutomationSettings {
  autoRent: boolean;
  autoKrossBooking: boolean;
  autoCleaning: boolean;
}

export interface Platform {
  id: string;
  name: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface Booking {
  id: string;
  description: string;
  propertyId: string;
  platformId: string;
  checkIn: string;
  checkOut: string;
  grossIncome: number;
  cleaningFee: number;
  otaCommission: number;
  /** Dati importati da Excel: competenza = mese check-in (come file rendita). */
  legacyIncomeAttribution?: boolean;
  /** Incasso presente nel file rendita FY26 (pregresso). */
  importedFromExcel?: boolean;
  /** ID prenotazione OTA (es. N° prenotazione Booking.com). */
  externalId?: string;
  /** Ambito ultimo sync OTA, es. booking-com:regina-cappellari:2026-06 */
  otaImportScope?: string;
  /** Check-in già trascorso: non modificare/rimuovere ai sync successivi. */
  locked?: boolean;
  notes?: string;
}

export interface Expense {
  id: string;
  date: string;
  propertyId: string;
  categoryId: string;
  description: string;
  amount: number;
  notes?: string;
  /** Spesa presente nel file rendita FY26 (pregresso). */
  importedFromExcel?: boolean;
  automationId?: string;
  linkedBookingId?: string;
  linkedExpenseKind?: "commission" | "vat" | "cleaning";
}

export interface OtaImportSnapshot {
  platform: "booking-com" | "airbnb";
  propertyId: string;
  scope: string;
  filename: string;
  importedAt: string;
  reservationCount: number;
  /** Lordo Booking o netto Airbnb (Guadagni). */
  grossTotal: number;
  commissionTotal: number;
  added: number;
  updated: number;
  removed: number;
  removedGuests: string[];
  guests: string[];
}

export interface DashboardData {
  bookings: Booking[];
  expenses: Expense[];
  properties: Property[];
  platforms: Platform[];
  expenseCategories: ExpenseCategory[];
  profitTargets: number[];
  automation: AutomationSettings;
  /** Ultimi file OTA caricati dalla dashboard (non dalla cartella locale). */
  otaImportSnapshots?: OtaImportSnapshot[];
}

export type ViewId =
  | "overview"
  | "income"
  | "expenses"
  | "monthly"
  | "property"
  | "settings";

export interface MonthPeriod {
  year: number;
  month: number;
}
