import { removeAllBookingLinkedExpenses } from "./booking-vat";
import type { DashboardData } from "./types";

export function removePropertyFromDashboard(
  data: DashboardData,
  propertyId: string,
): { data: DashboardData; error: string | null } {
  if (data.properties.length <= 1) {
    return {
      data,
      error: "Devi mantenere almeno un appartamento.",
    };
  }

  const bookingIds = data.bookings
    .filter((booking) => booking.propertyId === propertyId)
    .map((booking) => booking.id);

  let expenses = data.expenses;

  for (const bookingId of bookingIds) {
    expenses = removeAllBookingLinkedExpenses(expenses, bookingId);
  }

  expenses = expenses.filter((expense) => expense.propertyId !== propertyId);

  return {
    data: {
      ...data,
      bookings: data.bookings.filter(
        (booking) => booking.propertyId !== propertyId,
      ),
      expenses,
      properties: data.properties.filter(
        (property) => property.id !== propertyId,
      ),
      otaImportSnapshots:
        data.otaImportSnapshots?.filter(
          (snapshot) => snapshot.propertyId !== propertyId,
        ) ?? [],
    },
    error: null,
  };
}

export function countPropertyLinkedTransactions(
  data: DashboardData,
  propertyId: string,
): { bookings: number; expenses: number } {
  const bookingCount = data.bookings.filter(
    (booking) => booking.propertyId === propertyId,
  ).length;
  const expenseCount = data.expenses.filter(
    (expense) => expense.propertyId === propertyId,
  ).length;

  return { bookings: bookingCount, expenses: expenseCount };
}
