import { spawnSync } from "node:child_process";
import { createSeedData } from "../src/lib/seed.ts";
import { syncBookingComReservations } from "../src/lib/ota-import/booking-com.ts";
import { normalizeDashboardData } from "../src/lib/migrate.ts";
import {
  sumBookingsInPeriod,
  filterExpensesByPeriod,
} from "../src/lib/calculations.ts";
import {
  calculateBookingVat,
  isLinkedVatExpense,
} from "../src/lib/booking-vat.ts";
import { isLinkedCommissionExpense } from "../src/lib/booking-commission.ts";
import { isLinkedCleaningExpense } from "../src/lib/booking-cleaning.ts";

const xlsPath =
  "Regina Cappellari - prenotazioni/Booking/Soggiorno_ 2026-06-01 - 2026-06-30.xls";

const py = spawnSync(
  "python3",
  ["scripts/import-booking-com.py", xlsPath, "--property-id", "regina-cappellari"],
  { encoding: "utf8" },
);

if (py.status !== 0) {
  console.error(py.stderr || py.stdout);
  process.exit(1);
}

const parsed = JSON.parse(py.stdout);
const { period, reservations } = parsed;

let data = normalizeDashboardData(createSeedData());
const { data: synced } = syncBookingComReservations(
  data,
  "regina-cappellari",
  period,
  reservations,
);
data = normalizeDashboardData(synced);

const june = { year: 2026, month: 6 };
const reginaBookings = data.bookings.filter(
  (booking) =>
    booking.propertyId === "regina-cappellari" &&
    booking.otaImportScope?.includes("2026-06"),
);
const juneExpenses = filterExpensesByPeriod(
  data.expenses.filter((expense) => expense.propertyId === "regina-cappellari"),
  june,
);

const income = sumBookingsInPeriod(
  data.bookings,
  june,
  (booking) => booking.propertyId === "regina-cappellari",
);
const commissionTotal = juneExpenses
  .filter(isLinkedCommissionExpense)
  .reduce((sum, expense) => sum + expense.amount, 0);
const vatTotal = juneExpenses
  .filter(isLinkedVatExpense)
  .reduce((sum, expense) => sum + expense.amount, 0);
const cleaningTotal = juneExpenses
  .filter(isLinkedCleaningExpense)
  .reduce((sum, expense) => sum + expense.amount, 0);

const withoutNino = reservations.filter(
  (reservation) => Math.abs(reservation.grossIncome - 836) > 0.01,
);
const gross5 = withoutNino.reduce(
  (sum, reservation) => sum + reservation.grossIncome,
  0,
);
const comm5 = withoutNino.reduce(
  (sum, reservation) => sum + reservation.otaCommission,
  0,
);
const vat5 = withoutNino.reduce(
  (sum, reservation) =>
    sum +
    calculateBookingVat({
      id: "",
      description: "",
      propertyId: "",
      platformId: "booking",
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      grossIncome: reservation.grossIncome,
      cleaningFee: 0,
      otaCommission: reservation.otaCommission,
    }),
  0,
);

console.log("=== UPLOAD / PARSER (righe attive nel file) ===");
console.log("Prenotazioni:", reservations.length);
console.log(
  "Lordo:",
  reservations.reduce((sum, item) => sum + item.grossIncome, 0).toFixed(2),
);
console.log(
  "Commissioni (19,5%):",
  reservations.reduce((sum, item) => sum + item.otaCommission, 0).toFixed(2),
);

console.log("\n=== CONFRONTO PDF (5 righe senza Nino) ===");
console.log("Lordo:", gross5.toFixed(2), "| atteso PDF 4426.09");
console.log("Commissioni:", comm5.toFixed(2), "| atteso PDF 863.09");
console.log("IVA scorporo:", vat5.toFixed(2), "| atteso ~402.37");

console.log("\n=== DASHBOARD DOPO SYNC (giugno Regina) ===");
console.log("Prenotazioni in scope:", reginaBookings.length);
console.log("Incassi competenza:", income.toFixed(2));
console.log("Spese commissioni:", commissionTotal.toFixed(2));
console.log("Spese IVA:", vatTotal.toFixed(2));
console.log("Spese pulizie:", cleaningTotal.toFixed(2));

console.log("\nDettaglio:");
for (const booking of reginaBookings) {
  console.log(
    `  ${booking.description}: ${booking.grossIncome.toFixed(2)} € | comm ${booking.otaCommission.toFixed(2)} €`,
  );
}

const okGross = Math.abs(gross5 - 4426.09) < 0.02;
const okComm = Math.abs(comm5 - 863.09) < 0.02;
const okVat = Math.abs(vat5 - 402.37) < 0.05;
const okSyncComm = Math.abs(commissionTotal - comm5) < 0.05;
const okSyncVat = Math.abs(vatTotal - vat5) < 0.1;

console.log("\n=== ESITO ===");
console.log("PDF lordo OK:", okGross);
console.log("PDF commissioni OK:", okComm);
console.log("PDF IVA OK:", okVat);
console.log("Sync commissioni OK:", okSyncComm);
console.log("Sync IVA OK:", okSyncVat);

process.exit(okGross && okComm && okSyncComm && okSyncVat ? 0 : 1);
